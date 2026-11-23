import type { Context } from '@deepseek-ai/cordis'
import { Config } from './config.js'
import { FollowEngine } from './engine.js'
import { registerRoutes } from './routes.js'
import { registerTools } from './tools.js'

export const name = 'douyinfollow'

/** tools/webServer/schedule 均为官方 Web 组合（含桌面端）自带服务。 */
export const inject = ['tools', 'webServer', 'schedule']

export { Config }

export function apply(ctx: Context, config: Config): void {
  const engine = new FollowEngine(ctx, config)
  registerTools(ctx, engine)
  const disposeRoutes = registerRoutes(ctx, engine)
  ctx.effect(() => () => {
    disposeRoutes()
    void engine.dispose()
  }, 'douyin-follow lifecycle')
  void engine.start()
}