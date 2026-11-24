/**
 * 花费计价：DeepSeek 官方 API 牌价（元/百万 token），峰谷自动判定，谷时 = 峰时一半。
 * DSH 纯按量计费，此口径即实际花费。价格表可经宿主配置 pricingJson 覆盖（峰时价）。
 * 默认价目来源：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/（2026-09-10 起生效）。
 */
/** 峰时单价（元/百万 token）：缓存命中输入 / 未命中输入 / 输出。 */
export interface ModelRates {
    cacheHit: number;
    cacheMiss: number;
    output: number;
}
export interface PricingTable {
    models: Record<string, ModelRates>;
    fallback: string;
}
export declare const DEFAULT_PRICING: PricingTable;
/** 模型名归一到价格表键；未知 deepseek 型号按 flash 档兜底。 */
export declare function normalizeModel(model?: string): string;
/** 解析宿主配置 pricingJson（{"models":{"模型":{cacheHit,cacheMiss,output}}}，峰时价）；非法回落默认。 */
export declare function parsePricing(json: string): PricingTable;
/** 取某模型在峰/谷时的单价（谷时 = 峰时一半）。 */
export declare function ratesFor(table: PricingTable, model: string | undefined, peak: boolean): ModelRates;
/**
 * 单次模型调用的花费（元）。
 * 适配器口径：inputTokens 为未命中缓存的输入，cacheReadTokens 为缓存命中输入，两者分桶计价。
 */
export declare function costOf(usage: {
    inputTokens: number;
    cacheReadTokens?: number;
    outputTokens: number;
}, model: string | undefined, at: number, table: PricingTable): {
    costCny: number;
    peak: boolean;
};
