import { isPeakBeijing } from './schedule.js'

/**
 * 花费计价：DeepSeek 官方 API 牌价（元/百万 token），峰谷自动判定，谷时 = 峰时一半。
 * DSH 纯按量计费，此口径即实际花费。价格表可经宿主配置 pricingJson 覆盖（峰时价）。
 * 默认价目来源：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/（2026-09-10 起生效）。
 */

/** 峰时单价（元/百万 token）：缓存命中输入 / 未命中输入 / 输出。 */
export interface ModelRates {
  cacheHit: number
  cacheMiss: number
  output: number
}

export interface PricingTable {
  models: Record<string, ModelRates>
  fallback: string
}

export const DEFAULT_PRICING: PricingTable = {
  models: {
    'deepseek-flash': { cacheHit: 0.04, cacheMiss: 2, output: 8 },
    'deepseek-v4-pro': { cacheHit: 0.30, cacheMiss: 9, output: 27 },
  },
  fallback: 'deepseek-flash',
}

/** 模型名归一到价格表键；未知 deepseek 型号按 flash 档兜底。 */
export function normalizeModel(model?: string): string {
  const m = String(model ?? '').toLowerCase()
  if (!m) return 'deepseek-flash'
  if (m.includes('pro') || m.includes('reasoner')) return 'deepseek-v4-pro'
  if (m.includes('flash') || m.includes('chat') || m.includes('deepseek')) return 'deepseek-flash'
  return m
}

/** 解析宿主配置 pricingJson（{"models":{"模型":{cacheHit,cacheMiss,output}}}，峰时价）；非法回落默认。 */
export function parsePricing(json: string): PricingTable {
  if (!json || !json.trim()) return DEFAULT_PRICING
  try {
    const raw = JSON.parse(json) as { models?: Record<string, Partial<ModelRates>> }
    if (!raw || typeof raw !== 'object' || !raw.models || typeof raw.models !== 'object') return DEFAULT_PRICING
    const models: Record<string, ModelRates> = { ...DEFAULT_PRICING.models }
    for (const [key, rates] of Object.entries(raw.models)) {
      if (!rates || typeof rates !== 'object') continue
      const base = models[normalizeModel(key)] ?? DEFAULT_PRICING.models[DEFAULT_PRICING.fallback]
      const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d)
      models[normalizeModel(key)] = {
        cacheHit: num(rates.cacheHit, base.cacheHit),
        cacheMiss: num(rates.cacheMiss, base.cacheMiss),
        output: num(rates.output, base.output),
      }
    }
    return { models, fallback: DEFAULT_PRICING.fallback }
  } catch {
    return DEFAULT_PRICING
  }
}

/** 取某模型在峰/谷时的单价（谷时 = 峰时一半）。 */
export function ratesFor(table: PricingTable, model: string | undefined, peak: boolean): ModelRates {
  const base = table.models[normalizeModel(model)] ?? table.models[table.fallback] ?? DEFAULT_PRICING.models[DEFAULT_PRICING.fallback]
  return peak ? base : { cacheHit: base.cacheHit / 2, cacheMiss: base.cacheMiss / 2, output: base.output / 2 }
}

/**
 * 单次模型调用的花费（元）。
 * 适配器口径：inputTokens 为未命中缓存的输入，cacheReadTokens 为缓存命中输入，两者分桶计价。
 */
export function costOf(
  usage: { inputTokens: number; cacheReadTokens?: number; outputTokens: number },
  model: string | undefined,
  at: number,
  table: PricingTable,
): { costCny: number; peak: boolean } {
  const peak = isPeakBeijing(new Date(at))
  const r = ratesFor(table, model, peak)
  const input = Number.isFinite(usage.inputTokens) ? Math.max(0, usage.inputTokens) : 0
  const cacheRead = Number.isFinite(usage.cacheReadTokens ?? 0) ? Math.max(0, usage.cacheReadTokens ?? 0) : 0
  const output = Number.isFinite(usage.outputTokens) ? Math.max(0, usage.outputTokens) : 0
  const costCny = (input * r.cacheMiss + cacheRead * r.cacheHit + output * r.output) / 1e6
  return { costCny, peak }
}