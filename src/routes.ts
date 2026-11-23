import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { FollowEngine } from './engine.js'
import { sanitizePrefs } from './store.js'

export const STATE_PATH = '/plugin-data/douyinfollow/state'
export const ACTION_PATH = '/plugin-data/douyinfollow/action'

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  let raw = ''
  for await (const chunk of req) raw += chunk
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

/**
 * 面板数据通道：沿用生态惯例 /plugin-data/<pkg>/*，客户端 fetch 轮询 + POST 动作。
 * 仅接受 loopback 来源（DSH web 服务默认绑定 loopback）。
 */
export function registerRoutes(ctx: Context, engine: FollowEngine): () => void {
  const guard = (req: IncomingMessage, res: ServerResponse): boolean => {
    const addr = req.socket?.remoteAddress ?? ''
    if (!LOOPBACK.has(addr)) {
      sendJson(res, 403, { error: 'loopback only' })
      return false
    }
    return true
  }
  const disposers: (() => void)[] = []

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: STATE_PATH,
    handler: (req, res) => {
      if (!guard(req, res)) return
      if ((req.method || 'GET').toUpperCase() !== 'GET') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }
      sendJson(res, 200, engine.snapshot())
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: ACTION_PATH,
    handler: async (req, res) => {
      if (!guard(req, res)) return
      if ((req.method || 'GET').toUpperCase() !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }
      const body = await readBody(req)
      if (!body) {
        sendJson(res, 400, { error: 'body must be a JSON object' })
        return
      }
      const action = typeof body.action === 'string' ? body.action : ''
      const str = (k: string) => (typeof body[k] === 'string' ? body[k] as string : '')
      try {
        switch (action) {
          case 'patrol':
            sendJson(res, 200, engine.runPatrol('manual'))
            return
          case 'login':
            sendJson(res, 200, engine.startLogin())
            return
          case 'human':
            sendJson(res, 200, engine.startHumanCheck())
            return
          case 'humanDone':
            sendJson(res, 200, engine.confirmHumanCheck())
            return
          case 'refreshLogin':
            sendJson(res, 200, { loggedIn: await engine.refreshLogin() })
            return
          case 'read': {
            const card = engine.store.getCard(str('cardId'))
            if (!card) { sendJson(res, 404, { error: 'card not found' }); return }
            card.read = true
            await engine.store.save()
            sendJson(res, 200, { ok: true })
            return
          }
          case 'readAll': {
            for (const card of engine.store.state.cards) card.read = true
            await engine.store.save()
            sendJson(res, 200, { ok: true })
            return
          }
          case 'archive':
          case 'unarchive': {
            const card = engine.store.getCard(str('cardId'))
            if (!card) { sendJson(res, 404, { error: 'card not found' }); return }
            card.archived = action === 'archive'
            if (card.archived) card.read = true
            await engine.store.save()
            sendJson(res, 200, { ok: true })
            return
          }
          case 'skipLead':
            sendJson(res, 200, { skipped: engine.skipLead(str('leadId'), str('reason')) })
            return
          case 'verify':
            sendJson(res, 200, await engine.dispatchVerify(str('batchId')))
            return
          case 'setConfig': {
            const raw: Record<string, unknown> = {}
            if (typeof body.enabled === 'boolean') raw.enabled = body.enabled
            if (typeof body.keywords === 'string') {
              raw.keywords = body.keywords.split(/[,，;；\n]/).map(s => s.trim()).filter(Boolean)
            } else if (Array.isArray(body.keywords)) {
              raw.keywords = body.keywords
            }
            if (typeof body.intervalMinutes === 'number') raw.intervalMinutes = body.intervalMinutes
            const prefs = sanitizePrefs(raw)
            engine.store.state.prefs = { ...engine.store.state.prefs, ...prefs }
            await engine.store.save()
            sendJson(res, 200, engine.snapshot())
            return
          }
          default:
            sendJson(res, 400, { error: `unknown action: ${action}` })
        }
      } catch (err) {
        sendJson(res, 500, { error: String((err as Error)?.message ?? err) })
      }
    },
  }))

  return () => { for (const d of disposers) d() }
}