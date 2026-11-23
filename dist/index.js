import { Config } from './config.js';
import { RadarEngine } from './engine.js';
import { registerRoutes } from './routes.js';
import { registerTools } from './tools.js';
export const name = 'dsh-douyin-radar';
/** tools/webServer/schedule 均为官方 Web 组合（含桌面端）自带服务。 */
export const inject = ['tools', 'webServer', 'schedule'];
export { Config };
export function apply(ctx, config) {
    const engine = new RadarEngine(ctx, config);
    registerTools(ctx, engine);
    const disposeRoutes = registerRoutes(ctx, engine);
    ctx.effect(() => () => {
        disposeRoutes();
        void engine.dispose();
    }, 'douyin-radar lifecycle');
    void engine.start();
}
