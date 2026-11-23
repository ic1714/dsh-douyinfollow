import type { Context } from '@deepseek-ai/cordis';
import type { FollowEngine } from './engine.js';
import { FACT_LABEL } from './types.js';
/** 面向模型的工具：巡查、线索、核实回写、卡片管理、登录。 */
export declare function registerTools(ctx: Context, engine: FollowEngine): void;
export { FACT_LABEL };
