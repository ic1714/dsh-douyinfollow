import type { Volatile } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

/** 插件配置：全部 volatile，既进设置页表单，也支持运行中热读取。 */
export interface Config {
  enabled: Volatile<boolean>
  keywords: Volatile<string[]>
  intervalMinutes: Volatile<number>
  idleQuietSeconds: Volatile<number>
  maxVideosPerPatrol: Volatile<number>
  ocrEnabled: Volatile<boolean>
  aiSummaryEnabled: Volatile<boolean>
  frameCount: Volatile<number>
  headlessPatrol: Volatile<boolean>
  browserChannel: Volatile<string>
  dataDir: Volatile<string>
  loginTimeoutSeconds: Volatile<number>
  retentionCards: Volatile<number>
}

export const Config = Schema.object({
  enabled: Schema.boolean().default(true).volatile().description('启用空闲自动巡查'),
  keywords: Schema.array(Schema.string()).default([]).volatile().description('追踪的话题关键词（搜索抖音相关视频，不盯账号）'),
  intervalMinutes: Schema.number().min(5).default(60).volatile().description('两次巡查的最小间隔（分钟）'),
  idleQuietSeconds: Schema.number().min(10).default(120).volatile().description('判定空闲所需的静默秒数（无 agent 轮次进行中）'),
  maxVideosPerPatrol: Schema.number().min(1).max(20).default(6).volatile().description('每次巡查最多采集的新视频数'),
  ocrEnabled: Schema.boolean().default(true).volatile().description('对关键帧做文字识别（画面字幕/界面文字）'),
  aiSummaryEnabled: Schema.boolean().default(true).volatile().description('优先取抖音内置 AI 讲解摘要作为补充'),
  frameCount: Schema.number().min(1).max(6).default(2).volatile().description('每个视频抽取的关键帧数（越多越耗 CPU）'),
  headlessPatrol: Schema.boolean().default(false).volatile().description('巡查用无头浏览器（实测无头/屏外窗口均被风控验证码拦截，保持 false；有头自动缩右下角小窗）'),
  browserChannel: Schema.string().default('msedge').volatile().description('系统浏览器通道：msedge / chrome / chromium'),
  dataDir: Schema.string().default('').volatile().description('数据目录（留空用 $DSH_HOME/plugin-data/dsh-douyin-radar）'),
  loginTimeoutSeconds: Schema.number().min(30).default(180).volatile().description('扫码登录等待超时（秒）'),
  retentionCards: Schema.number().min(20).default(200).volatile().description('卡片保留上限'),
})

/** 运行中读取的配置快照（每次操作开始时取一次）。 */
export interface RadarConfig {
  enabled: boolean
  keywords: string[]
  intervalMinutes: number
  idleQuietSeconds: number
  maxVideosPerPatrol: number
  ocrEnabled: boolean
  aiSummaryEnabled: boolean
  frameCount: number
  headlessPatrol: boolean
  browserChannel: string
  dataDir: string
  loginTimeoutSeconds: number
  retentionCards: number
}

export function readConfig(config: Config): RadarConfig {
  return {
    enabled: config.enabled.get() ?? true,
    keywords: (config.keywords.get() ?? []).map(k => k.trim()).filter(Boolean),
    intervalMinutes: config.intervalMinutes.get() ?? 60,
    idleQuietSeconds: config.idleQuietSeconds.get() ?? 120,
    maxVideosPerPatrol: config.maxVideosPerPatrol.get() ?? 6,
    ocrEnabled: config.ocrEnabled.get() ?? true,
    aiSummaryEnabled: config.aiSummaryEnabled.get() ?? true,
    frameCount: config.frameCount.get() ?? 2,
    headlessPatrol: config.headlessPatrol.get() ?? false,
    browserChannel: config.browserChannel.get() ?? 'msedge',
    dataDir: config.dataDir.get() ?? '',
    loginTimeoutSeconds: config.loginTimeoutSeconds.get() ?? 180,
    retentionCards: config.retentionCards.get() ?? 200,
  }
}