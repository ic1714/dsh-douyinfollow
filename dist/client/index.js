import * as React from 'react';
import { FACT_LABEL, OVERALL_LABEL } from '../types.js';
const h = React.createElement;
const PKG = 'douyinfollow';
const STATE = '/plugin-data/douyinfollow/state';
const ACTION = '/plugin-data/douyinfollow/action';
const BADGE_COLOR = {
    verified: '#2ea043',
    mixed: '#d29922',
    contradicted: '#f85149',
    unverified: '#8b949e',
};
const box = {
    display: 'flex', flexDirection: 'column', gap: 10,
    padding: 12, height: '100%', overflow: 'auto', fontSize: 13, lineHeight: 1.5,
};
const chip = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '1px 8px', borderRadius: 999, fontSize: 11,
    background: 'rgba(127,127,127,.16)', whiteSpace: 'nowrap',
};
const btn = {
    padding: '4px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
    border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit',
};
const cardBox = {
    border: '1px solid rgba(127,127,127,.22)', borderRadius: 10,
    background: 'rgba(127,127,127,.07)', padding: 10, textAlign: 'left',
    color: 'inherit', font: 'inherit', width: '100%', cursor: 'pointer',
};
const link = { color: '#58a6ff', textDecoration: 'none', wordBreak: 'break-all' };
const input = {
    padding: '4px 8px', borderRadius: 8, fontSize: 12, width: '100%',
    border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit',
};
function fmtTime(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtTokens(n) {
    if (n >= 1e6)
        return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}
const MODE_PRESETS = [
    { mode: 'all', label: '全天' },
    { mode: 'offpeak', label: '谷时·半价' },
    { mode: 'peak', label: '峰时' },
    { mode: 'custom', label: '自定义' },
];
function Badge({ status }) {
    return h('span', {
        style: { ...chip, background: `${BADGE_COLOR[status]}22`, color: BADGE_COLOR[status], border: `1px solid ${BADGE_COLOR[status]}55` },
    }, OVERALL_LABEL[status]);
}
function CardView({ card, open, onToggle, onAct, batchCost }) {
    const face = h('button', {
        type: 'button', style: cardBox, onClick: onToggle, 'data-card-id': card.id,
    }, h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } }, h(Badge, { status: card.overall }), h('span', { style: chip }, card.keyword), !card.read && h('span', { style: { width: 7, height: 7, borderRadius: 999, background: '#58a6ff' } }), h('span', { style: { marginLeft: 'auto', opacity: 0.6, fontSize: 11 } }, fmtTime(card.createdAt))), h('div', { style: { fontWeight: 500, margin: '6px 0 2px' } }, card.headline), h('div', { style: { opacity: 0.6, fontSize: 11 } }, `${card.video.author || '未知作者'} · ${card.video.publishText || ''} · 点击${open ? '收起' : '展开详情'}`));
    if (!open)
        return face;
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } }, face, h('div', { style: { ...cardBox, cursor: 'default', display: 'flex', flexDirection: 'column', gap: 8 } }, card.summary && h('div', null, h('strong', null, '视频概述：'), card.summary), h('div', null, h('strong', null, `事实点（${card.facts.length}）`), card.facts.length === 0 && h('div', { style: { opacity: 0.6 } }, '无可核实事实点'), ...card.facts.map((f, i) => h('div', { key: i, style: { marginTop: 6, paddingLeft: 8, borderLeft: `2px solid ${BADGE_COLOR[f.status === 'verified' ? 'verified' : f.status === 'contradicted' ? 'contradicted' : 'unverified']}` } }, h('div', null, h('span', { style: { ...chip, color: BADGE_COLOR[f.status === 'verified' ? 'verified' : f.status === 'contradicted' ? 'contradicted' : 'unverified'] } }, FACT_LABEL[f.status]), ' ', f.claim), f.sources.length > 0 && h('div', { style: { fontSize: 12 } }, '来源：', ...f.sources.map((s, j) => h('span', { key: j }, j > 0 && ' · ', h('a', { style: link, href: s.url, target: '_blank', rel: 'noreferrer' }, s.title || s.url)))), f.note && h('div', { style: { fontSize: 12, opacity: 0.7 } }, f.note)))), card.marketing && h('div', { style: { fontSize: 12, opacity: 0.8 } }, h('strong', null, '营销话术（未经证实）：'), card.marketing), h('div', { style: { fontSize: 12 } }, '原视频：', h('a', { style: link, href: card.video.url, target: '_blank', rel: 'noreferrer' }, card.video.title || card.video.url)), typeof batchCost === 'number' && h('div', { style: { fontSize: 12, opacity: 0.7 } }, `本批核实花费 ¥${batchCost.toFixed(4)}（同批卡片共享）`), h('div', { style: { display: 'flex', gap: 6 } }, !card.read && h('button', { type: 'button', style: btn, onClick: () => onAct('read', { cardId: card.id }) }, '标记已读'), h('button', { type: 'button', style: btn, onClick: () => onAct(card.archived ? 'unarchive' : 'archive', { cardId: card.id }) }, card.archived ? '取消归档' : '归档'))));
}
function FollowPanel() {
    const [snap, setSnap] = React.useState(null);
    const [err, setErr] = React.useState(null);
    const [open, setOpen] = React.useState({});
    const [showArchived, setShowArchived] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [actErr, setActErr] = React.useState(null);
    const [showCfg, setShowCfg] = React.useState(false);
    const [kwText, setKwText] = React.useState('');
    const [intText, setIntText] = React.useState('60');
    const [enCfg, setEnCfg] = React.useState(true);
    const [modeCfg, setModeCfg] = React.useState('all');
    const [winCfg, setWinCfg] = React.useState([]);
    React.useEffect(() => {
        if (showCfg && snap) {
            setKwText(snap.keywords.join('，'));
            setIntText(String(snap.intervalMinutes));
            setEnCfg(snap.enabled);
            setModeCfg(snap.scheduleMode);
            setWinCfg(snap.activeWindows.map(w => {
                const [start, end] = w.split('-');
                return { start: start ?? '', end: end ?? '' };
            }));
        }
    }, [showCfg]);
    const load = React.useCallback(async () => {
        try {
            const r = await fetch(STATE, { cache: 'no-store' });
            if (!r.ok)
                throw new Error(`HTTP ${r.status}`);
            setSnap(await r.json());
            setErr(null);
        }
        catch (e) {
            setErr(String(e?.message ?? e));
        }
    }, []);
    React.useEffect(() => {
        void load();
        const t = setInterval(() => void load(), 4000);
        return () => clearInterval(t);
    }, [load]);
    const act = React.useCallback(async (action, extra) => {
        setBusy(true);
        setActErr(null);
        try {
            const r = await fetch(ACTION, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action, ...extra }),
            });
            const body = (await r.json().catch(() => null));
            await load();
            // 守卫拒绝（如未设关键词）原先被静默吞掉，表现为「点了没反应」；现在红字显性化。
            if (body && body.started === false && typeof body.reason === 'string')
                setActErr(body.reason);
        }
        catch (e) {
            setErr(String(e?.message ?? e));
        }
        finally {
            setBusy(false);
        }
    }, [load]);
    if (!snap) {
        return h('div', { style: box }, h('div', { style: { opacity: 0.7 } }, err ? `无法连接宿主：${err}` : '加载中…'));
    }
    const cards = snap.cards.filter(c => showArchived || !c.archived);
    const unread = snap.cards.filter(c => !c.read && !c.archived).length;
    return h('div', { style: box }, h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } }, h('strong', { style: { fontSize: 14 } }, '抖音跟进'), unread > 0 && h('span', { style: { ...chip, background: '#58a6ff22', color: '#58a6ff' } }, `${unread} 未读`), h('span', { style: { marginLeft: 'auto', opacity: 0.6, fontSize: 11 } }, snap.patrol.running ? '跟进中…' : snap.idle.idle ? '空闲' : '忙')), h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, h('button', { type: 'button', style: btn, disabled: busy, onClick: () => void act('patrol') }, '立即跟进'), !snap.login.loggedIn && h('button', { type: 'button', style: btn, disabled: busy || snap.login.loggingIn, onClick: () => void act('login') }, snap.login.loggingIn ? '等待扫码…' : '扫码登录'), h('button', { type: 'button', style: btn, disabled: busy, onClick: () => void act(snap.human.checking ? 'humanCancel' : 'human') }, snap.human.checking ? '取消验证' : '过验证'), snap.human.checking && h('button', { type: 'button', style: btn, disabled: busy, onClick: () => void act('humanDone') }, '我已完成验证'), h('button', { type: 'button', style: btn, disabled: busy, onClick: () => void act('readAll') }, '全部已读'), h('button', { type: 'button', style: btn, onClick: () => setShowArchived(v => !v) }, showArchived ? '隐藏归档' : '显示归档'), h('button', { type: 'button', style: btn, onClick: () => setShowCfg(v => !v) }, showCfg ? '收起设置' : '设置')), h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } }, h('span', { style: { ...chip, color: snap.login.loggedIn ? '#2ea043' : '#d29922' } }, snap.login.loggedIn ? '抖音已登录' : '抖音未登录'), h('span', { style: { ...chip, color: '#58a6ff' } }, `今日 ¥${snap.usage.today.costCny.toFixed(2)}`), snap.scheduleMode !== 'all' && !snap.window.inWindow && h('span', { style: { ...chip, color: '#d29922' } }, `窗口外 · 下次开窗 ${snap.window.nextOpenAt ? fmtTime(snap.window.nextOpenAt) : '—'}`), !snap.enabled && h('span', { style: { ...chip, color: '#d29922' } }, '自动跟进已停用（手动不受限）'), ...snap.keywords.map(k => h('span', { key: k, style: chip }, k)), snap.keywords.length === 0 && h('span', { style: { opacity: 0.6, fontSize: 12 } }, '未设置关键词：点上方「设置」添加话题')), showCfg && h('div', { style: { ...cardBox, cursor: 'default', display: 'flex', flexDirection: 'column', gap: 8 } }, h('div', { style: { fontSize: 12, opacity: 0.7 } }, '关键词（逗号分隔；搜索抖音相关视频，不盯账号）：'), h('input', { style: input, value: kwText, placeholder: '例如：DeepSeek，开源大模型，Harness', onChange: e => setKwText(e.target.value) }), h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, flexWrap: 'wrap' } }, h('span', null, '跟进最小间隔（分钟）'), h('input', { style: { ...input, width: 70 }, type: 'number', min: 5, max: 1440, value: intText, onChange: e => setIntText(e.target.value) }), h('label', { style: { display: 'flex', gap: 4, alignItems: 'center' } }, h('input', { type: 'checkbox', checked: enCfg, onChange: e => setEnCfg(e.target.checked) }), '启用空闲自动跟进')), h('div', { style: { fontSize: 12, opacity: 0.7 } }, '自动跟进时间段（手动「立即跟进」不受限制）：'), h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, ...MODE_PRESETS.map(p => h('button', {
        key: p.mode, type: 'button',
        style: { ...btn, ...(modeCfg === p.mode ? { background: '#58a6ff22', borderColor: '#58a6ff', color: '#58a6ff' } : {}) },
        onClick: () => setModeCfg(p.mode),
    }, p.label))), modeCfg === 'offpeak' && h('div', { style: { fontSize: 11, opacity: 0.6 } }, '谷时 = 官方峰时（工作日 9:00–12:00、14:00–18:00，北京时间）之外，含周末全天；谷时模型调用半价。'), modeCfg === 'peak' && h('div', { style: { fontSize: 11, opacity: 0.6 } }, '仅官方峰时（工作日 9:00–12:00、14:00–18:00，北京时间）自动跟进；此时段模型调用为全价。'), modeCfg === 'custom' && h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } }, ...winCfg.map((w, i) => h('div', { key: i, style: { display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 } }, h('input', { style: { ...input, width: 110 }, type: 'time', value: w.start, onChange: e => setWinCfg(ws => ws.map((x, j) => j === i ? { ...x, start: e.target.value } : x)) }), h('span', null, '至'), h('input', { style: { ...input, width: 110 }, type: 'time', value: w.end, onChange: e => setWinCfg(ws => ws.map((x, j) => j === i ? { ...x, end: e.target.value } : x)) }), h('button', { type: 'button', style: btn, onClick: () => setWinCfg(ws => ws.filter((_, j) => j !== i)) }, '删除'))), h('div', null, h('button', { type: 'button', style: btn, disabled: winCfg.length >= 6, onClick: () => setWinCfg(ws => [...ws, { start: '22:00', end: '06:00' }]) }, '添加时段')), h('div', { style: { fontSize: 11, opacity: 0.6 } }, '按本机本地时间；支持跨午夜（如 22:00 至 06:00）；不填时段视为全天。')), h('div', null, h('button', {
        type: 'button', style: btn, disabled: busy,
        onClick: () => void act('setConfig', {
            keywords: kwText, intervalMinutes: Number(intText) || 60, enabled: enCfg,
            scheduleMode: modeCfg,
            activeWindows: winCfg.filter(w => w.start && w.end).map(w => `${w.start}-${w.end}`),
        }),
    }, '保存设置')), h('div', { style: { borderTop: '1px solid rgba(127,127,127,.22)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 } }, h('strong', { style: { fontSize: 12 } }, '核实花费'), h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, h('span', { style: chip }, `今日 ¥${snap.usage.today.costCny.toFixed(4)}`), h('span', { style: chip }, `近7天 ¥${snap.usage.last7.costCny.toFixed(4)}`), h('span', { style: chip }, `累计 ¥${snap.usage.total.costCny.toFixed(4)}`)), h('div', { style: { fontSize: 11, opacity: 0.6 } }, `今日 ${snap.usage.today.calls} 次调用 · 输入未命中 ${fmtTokens(snap.usage.today.inputTokens)} / 缓存命中 ${fmtTokens(snap.usage.today.cacheReadTokens)} / 输出 ${fmtTokens(snap.usage.today.outputTokens)} token`), ...snap.usage.batches.slice(0, 5).map(b => h('div', { key: b.batchId, style: { fontSize: 11, opacity: 0.75 } }, `${fmtTime(b.lastAt)} 批次 ${b.batchId.slice(0, 8)} · ${b.calls} 次 · ¥${b.costCny.toFixed(4)}${b.model ? ' · ' + b.model : ''}`)), h('div', { style: { fontSize: 11, opacity: 0.55 } }, `事件诊断：收到 ${snap.usage.debug.seen} · 归属 ${snap.usage.debug.matched} · 入账 ${snap.usage.debug.recorded}（重启归零；「收到」长期为 0 说明事件没到插件）`), h('div', { style: { fontSize: 11, opacity: 0.55 } }, '按 DeepSeek 官方 API 价格计算（峰谷自动判定，谷时半价）；只统计本插件派发的核实会话，不含主对话。价格可在宿主配置 pricingJson 覆盖。'))), snap.login.error && h('div', { style: { color: '#f85149', fontSize: 12 } }, snap.login.error), snap.human.error && h('div', { style: { color: '#f85149', fontSize: 12 } }, snap.human.error), snap.human.checking && h('div', { style: { color: '#d29922', fontSize: 12 } }, '已打开验证窗口：如出现滑块/点选请完成一次；完成后自动判定，也可点「我已完成验证」立即复核。点「取消验证」或直接关窗会立即结束本次验证、可马上重试。判定通过后窗口自动缩到右下角并保留会话供跟进复用。'), !snap.human.checking && /验证码/.test(snap.patrol.last?.error ?? '') && h('div', { style: { color: '#d29922', fontSize: 12 } }, '上次跟进被抖音风控拦截：点「过验证」人工完成一次，之后自动跟进通常即可恢复。'), snap.patrol.last && !snap.patrol.last.error && snap.patrol.last.added === 0 && snap.patrol.last.found > 0 && h('div', { style: { opacity: 0.6, fontSize: 12 } }, `本次跟进无新线索：已往下翻找 ${snap.patrol.last.found} 条结果，都已看过（看过的视频不重复核实，省花费）。关键词下出现新视频时会自动核实推送；也可在「设置」里加关键词扩大覆盖。`), actErr && h('div', { style: { color: '#f85149', fontSize: 12 } }, `未执行：${actErr}`), err && h('div', { style: { color: '#f85149', fontSize: 12 } }, `连接异常：${err}`), snap.leadsPending > 0 && h('div', { style: { opacity: 0.7, fontSize: 12 } }, `${snap.leadsPending} 条线索正在核实编排中…`), cards.length === 0 && h('div', { style: { opacity: 0.6 } }, '暂无进展卡片。设置关键词并登录后，DSH 空闲时会自动搜索抖音相关新视频，核实后推送到这里。'), ...cards.map(card => h(CardView, {
        key: card.id,
        card,
        open: !!open[card.id],
        onToggle: () => setOpen(o => ({ ...o, [card.id]: !o[card.id] })),
        onAct: (action, extra) => void act(action, extra),
        batchCost: card.batchId ? snap.usage.batches.find(b => b.batchId === card.batchId)?.costCny : undefined,
    })), snap.patrol.last && h('div', { style: { opacity: 0.55, fontSize: 11, marginTop: 4 } }, `上次跟进 ${fmtTime(snap.patrol.last.startedAt)}：发现 ${snap.patrol.last.found} / 新增 ${snap.patrol.last.added}` +
        (snap.patrol.last.error ? ` · ${snap.patrol.last.error}` : snap.patrol.last.added === 0 ? (snap.patrol.last.found > 0 ? ' · 均看过，无新线索' : ' · 搜索无结果') : '') +
        ` · 下次最早 ${fmtTime(snap.patrol.nextEligibleAt ?? Date.now())}`));
}
/** 客户端半侧：注册右栏自定义 tab 类型与卡片面板正文（Cordis 命名导出）。 */
export const inject = ['slots', 'sidebarRightTabs'];
export function apply(ctx) {
    ctx.effect(() => ctx.sidebarRightTabs.register({
        id: PKG,
        kind: 'douyin-follow',
        title: () => '抖音跟进',
        guide: [{
                id: PKG,
                kind: 'douyin-follow',
                title: () => '抖音跟进',
                description: () => '跟进选定内容的实时进展',
            }],
    }), 'follow tab type');
    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: PKG }, FollowPanel)), 'follow panel body');
}
