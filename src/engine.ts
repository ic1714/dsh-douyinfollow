import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-schedule'
import { DouyinBrowser } from './browser.js'
import { readConfig, type Config, type FollowConfig } from './config.js'
import { ActivityTracker } from './idle.js'
import { FrameOcr } from './ocr.js'
import { parsePricing } from './pricing.js'
import { inSchedule, nextOpenAt } from './schedule.js'
import { FollowStore } from './store.js'
import { UsageTracker } from './usage.js'
import { overallOf, type Card, type Fact, type Lead, type PatrolRecord, type FollowSnapshot, type VideoRef } from './types.js'

export interface PublishInput {
  leadId: string
  headline: string
  keyword?: string
  facts: Fact[]
  marketing?: string
  summary?: string
}

export function resolveDataDir(cfg: FollowConfig): string {
  if (cfg.dataDir.trim()) return cfg.dataDir.trim()
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'plugin-data', 'douyinfollow')
}

/**
 * 核心引擎：空闲跟进 → 采集 → 线索入库 → 派发独立会话做权威核实 → 卡片入面板。
 * 浏览器与核实会话都在后台运行，不打断前台对话。
 */
export class FollowEngine {
  readonly store: FollowStore
  readonly browser: DouyinBrowser
  readonly ocr: FrameOcr
  readonly tracker = new ActivityTracker()
  readonly usage: UsageTracker
  private timer?: ReturnType<typeof setInterval>
  private running = false
  private current?: PatrolRecord
  private loggedIn = false
  private disposed = false

  constructor(private ctx: Context, private config: Config) {
    const cfg = readConfig(config)
    const dir = resolveDataDir(cfg)
    this.store = new FollowStore(dir)
    this.browser = new DouyinBrowser({
      userDataDir: join(dir, 'browser-profile'),
      channel: cfg.browserChannel,
      headlessPatrol: cfg.headlessPatrol,
      loginTimeoutSeconds: cfg.loginTimeoutSeconds,
    })
    this.ocr = new FrameOcr(dir)
    this.usage = new UsageTracker(this.store, () => parsePricing(this.cfg().pricingJson))
  }

  cfg(): FollowConfig {
    const base = readConfig(this.config)
    const prefs = this.store.state.prefs ?? {}
    return {
      ...base,
      enabled: prefs.enabled ?? base.enabled,
      keywords: prefs.keywords ?? base.keywords,
      intervalMinutes: prefs.intervalMinutes ?? base.intervalMinutes,
      scheduleMode: prefs.scheduleMode ?? base.scheduleMode,
      activeWindows: prefs.activeWindows ?? base.activeWindows,
    }
  }

  async start(): Promise<void> {
    await this.store.load()
    this.tracker.attach(this.ctx)
    this.usage.attach(this.ctx)
    void this.refreshLogin()
    this.timer = setInterval(() => void this.tick(), 20000)
  }

  /** 插件卸载时由入口的 ctx.effect 调用。 */
  async dispose(): Promise<void> {
    this.disposed = true
    if (this.timer) clearInterval(this.timer)
    await this.browser.close()
    await this.ocr.dispose()
    await this.store.save()
  }

  async refreshLogin(): Promise<boolean> {
    this.loggedIn = await this.browser.isLoggedIn()
    return this.loggedIn
  }

  /** 面板/工具触发扫码登录；成功后立即回写登录态，不等下一次复查。 */
  startLogin(): { started: boolean } {
    if (!this.browser.loggingIn) {
      void this.browser.login().then(ok => { if (ok) this.loggedIn = true })
    }
    return { started: true }
  }

  /** 风控拦截时开有头窗口请用户人工过验证；成功后信任态留在 profile。 */
  startHumanCheck(): { started: boolean } {
    if (!this.browser.checkingHuman) {
      const kw = this.cfg().keywords[0] ?? '抖音'
      const url = `https://www.douyin.com/search/${encodeURIComponent(kw)}?type=video`
      void this.browser.humanCheck(url)
    }
    return { started: true }
  }

  /** 面板「我已完成验证」：用户网页端过完验证后手动触发立即复核，兜底自动检测漏判。 */
  confirmHumanCheck(): { confirmed: boolean } {
    this.browser.confirmHuman()
    return { confirmed: this.browser.checkingHuman }
  }

  /** 面板「取消验证」：立即结束并关窗，按钮恢复可重试。 */
  cancelHumanCheck(): { cancelled: boolean } {
    this.browser.cancelHuman()
    return { cancelled: this.browser.checkingHuman }
  }

  private async tick(): Promise<void> {
    if (this.disposed || this.running) return
    if (this.browser.loggingIn || this.browser.checkingHuman) return
    const cfg = this.cfg()
    if (!cfg.enabled || cfg.keywords.length === 0) return
    // 时间段守卫：只约束自动跟进；手动「立即跟进」/工具触发绕过窗口。
    if (!inSchedule(new Date(), cfg.scheduleMode, cfg.activeWindows)) return
    const last = this.store.state.lastPatrolAt ?? 0
    if (Date.now() - last < cfg.intervalMinutes * 60000) return
    if (!this.tracker.isIdle(cfg.idleQuietSeconds * 1000)) return
    // 记录前台窗口供归还焦点；全屏游戏/视频时跟进照跑，但窗口置底不激活、不打断前台。
    const fg = await this.foregroundFullscreen()
    this.browser.noteForeground(fg.hwnd)
    if (!this.loggedIn) {
      // 登录态可能过期；低频复查，避免每次 tick 都启浏览器
      if (Date.now() - last < 10 * 60000) return
      await this.refreshLogin()
      if (!this.loggedIn) return
    }
    await this.runPatrol('idle')
  }

  /** 前台窗口是否全屏（60 秒缓存，避免每 tick 起进程）；顺带记录前台 hwnd 供归还焦点。 */
  private fgCache?: { at: number; full: boolean; hwnd: number }
  private async foregroundFullscreen(): Promise<{ full: boolean; hwnd: number }> {
    if (this.fgCache && Date.now() - this.fgCache.at < 60000) return this.fgCache
    let out = { full: false, hwnd: 0 }
    if (process.platform === 'win32') {
      try {
        const script = [
          `Add-Type -Name U -Namespace N -MemberDefinition '[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern bool GetWindowRect(System.IntPtr h, out R r); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint p); public struct R { public int L; public int T; public int R2; public int B; }'`,
          `Add-Type -AssemblyName System.Windows.Forms`,
          `$h = [N.U]::GetForegroundWindow(); $r = New-Object N.U+R; [N.U]::GetWindowRect($h, [ref]$r) | Out-Null; $pid2 = 0; [N.U]::GetWindowThreadProcessId($h, [ref]$pid2) | Out-Null`,
          `$name = (Get-Process -Id $pid2 -ErrorAction SilentlyContinue).ProcessName`,
          `$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds`,
          `$cover = ($r.L -le $b.X) -and ($r.T -le $b.Y) -and ($r.R2 -ge $b.Right) -and ($r.B -ge $b.Bottom)`,
          `$sys = @('explorer','dwm','ApplicationFrameHost','ShellExperienceHost','SearchHost','LockApp','TextInputHost')`,
          `$full = $cover -and ($sys -notcontains $name)`,
          `@{ hwnd = [int64]$h; exe = $name; full = [bool]$full } | ConvertTo-Json -Compress`,
        ].join('; ')
        const { execFile } = await import('node:child_process')
        const stdout = await new Promise<string>((resolve, reject) => {
          execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 10000, windowsHide: true }, (err, so) => err ? reject(err) : resolve(so))
        })
        const j = JSON.parse(stdout.trim()) as { hwnd: number; full: boolean }
        out = { full: !!j.full, hwnd: Number(j.hwnd) || 0 }
      } catch { /* 检测失败按非全屏处理 */ }
    }
    this.fgCache = { at: Date.now(), ...out }
    return out
  }

  /** 触发一次跟进；守卫同步返回，采集在后台继续。 */
  runPatrol(trigger: PatrolRecord['trigger']): { started: boolean; patrolId?: string; reason?: string } {
    if (this.running) return { started: false, reason: '已有跟进在进行中' }
    const cfg = this.cfg()
    // enabled 语义为「启用空闲自动跟进」：只约束自动触发，手动/工具触发绕过（与时间段守卫一致）。
    if (!cfg.enabled && trigger === 'idle') return { started: false, reason: '自动跟进已停用（enabled=false）' }
    if (cfg.keywords.length === 0) return { started: false, reason: '尚未设置关键词' }
    if (!this.loggedIn && trigger !== 'manual') return { started: false, reason: '抖音未登录' }
    const record: PatrolRecord = {
      id: randomUUID(),
      startedAt: Date.now(),
      keywords: cfg.keywords,
      found: 0,
      added: 0,
      trigger,
    }
    this.running = true
    this.current = record
    this.store.addPatrol(record)
    void this.doPatrol(record, cfg)
    return { started: true, patrolId: record.id }
  }

  private async doPatrol(record: PatrolRecord, cfg: FollowConfig): Promise<void> {
    const batchId = record.id
    const leads: Lead[] = []
    try {
      if (!this.loggedIn) await this.refreshLogin()
      if (!this.loggedIn) throw new Error('抖音未登录：请先在面板或对话中扫码登录')
      const cap = cfg.maxVideosPerPatrol
      for (const keyword of cfg.keywords) {
        if (leads.length >= cap || this.disposed) break
        let items
        try {
          // 传入 seen 判定：搜索内部往下翻找，只回「没看过」的前 N 条，避免前排旧结果永远挡路。
          items = await this.browser.search(keyword, cap - leads.length, id => this.store.hasSeen(id))
        } catch (err) {
          record.error = `搜索「${keyword}」失败：${(err as Error).message}`
          continue
        }
        record.found += items.scanned
        // 搜索已通：清掉面板上残留的「过验证超时」提示，避免误导。
        this.browser.humanError = undefined
        const fresh = items.items.filter(i => !this.store.hasSeen(i.videoId))
        this.store.markSeen(items.items.map(i => i.videoId))
        for (const item of fresh) {
          if (leads.length >= cap || this.disposed) break
          try {
            const collected = await this.browser.collect(item, {
              aiSummary: cfg.aiSummaryEnabled,
              frames: cfg.ocrEnabled ? cfg.frameCount : 0,
            })
            const ocrText = cfg.ocrEnabled ? await this.ocr.recognize(collected.frames) : ''
            const video: VideoRef = {
              videoId: item.videoId,
              url: item.url,
              title: collected.title || item.title,
              author: collected.author || item.author,
              publishText: item.publishText,
              keyword,
            }
            leads.push({
              id: randomUUID(),
              batchId,
              keyword,
              video,
              collectedAt: Date.now(),
              desc: collected.desc,
              aiSummary: collected.aiSummary,
              ocrText: ocrText || undefined,
              status: 'pending',
            })
          } catch (err) {
            record.error = `采集视频 ${item.videoId} 失败：${(err as Error).message}`
          }
        }
      }
      record.added = leads.length
      if (leads.length > 0) {
        this.store.addLeads(leads)
        await this.dispatchVerify(batchId)
      }
    } catch (err) {
      record.error = (err as Error).message
    } finally {
      record.finishedAt = Date.now()
      this.store.state.lastPatrolAt = Date.now()
      this.running = false
      this.current = undefined
      await this.store.save()
      // 跟进收尾再置底一次：确保整个采集期间窗口都没有压到前台应用上面。
      await this.browser.quiet().catch(() => undefined)
    }
  }

  /** 派发一个独立后台会话做事实核实（宿主 Schedule 投递，复用会话时等待其空闲）。 */
  async dispatchVerify(batchId: string): Promise<{ dispatched: boolean; taskId?: string; reason?: string }> {
    const leads = this.store.leadsOfBatch(batchId).filter(l => l.status === 'pending')
    if (leads.length === 0) return { dispatched: false, reason: '该批次没有待核实线索' }
    const prompt = buildVerifyPrompt(batchId, leads.length)
    try {
      await this.ctx.schedule.deleteInactive().catch(() => undefined)
      const task = await this.ctx.schedule.create({
        title: `抖音跟进核实 ${batchId.slice(0, 8)}`,
        prompt,
        timing: { kind: 'after', after_seconds: 2 },
        target: { kind: 'new_once' },
      })
      // new_once 创建即预留 sessionId：登记归属，供花费统计精确计入本插件的核实会话。
      const sid = (task as { target?: { sessionId?: unknown } }).target?.sessionId
      if (typeof sid === 'string' && sid) this.usage.register(sid, batchId)
      for (const lead of leads) lead.status = 'verifying'
      await this.store.save()
      return { dispatched: true, taskId: String(task.id) }
    } catch (err) {
      return { dispatched: false, reason: `Schedule 派发失败：${(err as Error).message}` }
    }
  }

  /** 核实员回写卡片。overall 由事实状态服务端重算，不信任回写值。 */
  publish(input: PublishInput): { cardId?: string; reason?: string } {
    const lead = this.store.getLead(input.leadId)
    if (!lead) return { reason: `线索不存在：${input.leadId}` }
    if (lead.status === 'published') return { reason: '该线索已发布过卡片' }
    const facts: Fact[] = (input.facts ?? []).map(f => {
      const sources = (f.sources ?? []).filter(s => typeof s?.url === 'string' && /^https?:\/\//.test(s.url)).slice(0, 6)
      let status: Fact['status'] = f.status === 'verified' || f.status === 'contradicted' ? f.status : 'unverified'
      let note = f.note ? String(f.note).slice(0, 500) : undefined
      // 完整性规则：声称已核实却没有有效权威来源链接的，降级为无法核实。
      if (status === 'verified' && sources.length === 0) {
        status = 'unverified'
        note = [note, '缺少有效权威来源链接，已降级为无法核实'].filter(Boolean).join('；')
      }
      return { claim: String(f.claim ?? '').slice(0, 500), status, sources, note }
    })
    const card: Card = {
      id: randomUUID(),
      leadId: lead.id,
      batchId: lead.batchId,
      keyword: input.keyword?.trim() || lead.keyword,
      headline: String(input.headline ?? '').slice(0, 200) || lead.video.title,
      createdAt: Date.now(),
      read: false,
      archived: false,
      video: lead.video,
      facts,
      marketing: input.marketing ? String(input.marketing).slice(0, 1000) : undefined,
      summary: input.summary ? String(input.summary).slice(0, 1000) : undefined,
      overall: overallOf(facts),
    }
    lead.status = 'published'
    this.store.addCard(card, this.cfg().retentionCards)
    void this.store.save()
    return { cardId: card.id }
  }

  skipLead(leadId: string, reason?: string): boolean {
    const lead = this.store.getLead(leadId)
    if (!lead || lead.status === 'published') return false
    lead.status = 'skipped'
    lead.skipReason = reason?.slice(0, 300)
    void this.store.save()
    return true
  }

  snapshot(): FollowSnapshot {
    const cfg = this.cfg()
    const state = this.store.state
    const cards = [...state.cards].sort((a, b) => b.createdAt - a.createdAt)
    const patrols = [...state.patrols].sort((a, b) => b.startedAt - a.startedAt)
    const last = patrols[0]
    const now = Date.now()
    const d = new Date(now)
    const inWindow = inSchedule(d, cfg.scheduleMode, cfg.activeWindows)
    const nextOpen = inWindow ? undefined : nextOpenAt(d, cfg.scheduleMode, cfg.activeWindows)
    // 下次最早自动跟进 = 间隔到期 与 下次开窗 的较晚者。
    const nextEligibleAt = Math.max((state.lastPatrolAt ?? 0) + cfg.intervalMinutes * 60000, nextOpen ?? 0)
    return {
      now,
      enabled: cfg.enabled,
      keywords: cfg.keywords,
      intervalMinutes: cfg.intervalMinutes,
      scheduleMode: cfg.scheduleMode,
      activeWindows: cfg.activeWindows,
      window: { inWindow, nextOpenAt: nextOpen },
      login: { loggedIn: this.loggedIn, loggingIn: this.browser.loggingIn, error: this.browser.loginError },
      human: { checking: this.browser.checkingHuman, error: this.browser.humanError },
      idle: {
        busy: this.tracker.busy,
        lastActivityAt: this.tracker.lastActivityAt,
        idle: this.tracker.isIdle(cfg.idleQuietSeconds * 1000),
      },
      patrol: { running: this.running, current: this.current, last, nextEligibleAt },
      leadsPending: this.store.pendingLeads().length,
      leads: this.store.pendingLeads().slice(-30),
      cards,
      patrols: patrols.slice(0, 10),
      ocrReady: this.ocr.ready,
      usage: this.usage.view(),
    }
  }
}

function buildVerifyPrompt(batchId: string, count: number): string {
  return [
    `你是「抖音跟进」的核实编排员。本次批次 batchId=${batchId}，共 ${count} 条线索。`,
    '背景：抖音视频只是线索来源，博主普遍过度营销，其说法一律视为待证线索，不可直接当事实。',
    '步骤：',
    `1. 调用 douyin_follow_leads，参数 {"batchId":"${batchId}"}，获取线索（视频标题/文案/AI 讲解/画面文字）。`,
    '2. 逐条判断与关键词的相关性；明显无关的用 douyin_follow_skip 跳过并给理由。',
    '3. 相关线索提取可核实事实点（项目/产品名、版本号、功能、发布日期、数据等），用 web_search / web_fetch 到权威来源交叉核实：优先 GitHub 仓库/Release/Commit、官网、官方文档，其次权威媒体。',
    '4. 调用 douyin_follow_publish 发布卡片：headline 为一句话进展；facts 每条带 status（verified/contradicted/unverified）与 sources（权威来源 URL）；博主营销夸大归入 marketing；summary 概述视频在说什么。',
    '5. 全部处理完后输出一行统计（发布/跳过/无法核实数量）。',
    '约束：全程只读；不得在抖音执行点赞/评论/关注/发布等任何交互；不得编造来源 URL；证据不足标 unverified 并在 note 说明缺什么证据；与权威来源冲突标 contradicted。',
  ].join('\n')
}