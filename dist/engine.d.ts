import type { Context } from '@deepseek-ai/cordis';
import { DouyinBrowser } from './browser.js';
import { type Config, type RadarConfig } from './config.js';
import { ActivityTracker } from './idle.js';
import { FrameOcr } from './ocr.js';
import { RadarStore } from './store.js';
import { type Fact, type PatrolRecord, type RadarSnapshot } from './types.js';
export interface PublishInput {
    leadId: string;
    headline: string;
    keyword?: string;
    facts: Fact[];
    marketing?: string;
    summary?: string;
}
export declare function resolveDataDir(cfg: RadarConfig): string;
/**
 * 核心引擎：空闲巡查 → 采集 → 线索入库 → 派发独立会话做权威核实 → 卡片入面板。
 * 浏览器与核实会话都在后台运行，不打断前台对话。
 */
export declare class RadarEngine {
    private ctx;
    private config;
    readonly store: RadarStore;
    readonly browser: DouyinBrowser;
    readonly ocr: FrameOcr;
    readonly tracker: ActivityTracker;
    private timer?;
    private running;
    private current?;
    private loggedIn;
    private disposed;
    constructor(ctx: Context, config: Config);
    cfg(): RadarConfig;
    start(): Promise<void>;
    /** 插件卸载时由入口的 ctx.effect 调用。 */
    dispose(): Promise<void>;
    refreshLogin(): Promise<boolean>;
    /** 面板/工具触发扫码登录；成功后立即回写登录态，不等下一次复查。 */
    startLogin(): {
        started: boolean;
    };
    /** 风控拦截时开有头窗口请用户人工过验证；成功后信任态留在 profile。 */
    startHumanCheck(): {
        started: boolean;
    };
    private tick;
    /** 前台窗口是否全屏（60 秒缓存，避免每 tick 起进程）；顺带记录前台 hwnd 供归还焦点。 */
    private fgCache?;
    private foregroundFullscreen;
    /** 触发一次巡查；守卫同步返回，采集在后台继续。 */
    runPatrol(trigger: PatrolRecord['trigger']): {
        started: boolean;
        patrolId?: string;
        reason?: string;
    };
    private doPatrol;
    /** 派发一个独立后台会话做事实核实（宿主 Schedule 投递，复用会话时等待其空闲）。 */
    dispatchVerify(batchId: string): Promise<{
        dispatched: boolean;
        taskId?: string;
        reason?: string;
    }>;
    /** 核实员回写卡片。overall 由事实状态服务端重算，不信任回写值。 */
    publish(input: PublishInput): {
        cardId?: string;
        reason?: string;
    };
    skipLead(leadId: string, reason?: string): boolean;
    snapshot(): RadarSnapshot;
}
