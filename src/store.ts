import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { emptyState, type Card, type Lead, type PatrolRecord, type RadarPrefs, type RadarState } from './types.js'

const SEEN_CAP = 5000
const LEAD_CAP = 400
const PATROL_CAP = 60

/** 偏好清洗：关键词去空去重限长，间隔夹到合法区间。 */
export function sanitizePrefs(raw: unknown): RadarPrefs {
  const out: RadarPrefs = {}
  if (!raw || typeof raw !== 'object') return out
  const p = raw as Record<string, unknown>
  if (typeof p.enabled === 'boolean') out.enabled = p.enabled
  if (Array.isArray(p.keywords)) {
    out.keywords = [...new Set(p.keywords.filter((k): k is string => typeof k === 'string').map(k => k.trim()).filter(Boolean))].slice(0, 20).map(k => k.slice(0, 40))
  }
  if (typeof p.intervalMinutes === 'number' && Number.isFinite(p.intervalMinutes)) {
    out.intervalMinutes = Math.min(1440, Math.max(5, Math.round(p.intervalMinutes)))
  }
  return out
}

/**
 * 本地 JSON 存储：已看视频去重、线索、卡片、巡查记录。
 * 写入走 tmp + rename 原子替换，避免崩溃留下半截文件。
 */
export class RadarStore {
  readonly file: string
  state: RadarState = emptyState()
  private seenSet = new Set<string>()
  private saving: Promise<void> = Promise.resolve()

  constructor(readonly dir: string) {
    this.file = join(dir, 'state.json')
  }

  async load(): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    try {
      const raw = await readFile(this.file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<RadarState>
      this.state = {
        seen: Array.isArray(parsed.seen) ? parsed.seen.filter(x => typeof x === 'string') : [],
        leads: Array.isArray(parsed.leads) ? parsed.leads : [],
        cards: Array.isArray(parsed.cards) ? parsed.cards : [],
        patrols: Array.isArray(parsed.patrols) ? parsed.patrols : [],
        lastPatrolAt: typeof parsed.lastPatrolAt === 'number' ? parsed.lastPatrolAt : undefined,
        prefs: sanitizePrefs(parsed.prefs),
      }
    } catch {
      this.state = emptyState()
    }
    this.seenSet = new Set(this.state.seen)
  }

  /** 串行化写盘，后一次覆盖前一次。 */
  save(): Promise<void> {
    this.state.seen = [...this.seenSet].slice(-SEEN_CAP)
    this.seenSet = new Set(this.state.seen)
    this.state.leads = this.state.leads.slice(-LEAD_CAP)
    this.state.patrols = this.state.patrols.slice(-PATROL_CAP)
    const snapshot = JSON.stringify(this.state)
    this.saving = this.saving.then(async () => {
      const tmp = `${this.file}.tmp`
      await writeFile(tmp, snapshot, 'utf8')
      await rename(tmp, this.file)
    }).catch(() => undefined)
    return this.saving
  }

  hasSeen(videoId: string): boolean {
    return this.seenSet.has(videoId)
  }

  markSeen(videoIds: string[]): void {
    for (const id of videoIds) this.seenSet.add(id)
  }

  addLeads(leads: Lead[]): void {
    this.state.leads.push(...leads)
  }

  getLead(id: string): Lead | undefined {
    return this.state.leads.find(l => l.id === id)
  }

  leadsOfBatch(batchId: string): Lead[] {
    return this.state.leads.filter(l => l.batchId === batchId)
  }

  pendingLeads(): Lead[] {
    return this.state.leads.filter(l => l.status === 'pending' || l.status === 'verifying')
  }

  addCard(card: Card, retention: number): void {
    this.state.cards.push(card)
    if (this.state.cards.length > retention) {
      this.state.cards = this.state.cards.slice(-retention)
    }
  }

  getCard(id: string): Card | undefined {
    return this.state.cards.find(c => c.id === id)
  }

  addPatrol(record: PatrolRecord): void {
    this.state.patrols.push(record)
  }

  finishPatrol(id: string, patch: Partial<PatrolRecord>): void {
    const rec = this.state.patrols.find(p => p.id === id)
    if (rec) Object.assign(rec, patch)
  }
}