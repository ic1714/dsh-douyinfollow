import type { Context } from '@deepseek-ai/cordis';
import type { FollowEngine } from './engine.js';
export declare const STATE_PATH = "/plugin-data/douyinfollow/state";
export declare const ACTION_PATH = "/plugin-data/douyinfollow/action";
/**
 * 面板数据通道：沿用生态惯例 /plugin-data/<pkg>/*，客户端 fetch 轮询 + POST 动作。
 * 仅接受 loopback 来源（DSH web 服务默认绑定 loopback）。
 */
export declare function registerRoutes(ctx: Context, engine: FollowEngine): () => void;
