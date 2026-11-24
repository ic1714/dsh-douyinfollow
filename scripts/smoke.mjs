// 本地逻辑自测：不启动浏览器、不连接 DSH，验证存储/配置/发布/派发/时间段/计费等确定性逻辑。
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readConfig } from '../dist/config.js'
import { FollowEngine } from '../dist/engine.js'
import { costOf, DEFAULT_PRICING, normalizeModel, parsePricing, ratesFor } from '../dist/pricing.js'
import { inSchedule, inWindows, isPeakBeijing, nextOpenAt, normalizeWindow, parseWindow } from '../dist/schedule.js'
import { FollowStore, sanitizePrefs } from '../dist/store.js'
import { overallOf } from '../dist/types.js'
import { sanitizeUsage } from '../dist/usage.js'

const dir = await mkdtemp(join(tmpdir(), 'follow-smoke-'))
const dir2 = await mkdtemp(join(tmpdir(), 'follow-smoke2-'))

// 1. 存储往返与去重
const store = new FollowStore(dir)
await store.load()
store.markSeen(['v1', 'v2'])
assert.equal(store.hasSeen('v1'), true)
assert.equal(store.hasSeen('v3'), false)
const lead = {
  id: 'l1', batchId: 'b1', keyword: 'DeepSeek', collectedAt: Date.now(),
  video: { videoId: 'v1', url: 'https://www.douyin.com/video/v1', title: 't', author: 'a', keyword: 'DeepSeek' },
  desc: 'd', status: 'pending',
}
store.addLeads([lead])
await store.save()
const store2 = new FollowStore(dir)
await store2.load()
assert.equal(store2.hasSeen('v1'), true)
assert.equal(store2.state.leads.length, 1)
assert.deepEqual(store2.state.usage.total, { calls: 0, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, costCny: 0 })

// 2. overall 重算规则
assert.equal(overallOf([]), 'unverified')
assert.equal(overallOf([{ claim: 'c', status: 'verified', sources: [] }]), 'verified')
assert.equal(overallOf([{ claim: 'c', status: 'verified', sources: [] }, { claim: 'd', status: 'unverified', sources: [] }]), 'mixed')
assert.equal(overallOf([{ claim: 'c', status: 'contradicted', sources: [] }]), 'contradicted')

// 3. 配置快照（volatile stub）
const v = x => ({ get: () => x })
const cfgStub = extra => ({
  enabled: v(true), keywords: v([' DeepSeek ', '']), intervalMinutes: v(30), idleQuietSeconds: v(60),
  maxVideosPerPatrol: v(4), ocrEnabled: v(false), aiSummaryEnabled: v(true), frameCount: v(2),
  headlessPatrol: v(true), browserChannel: v('msedge'), dataDir: v(dir2), loginTimeoutSeconds: v(120), retentionCards: v(50),
  scheduleMode: v('all'), activeWindows: v([]), pricingJson: v(''),
  ...extra,
})
const cfg = readConfig(cfgStub())
assert.deepEqual(cfg.keywords, ['DeepSeek'])
assert.equal(cfg.intervalMinutes, 30)
assert.equal(cfg.ocrEnabled, false)
assert.equal(cfg.scheduleMode, 'all')
assert.equal(readConfig(cfgStub({ scheduleMode: v('bogus') })).scheduleMode, 'all')
assert.equal(readConfig(cfgStub({ scheduleMode: v('offpeak') })).scheduleMode, 'offpeak')

// 4. 时间段：窗口解析 / 跨午夜 / 官方峰谷 / 下次开窗
assert.deepEqual(parseWindow('22:00-06:00'), { start: 1320, end: 360 })
assert.equal(parseWindow('25:00-06:00'), null)
assert.equal(parseWindow('08:00-08:00'), null)
assert.equal(parseWindow('8:00-9:00').start, 480)
assert.equal(normalizeWindow('8:00-9:5'), '08:00-09:05')
assert.equal(normalizeWindow('bad'), null)
// 自定义窗口按本地时间
assert.equal(inWindows(new Date(2026, 10, 24, 23, 0), ['22:00-06:00']), true)
assert.equal(inWindows(new Date(2026, 10, 24, 5, 59), ['22:00-06:00']), true)
assert.equal(inWindows(new Date(2026, 10, 24, 6, 0), ['22:00-06:00']), false)
assert.equal(inWindows(new Date(2026, 10, 24, 12, 0), ['22:00-06:00']), false)
assert.equal(inWindows(new Date(2026, 10, 24, 12, 0), []), true) // 空窗口 = 全天
assert.equal(inWindows(new Date(2026, 10, 24, 13, 0), ['12:00-14:00', '18:00-20:00']), true)
// 官方峰谷按北京时间（UTC+8）：2026-11-24 周二 / 11-22 周日 / 11-23 周一
const bjTue10 = new Date(Date.UTC(2026, 10, 24, 2, 0))   // 周二 10:00 峰
const bjTue13 = new Date(Date.UTC(2026, 10, 24, 5, 0))   // 周二 13:00 谷
const bjTue18 = new Date(Date.UTC(2026, 10, 24, 10, 0))  // 周二 18:00 谷（边界含头不含尾）
const bjSun10 = new Date(Date.UTC(2026, 10, 22, 2, 0))   // 周日 10:00 谷
const bjMon07 = new Date(Date.UTC(2026, 10, 22, 23, 0))  // 周一 07:00 谷
assert.equal(isPeakBeijing(bjTue10), true)
assert.equal(isPeakBeijing(bjTue13), false)
assert.equal(isPeakBeijing(bjTue18), false)
assert.equal(isPeakBeijing(bjSun10), false)
assert.equal(isPeakBeijing(bjMon07), false)
assert.equal(inSchedule(bjTue10, 'offpeak', []), false)
assert.equal(inSchedule(bjTue10, 'peak', []), true)
assert.equal(inSchedule(bjSun10, 'offpeak', []), true)
assert.equal(inSchedule(bjTue10, 'all', []), true)
// 下次开窗：周日峰时模式 → 周一 9:00（北京时间）
assert.equal(nextOpenAt(bjSun10, 'peak', []), Date.UTC(2026, 10, 23, 1, 0))
assert.equal(nextOpenAt(bjTue10, 'peak', []), undefined) // 已在窗内
assert.equal(nextOpenAt(bjTue13, 'offpeak', []), undefined)
assert.equal(nextOpenAt(bjTue10, 'offpeak', []), Date.UTC(2026, 10, 24, 4, 0)) // 周二 12:00
// 自定义窗口下次开窗（本地 12:00 → 当晚 22:00）
assert.equal(nextOpenAt(new Date(2026, 10, 24, 12, 0), 'custom', ['22:00-06:00']), new Date(2026, 10, 24, 22, 0).getTime())

// 5. 偏好清洗：时间段字段
const prefs = sanitizePrefs({ scheduleMode: 'offpeak', activeWindows: ['22:00-6:00', 'bad', '08:00-08:00', '22:00-06:00'] })
assert.equal(prefs.scheduleMode, 'offpeak')
assert.deepEqual(prefs.activeWindows, ['22:00-06:00'])
assert.equal(sanitizePrefs({ scheduleMode: 'bogus' }).scheduleMode, undefined)

// 6. 计价：峰谷 / 缓存分桶 / 模型归一 / 价格表覆盖
const usage1M = { inputTokens: 1e6, cacheReadTokens: 1e6, outputTokens: 1e6 }
assert.equal(costOf(usage1M, 'deepseek-flash', bjTue10.getTime(), DEFAULT_PRICING).costCny, 2 + 0.04 + 8) // 峰时
assert.equal(costOf(usage1M, 'deepseek-flash', bjTue13.getTime(), DEFAULT_PRICING).costCny, (2 + 0.04 + 8) / 2) // 谷时半价
assert.equal(costOf(usage1M, 'deepseek-flash', bjTue10.getTime(), DEFAULT_PRICING).peak, true)
assert.equal(normalizeModel('deepseek-v4-pro'), 'deepseek-v4-pro')
assert.equal(normalizeModel('deepseek-chat'), 'deepseek-flash')
assert.equal(normalizeModel('DeepSeek-V4-Flash'), 'deepseek-flash')
assert.equal(ratesFor(DEFAULT_PRICING, 'unknown-model', true).cacheMiss, 2) // 未知模型兜底 flash 档
const overridden = parsePricing('{"models":{"deepseek-flash":{"output":10}}}')
assert.equal(overridden.models['deepseek-flash'].output, 10)
assert.equal(overridden.models['deepseek-flash'].cacheMiss, 2)
assert.equal(parsePricing('not json'), DEFAULT_PRICING)
assert.equal(parsePricing(''), DEFAULT_PRICING)

// 7. 用量状态清洗
const us = sanitizeUsage({ sessions: { s1: 'b1', bad: 42 }, records: [{ sessionId: 's1', batchId: 'b1' }, null], total: { calls: 3, costCny: 0.5 } })
assert.deepEqual(us.sessions, { s1: 'b1' })
assert.equal(us.records.length, 1)
assert.equal(us.total.calls, 3)
assert.equal(sanitizeUsage(undefined).records.length, 0)

// 8. 引擎：发布/重算/跳过/派发/用量归属（fake ctx，不触网）
let sessionEventHandler
const sessionOns = []
const fakeCtx = {
  on: (name, fn, opts) => { if (name === 'session/event') { sessionEventHandler = fn; sessionOns.push(opts) } return () => {} },
  effect: () => () => {},
  schedule: {
    create: async () => ({ id: 'task-1', target: { kind: 'new_once', sessionId: 'sess-1' } }),
    deleteInactive: async () => ({ deleted: 0 }),
  },
}
const engine = new FollowEngine(fakeCtx, cfgStub({ keywords: v(['DeepSeek']) }))
await engine.store.load()
engine.tracker.attach(fakeCtx) // idle 监听 normally 随引擎启动挂载，smoke 显式补挂以断言注册选项
engine.usage.attach(fakeCtx) // 最后注册：后续事件模拟打在 usage 监听上
// 回归：session/event 必须 global 注册（dsh-scope 作用域路由会滤掉插件 ctx 的普通监听 → 今日¥0.00）
assert.equal(sessionOns.length, 2) // idle + usage
assert.ok(sessionOns.every(o => o && o.global === true))
engine.store.addLeads([
  { ...lead, id: 'l2', batchId: 'b2' },
  { ...lead, id: 'l3', batchId: 'b2', video: { ...lead.video, videoId: 'v9' } },
])
const pub = engine.publish({
  leadId: 'l2', headline: 'DeepSeek 发布新版本',
  facts: [{ claim: '版本 0.2 已发布', status: 'verified', sources: [{ url: 'https://github.com/deepseek-ai/deepseek-harness/releases' }] }],
  marketing: '博主称“碾压一切”',
})
assert.ok(pub.cardId)
const card = engine.store.getCard(pub.cardId)
assert.equal(card.overall, 'verified')
assert.equal(card.batchId, 'b2')
assert.equal(card.marketing, '博主称“碾压一切”')
assert.equal(engine.store.getLead('l2').status, 'published')
assert.ok(engine.publish({ leadId: 'l2', headline: 'dup', facts: [] }).reason)
// 非法来源 URL 被过滤
const pub2 = engine.publish({ leadId: 'l3', headline: 'h', facts: [{ claim: 'c', status: 'verified', sources: [{ url: 'javascript:alert(1)' }] }] })
assert.equal(engine.store.getCard(pub2.cardId).facts[0].sources.length, 0)
assert.equal(engine.store.getCard(pub2.cardId).overall, 'unverified')
// 派发核实：pending → verifying，且登记 sessionId 归属
engine.store.addLeads([{ ...lead, id: 'l4', batchId: 'b3', video: { ...lead.video, videoId: 'v10' } }])
const disp = await engine.dispatchVerify('b3')
assert.equal(disp.dispatched, true)
assert.equal(disp.taskId, 'task-1')
assert.equal(engine.store.getLead('l4').status, 'verifying')
assert.equal(engine.store.state.usage.sessions['sess-1'], 'b3')
// 模拟核实会话事件：header 归属模型 + assistant/message 用量入账
sessionEventHandler({ id: 'sess-1' }, { type: 'request/header', header: { config: { provider: 'deepseek', model: 'deepseek-flash' } } })
sessionEventHandler({ id: 'sess-1' }, { type: 'assistant/message', usage: { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 2000 } })
const urec = engine.store.state.usage.records
assert.equal(urec.length, 1)
assert.equal(urec[0].model, 'deepseek-flash')
assert.equal(urec[0].batchId, 'b3')
const expect = costOf({ inputTokens: 1000, outputTokens: 500, cacheReadTokens: 2000 }, 'deepseek-flash', urec[0].at, DEFAULT_PRICING)
assert.equal(urec[0].costCny, expect.costCny)
assert.equal(engine.store.state.usage.total.calls, 1)
assert.equal(engine.store.state.usage.batches.find(b => b.batchId === 'b3').calls, 1)
// 未登记会话的事件不入账
sessionEventHandler({ id: 'someone-else' }, { type: 'assistant/message', usage: { inputTokens: 9999, outputTokens: 9999 } })
assert.equal(engine.store.state.usage.records.length, 1)
// 快照形状（设上次跟进为 29 分钟前，间隔 30 分钟 → 下次最早在 1 分钟后）
engine.store.state.lastPatrolAt = Date.now() - 29 * 60000
const snap = engine.snapshot()
assert.equal(typeof snap.now, 'number')
assert.equal(snap.cards.length, 2)
assert.equal(snap.leadsPending, 1)
assert.deepEqual(snap.keywords, ['DeepSeek'])
assert.equal(snap.scheduleMode, 'all')
assert.equal(snap.window.inWindow, true)
assert.equal(snap.usage.today.calls, 1)
assert.equal(snap.usage.debug.recorded, 1)
assert.equal(snap.usage.debug.matched, 2)
assert.ok(snap.usage.debug.seen >= 3)
assert.ok(snap.patrol.nextEligibleAt >= Date.now())

// 回归：enabled=false 只挡自动跟进，手动不受限；守卫拒绝必须带 reason（面板显性化依赖）
const offEngine = new FollowEngine(fakeCtx, cfgStub({ keywords: v(['DeepSeek']), enabled: v(false) }))
await offEngine.store.load()
offEngine.doPatrol = async () => {} // 截断后台采集，只断言守卫
assert.equal(offEngine.runPatrol('idle').started, false)
assert.equal(offEngine.runPatrol('manual').started, true)
offEngine.running = false
const noKwEngine = new FollowEngine(fakeCtx, cfgStub({ keywords: v([]) }))
await noKwEngine.store.load()
noKwEngine.doPatrol = async () => {}
assert.ok(noKwEngine.runPatrol('manual').reason)

await rm(dir, { recursive: true, force: true })
await rm(dir2, { recursive: true, force: true })
console.log('SMOKE OK: store / config / overall / publish / dispatch / schedule / pricing / usage / snapshot')