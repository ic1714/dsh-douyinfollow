// 本地逻辑自测：不启动浏览器、不连接 DSH，验证存储/配置/发布/派发等确定性逻辑。
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readConfig } from '../dist/config.js'
import { FollowEngine } from '../dist/engine.js'
import { FollowStore } from '../dist/store.js'
import { overallOf } from '../dist/types.js'

const dir = await mkdtemp(join(tmpdir(), 'follow-smoke-'))
const dir2 = await mkdtemp(join(tmpdir(), 'follow-smoke2-'))

// 1. 存储往返与去重
const store = new FollowStore(dir)
await store.load()
store.markSeen(['v1', 'v2'])
assert.equal(store.hasSeen('v1'), true)
assert.equal(store.hasSeen('v3'), false)
const lead = {
  id: 'l1', batchId: 'b1', keyword: 'DeepSeek', collectedAt: Date.now(),
  video: { videoId: 'v1', url: 'https://www.douyin.com/video/v1', title: 't', author: 'a', keyword: 'DeepSeek' },
  desc: 'd', status: 'pending',
}
store.addLeads([lead])
await store.save()
const store2 = new FollowStore(dir)
await store2.load()
assert.equal(store2.hasSeen('v1'), true)
assert.equal(store2.state.leads.length, 1)

// 2. overall 重算规则
assert.equal(overallOf([]), 'unverified')
assert.equal(overallOf([{ claim: 'c', status: 'verified', sources: [] }]), 'verified')
assert.equal(overallOf([{ claim: 'c', status: 'verified', sources: [] }, { claim: 'd', status: 'unverified', sources: [] }]), 'mixed')
assert.equal(overallOf([{ claim: 'c', status: 'contradicted', sources: [] }]), 'contradicted')

// 3. 配置快照（volatile stub）
const v = x => ({ get: () => x })
const cfg = readConfig({
  enabled: v(true), keywords: v([' DeepSeek ', '']), intervalMinutes: v(30), idleQuietSeconds: v(60),
  maxVideosPerPatrol: v(4), ocrEnabled: v(false), aiSummaryEnabled: v(true), frameCount: v(2),
  headlessPatrol: v(true), browserChannel: v('msedge'), dataDir: v(dir2), loginTimeoutSeconds: v(120), retentionCards: v(50),
})
assert.deepEqual(cfg.keywords, ['DeepSeek'])
assert.equal(cfg.intervalMinutes, 30)
assert.equal(cfg.ocrEnabled, false)

// 4. 引擎：发布/重算/跳过/派发（fake ctx，不触网）
const fakeCtx = {
  on: () => () => {},
  effect: () => () => {},
  schedule: {
    create: async () => ({ id: 'task-1' }),
    deleteInactive: async () => ({ deleted: 0 }),
  },
}
const engine = new FollowEngine(fakeCtx, {
  enabled: v(true), keywords: v(['DeepSeek']), intervalMinutes: v(30), idleQuietSeconds: v(60),
  maxVideosPerPatrol: v(4), ocrEnabled: v(false), aiSummaryEnabled: v(true), frameCount: v(2),
  headlessPatrol: v(true), browserChannel: v('msedge'), dataDir: v(dir2), loginTimeoutSeconds: v(120), retentionCards: v(50),
})
await engine.store.load()
engine.store.addLeads([
  { ...lead, id: 'l2', batchId: 'b2' },
  { ...lead, id: 'l3', batchId: 'b2', video: { ...lead.video, videoId: 'v9' } },
])
const pub = engine.publish({
  leadId: 'l2', headline: 'DeepSeek 发布新版本',
  facts: [{ claim: '版本 0.2 已发布', status: 'verified', sources: [{ url: 'https://github.com/deepseek-ai/deepseek-harness/releases' }] }],
  marketing: '博主称“碾压一切”',
})
assert.ok(pub.cardId)
const card = engine.store.getCard(pub.cardId)
assert.equal(card.overall, 'verified')
assert.equal(card.marketing, '博主称“碾压一切”')
assert.equal(engine.store.getLead('l2').status, 'published')
assert.ok(engine.publish({ leadId: 'l2', headline: 'dup', facts: [] }).reason)
// 非法来源 URL 被过滤
const pub2 = engine.publish({ leadId: 'l3', headline: 'h', facts: [{ claim: 'c', status: 'verified', sources: [{ url: 'javascript:alert(1)' }] }] })
assert.equal(engine.store.getCard(pub2.cardId).facts[0].sources.length, 0)
assert.equal(engine.store.getCard(pub2.cardId).overall, 'unverified')
// 派发核实：pending → verifying
engine.store.addLeads([{ ...lead, id: 'l4', batchId: 'b3', video: { ...lead.video, videoId: 'v10' } }])
const disp = await engine.dispatchVerify('b3')
assert.equal(disp.dispatched, true)
assert.equal(disp.taskId, 'task-1')
assert.equal(engine.store.getLead('l4').status, 'verifying')
// 快照形状
const snap = engine.snapshot()
assert.equal(typeof snap.now, 'number')
assert.equal(snap.cards.length, 2)
assert.equal(snap.leadsPending, 1)
assert.deepEqual(snap.keywords, ['DeepSeek'])

await rm(dir, { recursive: true, force: true })
await rm(dir2, { recursive: true, force: true })
console.log('SMOKE OK: store / config / overall / publish / dispatch / snapshot')