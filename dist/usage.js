import { costOf } from './pricing.js';
import { emptyUsage, } from './types.js';
const RECORD_CAP = 1000;
const DAILY_CAP = 400;
const BATCH_CAP = 200;
const SESSION_CAP = 300;
function dateKey(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
/** 持久化状态清洗：旧版本 state.json 没有 usage 字段，损坏数据回落空态。 */
export function sanitizeUsage(raw) {
    const out = emptyUsage();
    if (!raw || typeof raw !== 'object')
        return out;
    const u = raw;
    if (u.sessions && typeof u.sessions === 'object') {
        for (const [sid, bid] of Object.entries(u.sessions)) {
            if (typeof sid === 'string' && typeof bid === 'string')
                out.sessions[sid] = bid;
        }
    }
    if (Array.isArray(u.records)) {
        out.records = u.records.filter((r) => !!r && typeof r === 'object' && typeof r.sessionId === 'string' && typeof r.batchId === 'string')
            .slice(-RECORD_CAP);
    }
    if (Array.isArray(u.daily)) {
        out.daily = u.daily.filter((d) => !!d && typeof d === 'object' && typeof d.date === 'string').slice(-DAILY_CAP);
    }
    if (Array.isArray(u.batches)) {
        out.batches = u.batches.filter((b) => !!b && typeof b === 'object' && typeof b.batchId === 'string').slice(-BATCH_CAP);
    }
    if (u.total && typeof u.total === 'object') {
        const t = u.total;
        out.total = { calls: num(t.calls), inputTokens: num(t.inputTokens), cacheReadTokens: num(t.cacheReadTokens), outputTokens: num(t.outputTokens), costCny: num(t.costCny) };
    }
    return out;
}
function zeroTotals() {
    return { calls: 0, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, costCny: 0 };
}
function addTotals(t, r) {
    t.calls += r.calls ?? 1;
    t.inputTokens += r.inputTokens;
    t.cacheReadTokens += r.cacheReadTokens;
    t.outputTokens += r.outputTokens;
    t.costCny += r.costCny;
}
/**
 * 花费统计：只统计插件派发的核实会话。
 * 派发时登记 sessionId → batchId（new_once 创建即预留 sessionId），
 * 监听全局 session/event，从 assistant/message 的适配器精确用量计价入账。
 */
export class UsageTracker {
    store;
    pricing;
    /** 每个核实会话最近一次 request/header 的 provider/model（内存态即可，记录时落盘）。 */
    models = new Map();
    /** 事件诊断计数（内存态）：收到 / 归属命中 / 入账，供面板与工具排查「有跑动没计费」。 */
    seen = 0;
    matched = 0;
    constructor(store, pricing) {
        this.store = store;
        this.pricing = pricing;
    }
    attach(ctx) {
        // 会话事件按 dsh-scope 作用域链路由，插件 ctx 不在会话 scope 的祖先链上，
        // 必须 global:true 绕过上下文过滤，否则归属登记成功但事件永远不到（v2/v3 今日¥0.00 的根因）。
        ctx.on('session/event', (session, event) => {
            this.seen += 1;
            const sid = String(session.id ?? '');
            const batchId = this.store.state.usage.sessions[sid];
            if (!batchId)
                return;
            this.matched += 1;
            const type = event.type;
            if (type === 'request/header') {
                const config = event.header?.config;
                if (config && typeof config.model === 'string') {
                    this.models.set(sid, {
                        provider: typeof config.provider === 'string' ? config.provider : undefined,
                        model: config.model,
                    });
                }
            }
            else if (type === 'assistant/message') {
                const usage = event.usage;
                if (!usage || typeof usage.inputTokens !== 'number' || typeof usage.outputTokens !== 'number')
                    return;
                this.record(sid, batchId, {
                    inputTokens: usage.inputTokens,
                    outputTokens: usage.outputTokens,
                    cacheReadTokens: typeof usage.cacheReadTokens === 'number' ? usage.cacheReadTokens : 0,
                    reasoningTokens: typeof usage.reasoningTokens === 'number' ? usage.reasoningTokens : undefined,
                });
            }
        }, { global: true });
    }
    /** 派发核实会话后登记归属；超出上限淘汰最旧登记。 */
    register(sessionId, batchId) {
        const u = this.store.state.usage;
        u.sessions[sessionId] = batchId;
        const keys = Object.keys(u.sessions);
        if (keys.length > SESSION_CAP) {
            for (const k of keys.slice(0, keys.length - SESSION_CAP))
                delete u.sessions[k];
        }
        void this.store.save();
    }
    record(sid, batchId, usage) {
        const at = Date.now();
        const route = this.models.get(sid);
        const { costCny, peak } = costOf(usage, route?.model, at, this.pricing());
        const rec = {
            at, sessionId: sid, batchId,
            provider: route?.provider, model: route?.model,
            inputTokens: usage.inputTokens, cacheReadTokens: usage.cacheReadTokens,
            outputTokens: usage.outputTokens, reasoningTokens: usage.reasoningTokens,
            peak, costCny,
        };
        const u = this.store.state.usage;
        u.records.push(rec);
        if (u.records.length > RECORD_CAP)
            u.records = u.records.slice(-RECORD_CAP);
        const key = dateKey(at);
        let daily = u.daily.find(d => d.date === key);
        if (!daily) {
            daily = { date: key, calls: 0, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, costCny: 0 };
            u.daily.push(daily);
            if (u.daily.length > DAILY_CAP)
                u.daily = u.daily.slice(-DAILY_CAP);
        }
        addTotals(daily, rec);
        let batch = u.batches.find(b => b.batchId === batchId);
        if (!batch) {
            batch = { batchId, firstAt: at, lastAt: at, calls: 0, inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, costCny: 0 };
            u.batches.push(batch);
            if (u.batches.length > BATCH_CAP)
                u.batches = u.batches.slice(-BATCH_CAP);
        }
        batch.lastAt = at;
        if (route?.model)
            batch.model = route.model;
        addTotals(batch, rec);
        addTotals(u.total, rec);
        void this.store.save();
    }
    /** 面板 / 工具共用的用量视图。 */
    view() {
        const u = this.store.state.usage;
        const todayKey = dateKey(Date.now());
        const cutoff = dateKey(Date.now() - 6 * 86400_000);
        const today = zeroTotals();
        const last7 = zeroTotals();
        for (const d of u.daily) {
            if (d.date === todayKey)
                addTotals(today, d);
            if (d.date >= cutoff && d.date <= todayKey)
                addTotals(last7, d);
        }
        const batches = [...u.batches].sort((a, b) => b.lastAt - a.lastAt).slice(0, 10);
        return { today, last7, total: { ...u.total }, batches, debug: { seen: this.seen, matched: this.matched, recorded: u.total.calls } };
    }
}
