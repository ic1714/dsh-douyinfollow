import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-tools'
import type { RadarEngine } from './engine.js'
import { FACT_LABEL, OVERALL_LABEL, type Lead } from './types.js'

const text = (s: string) => [{ type: 'text' as const, text: s }]

/** canonical output 要求无损 JSON：去掉 undefined 字段并抹平接口索引签名差异。 */
const json = (v: unknown): any => JSON.parse(JSON.stringify(v))

function leadView(l: Lead) {
  return {
    id: l.id,
    batchId: l.batchId,
    keyword: l.keyword,
    status: l.status,
    skipReason: l.skipReason,
    collectedAt: l.collectedAt,
    video: l.video,
    desc: l.desc.slice(0, 1200),
    aiSummary: l.aiSummary?.slice(0, 1500),
    ocrText: l.ocrText?.slice(0, 1200),
  }
}

/** 面向模型的工具：巡查、线索、核实回写、卡片管理、登录。 */
export function registerTools(ctx: Context, engine: RadarEngine): void {
  ctx.tools.register(defineTool({
    name: 'douyin_radar_status',
    description: '查看抖音进展雷达状态：登录态、空闲情况、巡查进度、待核实线索数、最近卡片与巡查记录。',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: (_args, value) => {
        const s = value as unknown as ReturnType<RadarEngine['snapshot']>
        return text([
          `启用=${s.enabled} 登录=${s.login.loggedIn} 空闲=${s.idle.idle} 巡查中=${s.patrol.running}`,
          `关键词=${s.keywords.join('、') || '(未设置)'} 间隔=${s.intervalMinutes}分钟 待核实=${s.leadsPending}`,
          s.patrol.last ? `上次巡查：新增${s.patrol.last.added}/发现${s.patrol.last.found}${s.patrol.last.error ? ' 错误=' + s.patrol.last.error : ''}` : '尚未巡查',
        ].join('\n'))
      },
    },
    async execute() {
      return json(engine.snapshot())
    },
  }))

  ctx.tools.register(defineTool({
    name: 'douyin_radar_patrol',
    description: '立即触发一次抖音话题巡查（后台执行）：搜索关键词相关新视频，采集标题/文案/AI讲解/画面文字，生成待核实线索并派发核实会话。',
    parameters: {
      reason: { type: 'string', description: '触发原因（可选，仅记录）' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => {
        const v = value as { started: boolean; patrolId?: string; reason?: string }
        return text(v.started ? `巡查已启动：${v.patrolId}` : `未启动：${v.reason}`)
      },
    },
    async execute() {
      return engine.runPatrol('tool')
    },
  }))

  ctx.tools.register(defineTool({
    name: 'douyin_radar_leads',
    description: '读取待核实线索（视频标题/文案/AI讲解/画面文字）。核实编排员按 batchId 取本批次线索。',
    parameters: {
      batchId: { type: 'string', description: '巡查批次 id（可选；缺省返回全部待核实）' },
      status: { type: 'string', enum: ['pending', 'verifying', 'published', 'skipped'], description: '按状态过滤（可选）' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => {
        const leads = value as unknown as ReturnType<typeof leadView>[]
        return text(leads.length === 0 ? '没有匹配的线索' : leads.map(l => `[${l.status}] ${l.keyword} | ${l.video.title} | ${l.video.url}`).join('\n'))
      },
    },
    async execute(args) {
      let leads = engine.store.state.leads
      if (args.batchId) leads = leads.filter(l => l.batchId === args.batchId)
      if (args.status) leads = leads.filter(l => l.status === args.status)
      else leads = leads.filter(l => l.status === 'pending' || l.status === 'verifying')
      return json(leads.slice(-40).map(leadView))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'douyin_radar_publish',
    description: '核实完成后发布进展卡片到侧栏面板。facts 每条必须带核实状态与权威来源 URL；营销话术归 marketing；overall 由服务端按事实状态重算。',
    parameters: {
      leadId: { type: 'string', required: true, description: '线索 id' },
      headline: { type: 'string', required: true, description: '卡面一句话进展' },
      keyword: { type: 'string', description: '话题关键词（缺省用线索自带）' },
      facts: {
        type: 'array',
        required: true,
        description: '事实点列表',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            claim: { type: 'string', required: true, description: '可核实的事实陈述' },
            status: { type: 'string', required: true, enum: ['verified', 'contradicted', 'unverified'], description: '核实状态' },
            sources: {
              type: 'array',
              description: '权威来源（GitHub/官网/官方文档等）',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  url: { type: 'string', required: true },
                  title: { type: 'string' },
                },
              },
            },
            note: { type: 'string', description: '证据说明 / 缺什么证据' },
          },
        },
      },
      marketing: { type: 'string', description: '博主营销夸大表述（单独归类）' },
      summary: { type: 'string', description: '视频内容概述' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => {
        const v = value as { cardId?: string; reason?: string }
        return text(v.cardId ? `卡片已发布：${v.cardId}` : `发布失败：${v.reason}`)
      },
    },
    async execute(args) {
      return engine.publish({
        leadId: args.leadId,
        headline: args.headline,
        keyword: args.keyword,
        facts: (args.facts ?? []).map(f => ({
          claim: f.claim,
          status: f.status,
          sources: f.sources ?? [],
          note: f.note,
        })),
        marketing: args.marketing,
        summary: args.summary,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'douyin_radar_skip',
    description: '跳过与关键词无关或无核实价值的线索。',
    parameters: {
      leadId: { type: 'string', required: true },
      reason: { type: 'string', description: '跳过理由' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => text((value as { skipped: boolean }).skipped ? '已跳过' : '跳过失败：线索不存在或已发布'),
    },
    async execute(args) {
      return { skipped: engine.skipLead(args.leadId, args.reason) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'douyin_radar_cards',
    description: '读取已发布的进展卡片（含事实点与核实来源）。',
    parameters: {
      limit: { type: 'number', description: '最多返回条数（默认 20）' },
      includeArchived: { type: 'boolean', description: '是否包含已归档（默认 false）' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => {
        const cards = value as { id: string; headline: string; overall: keyof typeof OVERALL_LABEL; keyword: string }[]
        return text(cards.length === 0 ? '暂无卡片' : cards.map(c => `[${OVERALL_LABEL[c.overall]}] ${c.keyword} | ${c.headline}`).join('\n'))
      },
    },
    async execute(args) {
      const limit = args.limit ?? 20
      let cards = [...engine.store.state.cards].sort((a, b) => b.createdAt - a.createdAt)
      if (!args.includeArchived) cards = cards.filter(c => !c.archived)
      return json(cards.slice(0, limit))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'douyin_radar_login',
    description: '打开有头浏览器供用户扫码登录抖音（登录态持久化在插件 profile）。异步等待，用 douyin_radar_status 查看结果。',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: () => text('登录窗口已打开：请在弹出的浏览器中扫码登录抖音。'),
    },
    async execute() {
      return engine.startLogin()
    },
  }))

  ctx.tools.register(defineTool({
    name: 'douyin_radar_verify',
    description: '对指定批次的待核实线索重新派发核实会话（例如上次派发失败或中断）。',
    parameters: {
      batchId: { type: 'string', required: true },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => {
        const v = value as { dispatched: boolean; reason?: string }
        return text(v.dispatched ? '核实会话已派发' : `未派发：${v.reason}`)
      },
    },
    async execute(args) {
      return engine.dispatchVerify(args.batchId)
    },
  }))
}

export { FACT_LABEL }