/**
 * douyinfollow 共享类型：宿主与客户端面板共用的数据形状。
 * 视频只是线索来源；卡片上的事实点必须带权威来源核实状态。
 */

/** 单条事实点的核实状态。 */
export type FactStatus = 'verified' | 'contradicted' | 'unverified'

/** 卡片整体核实结论：全部核实 / 部分核实 / 与权威来源不符 / 无法核实。 */
export type OverallStatus = 'verified' | 'mixed' | 'contradicted' | 'unverified'

export interface FactSource {
  url: string
  title?: string
}

export interface Fact {
  /** 可核实的事实陈述（项目名、版本、功能、日期、数据等）。 */
  claim: string
  status: FactStatus
  /** 权威来源链接（GitHub / 官网 / 官方文档等）。unverified 时可为空。 */
  sources: FactSource[]
  note?: string
}

export interface VideoRef {
  videoId: string
  url: string
  title: string
  author: string
  publishText?: string
  keyword: string
}

/** 跟进采集到、等待核实编排处理的原始线索。 */
export interface Lead {
  id: string
  batchId: string
  keyword: string
  video: VideoRef
  collectedAt: number
  desc: string
  aiSummary?: string
  ocrText?: string
  status: 'pending' | 'verifying' | 'published' | 'skipped'
  skipReason?: string
}

/** 推送给侧栏面板的进展卡片。 */
export interface Card {
  id: string
  leadId: string
  /** 来源核实批次（用于卡片详情展示批次花费；旧卡片可能缺失）。 */
  batchId?: string
  keyword: string
  /** 卡面一句话进展。 */
  headline: string
  createdAt: number
  read: boolean
  archived: boolean
  video: VideoRef
  facts: Fact[]
  /** 博主营销话术 / 夸大表述，单独归类，不混入事实。 */
  marketing?: string
  /** 视频内容概述（只求“这视频在说什么”）。 */
  summary?: string
  overall: OverallStatus
}

export interface PatrolRecord {
  id: string
  startedAt: number
  finishedAt?: number
  keywords: string[]
  found: number
  added: number
  error?: string
  trigger: 'idle' | 'manual' | 'tool'
}

/** 自动跟进时间段模式：全天 / 谷时（官方峰时取反）/ 峰时 / 自定义每日窗口。 */
export type ScheduleMode = 'all' | 'offpeak' | 'peak' | 'custom'

/** 单次核实模型调用的用量与花费记录。 */
export interface UsageRecord {
  at: number
  sessionId: string
  batchId: string
  provider?: string
  model?: string
  /** 未命中缓存的输入 token（适配器分桶口径）。 */
  inputTokens: number
  cacheReadTokens: number
  outputTokens: number
  reasoningTokens?: number
  /** 请求时刻是否官方峰时（北京时间）。 */
  peak: boolean
  costCny: number
}

/** 按本地日期聚合的用量。 */
export interface UsageDaily {
  date: string
  calls: number
  inputTokens: number
  cacheReadTokens: number
  outputTokens: number
  costCny: number
}

/** 按核实批次聚合的用量（卡片详情展示批次花费用）。 */
export interface UsageBatch {
  batchId: string
  firstAt: number
  lastAt: number
  calls: number
  inputTokens: number
  cacheReadTokens: number
  outputTokens: number
  costCny: number
  model?: string
}

export interface UsageTotals {
  calls: number
  inputTokens: number
  cacheReadTokens: number
  outputTokens: number
  costCny: number
}

/** 花费统计持久化状态。 */
export interface UsageState {
  /** 插件派发的核实会话 sessionId → batchId 归属映射（重启后仍可归属）。 */
  sessions: Record<string, string>
  records: UsageRecord[]
  daily: UsageDaily[]
  batches: UsageBatch[]
  total: UsageTotals
}

/** 面板 / 工具共用的用量视图。 */
export interface UsageView {
  today: UsageTotals
  last7: UsageTotals
  total: UsageTotals
  batches: UsageBatch[]
}

export function emptyUsage(): UsageState {
  return { sessions: {}, records: [], daily: [], batches: [], total: { calls: 0, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, costCny: 0 } }
}

/** 本地持久化状态（state.json）。 */
export interface FollowState {
  seen: string[]
  leads: Lead[]
  cards: Card[]
  patrols: PatrolRecord[]
  lastPatrolAt?: number
  prefs?: FollowPrefs
  usage: UsageState
}

/** 面板内可改的运行偏好（覆盖宿主配置默认值，存于 state.json）。 */
export interface FollowPrefs {
  enabled?: boolean
  keywords?: string[]
  intervalMinutes?: number
  scheduleMode?: ScheduleMode
  activeWindows?: string[]
}

/** 面板 / 路由 / 工具共用的运行时快照。 */
export interface FollowSnapshot {
  now: number
  enabled: boolean
  keywords: string[]
  intervalMinutes: number
  scheduleMode: ScheduleMode
  activeWindows: string[]
  /** 自动跟进时间段状态（手动跟进不受窗口约束）。 */
  window: { inWindow: boolean; nextOpenAt?: number }
  login: { loggedIn: boolean; loggingIn: boolean; error?: string }
  human: { checking: boolean; error?: string }
  idle: { busy: number; lastActivityAt: number; idle: boolean }
  patrol: { running: boolean; current?: PatrolRecord; last?: PatrolRecord; nextEligibleAt?: number }
  leadsPending: number
  leads: Lead[]
  cards: Card[]
  patrols: PatrolRecord[]
  ocrReady: boolean
  usage: UsageView
}

export function emptyState(): FollowState {
  return { seen: [], leads: [], cards: [], patrols: [], prefs: {}, usage: emptyUsage() }
}

export function overallOf(facts: Fact[]): OverallStatus {
  if (facts.length === 0) return 'unverified'
  if (facts.some(f => f.status === 'contradicted')) return 'contradicted'
  if (facts.every(f => f.status === 'verified')) return 'verified'
  if (facts.some(f => f.status === 'verified')) return 'mixed'
  return 'unverified'
}

export const OVERALL_LABEL: Record<OverallStatus, string> = {
  verified: '已核实',
  mixed: '部分核实',
  contradicted: '与权威来源不符',
  unverified: '无法核实',
}

export const FACT_LABEL: Record<FactStatus, string> = {
  verified: '已核实',
  contradicted: '不符',
  unverified: '无法核实',
}