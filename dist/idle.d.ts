import type { Context } from '@deepseek-ai/cordis';
/**
 * 空闲检测：监听持久化会话事件的轮次边界。
 * 有任一 agent 轮次进行中即视为忙；全部结束后再静默 quietMs 才算空闲。
 */
export declare class ActivityTracker {
    busy: number;
    lastActivityAt: number;
    attach(ctx: Context): void;
    isIdle(quietMs: number): boolean;
}
