import type { Context } from '@deepseek-ai/cordis';
import { type PricingTable } from './pricing.js';
import type { FollowStore } from './store.js';
import { type UsageState, type UsageView } from './types.js';
/** 持久化状态清洗：旧版本 state.json 没有 usage 字段，损坏数据回落空态。 */
export declare function sanitizeUsage(raw: unknown): UsageState;
/**
 * 花费统计：只统计插件派发的核实会话。
 * 派发时登记 sessionId → batchId（new_once 创建即预留 sessionId），
 * 监听全局 session/event，从 assistant/message 的适配器精确用量计价入账。
 */
export declare class UsageTracker {
    private store;
    private pricing;
    /** 每个核实会话最近一次 request/header 的 provider/model（内存态即可，记录时落盘）。 */
    private models;
    constructor(store: FollowStore, pricing: () => PricingTable);
    attach(ctx: Context): void;
    /** 派发核实会话后登记归属；超出上限淘汰最旧登记。 */
    register(sessionId: string, batchId: string): void;
    private record;
    /** 面板 / 工具共用的用量视图。 */
    view(): UsageView;
}
