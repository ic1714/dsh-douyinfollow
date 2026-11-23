import type { Context } from '@deepseek-ai/cordis';
import { Config } from './config.js';
export declare const name = "douyinfollow";
/** tools/webServer/schedule 均为官方 Web 组合（含桌面端）自带服务。 */
export declare const inject: string[];
export { Config };
export declare function apply(ctx: Context, config: Config): void;
