import * as React from 'react';
import { FACT_LABEL, OVERALL_LABEL } from '../types.js';
const h = React.createElement;
const PKG = 'dsh-douyin-radar';
const STATE = '/plugin-data/dsh-douyin-radar/state';
const ACTION = '/plugin-data/dsh-douyin-radar/action';
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
function Badge({ status }) {
    return h('span', {
        style: { ...chip, background: `${BADGE_COLOR[status]}22`, color: BADGE_COLOR[status], border: `1px solid ${BADGE_COLOR[status]}55` },
    }, OVERALL_LABEL[status]);
}
function CardView({ card, open, onToggle, onAct }) {
    const face = h('button', {
        type: 'button', style: cardBox, onClick: onToggle, 'data-card-id': card.id,
    }, h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } }, h(Badge, { status: card.overall }), h('span', { style: chip }, card.keyword), !card.read && h('span', { style: { width: 7, height: 7, borderRadius: 999, background: '#58a6ff' } }), h('span', { style: { marginLeft: 'auto', opacity: 0.6, fontSize: 11 } }, fmtTime(card.createdAt))), h('div', { style: { fontWeight: 500, margin: '6px 0 2px' } }, card.headline), h('div', { style: { opacity: 0.6, fontSize: 11 } }, `${card.video.author || '未知作者'} · ${card.video.publishText || ''} · 点击${open ? '收起' : '展开详情'}`));
    if (!open)
        return face;
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } }, face, h('div', { style: { ...cardBox, cursor: 'default', display: 'flex', flexDirection: 'column', gap: 8 } }, card.summary && h('div', null, h('strong', null, '视频概述：'), card.summary), h('div', null, h('strong', null, `事实点（${card.facts.length}）`), card.facts.length === 0 && h('div', { style: { opacity: 0.6 } }, '无可核实事实点'), ...card.facts.map((f, i) => h('div', { key: i, style: { marginTop: 6, paddingLeft: 8, borderLeft: `2px solid ${BADGE_COLOR[f.status === 'verified' ? 'verified' : f.status === 'contradicted' ? 'contradicted' : 'unverified']}` } }, h('div', null, h('span', { style: { ...chip, color: BADGE_COLOR[f.status === 'verified' ? 'verified' : f.status === 'contradicted' ? 'contradicted' : 'unverified'] } }, FACT_LABEL[f.status]), ' ', f.claim), f.sources.length > 0 && h('div', { style: { fontSize: 12 } }, '来源：', ...f.sources.map((s, j) => h('span', { key: j }, j > 0 && ' · ', h('a', { style: link, href: s.url, target: '_blank', rel: 'noreferrer' }, s.title || s.url)))), f.note && h('div', { style: { fontSize: 12, opacity: 0.7 } }, f.note)))), card.marketing && h('div', { style: { fontSize: 12, opacity: 0.8 } }, h('strong', null, '营销话术（未经证实）：'), card.marketing), h('div', { style: { fontSize: 12 } }, '原视频：', h('a', { style: link, href: card.video.url, target: '_blank', rel: 'noreferrer' }, card.video.title || card.video.url)), h('div', { style: { display: 'flex', gap: 6 } }, !card.read && h('button', { type: 'button', style: btn, onClick: () => onAct('read', { cardId: card.id }) }, '标记已读'), h('button', { type: 'button', style: btn, onClick: () => onAct(card.archived ? 'unarchive' : 'archive', { cardId: card.id }) }, card.archived ? '取消归档' : '归档'))));
}
function RadarPanel() {
    const [snap, setSnap] = React.useState(null);
    const [err, setErr] = React.useState(null);
    const [open, setOpen] = React.useState({});
    const [showArchived, setShowArchived] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [showCfg, setShowCfg] = React.useState(false);
    const [kwText, setKwText] = React.useState('');
    const [intText, setIntText] = React.useState('60');
    const [enCfg, setEnCfg] = React.useState(true);
    React.useEffect(() => {
        if (showCfg && snap) {
            setKwText(snap.keywords.join('，'));
            setIntText(String(snap.intervalMinutes));
            setEnCfg(snap.enabled);
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
        try {
            await fetch(ACTION, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action, ...extra }),
            });
            await load();
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
    return h('div', { style: box }, h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } }, h('strong', { style: { fontSize: 14 } }, '抖音进展雷达'), unread > 0 && h('span', { style: { ...chip, background: '#58a6ff22', color: '#58a6ff' } }, `${unread} 未读`), h('span', { style: { marginLeft: 'auto', opacity: 0.6, fontSize: 11 } }, snap.patrol.running ? '巡查中…' : snap.idle.idle ? '空闲' : '忙')), h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } }, h('button', { type: 'button', style: btn, disabled: busy, onClick: () => void act('patrol') }, '立即巡查'), !snap.login.loggedIn && h('button', { type: 'button', style: btn, disabled: busy || snap.login.loggingIn, onClick: () => void act('login') }, snap.login.loggingIn ? '等待扫码…' : '扫码登录'), h('button', { type: 'button', style: btn, disabled: busy || snap.human.checking, onClick: () => void act('human') }, snap.human.checking ? '验证中…' : '过验证'), h('button', { type: 'button', style: btn, disabled: busy, onClick: () => void act('readAll') }, '全部已读'), h('button', { type: 'button', style: btn, onClick: () => setShowArchived(v => !v) }, showArchived ? '隐藏归档' : '显示归档'), h('button', { type: 'button', style: btn, onClick: () => setShowCfg(v => !v) }, showCfg ? '收起设置' : '关键词设置')), h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } }, h('span', { style: { ...chip, color: snap.login.loggedIn ? '#2ea043' : '#d29922' } }, snap.login.loggedIn ? '抖音已登录' : '抖音未登录'), ...snap.keywords.map(k => h('span', { key: k, style: chip }, k)), snap.keywords.length === 0 && h('span', { style: { opacity: 0.6, fontSize: 12 } }, '未设置关键词：点上方「关键词设置」添加话题')), showCfg && h('div', { style: { ...cardBox, cursor: 'default', display: 'flex', flexDirection: 'column', gap: 8 } }, h('div', { style: { fontSize: 12, opacity: 0.7 } }, '关键词（逗号分隔；搜索抖音相关视频，不盯账号）：'), h('input', { style: input, value: kwText, placeholder: '例如：DeepSeek，开源大模型，Harness', onChange: e => setKwText(e.target.value) }), h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, flexWrap: 'wrap' } }, h('span', null, '巡查最小间隔（分钟）'), h('input', { style: { ...input, width: 70 }, type: 'number', min: 5, max: 1440, value: intText, onChange: e => setIntText(e.target.value) }), h('label', { style: { display: 'flex', gap: 4, alignItems: 'center' } }, h('input', { type: 'checkbox', checked: enCfg, onChange: e => setEnCfg(e.target.checked) }), '启用空闲自动巡查')), h('div', null, h('button', {
        type: 'button', style: btn, disabled: busy,
        onClick: () => void act('setConfig', { keywords: kwText, intervalMinutes: Number(intText) || 60, enabled: enCfg }),
    }, '保存设置'))), snap.login.error && h('div', { style: { color: '#f85149', fontSize: 12 } }, snap.login.error), snap.human.error && h('div', { style: { color: '#f85149', fontSize: 12 } }, snap.human.error), snap.human.checking && h('div', { style: { color: '#d29922', fontSize: 12 } }, '已打开验证窗口：如出现滑块/点选请完成一次；若页面已能正常浏览则无需操作。判定通过后窗口自动缩到右下角并保留会话供巡查复用。'), !snap.human.checking && /验证码/.test(snap.patrol.last?.error ?? '') && h('div', { style: { color: '#d29922', fontSize: 12 } }, '上次巡查被抖音风控拦截：点「过验证」人工完成一次，之后自动巡查通常即可恢复。'), err && h('div', { style: { color: '#f85149', fontSize: 12 } }, `连接异常：${err}`), snap.leadsPending > 0 && h('div', { style: { opacity: 0.7, fontSize: 12 } }, `${snap.leadsPending} 条线索正在核实编排中…`), cards.length === 0 && h('div', { style: { opacity: 0.6 } }, '暂无进展卡片。设置关键词并登录后，DSH 空闲时会自动巡查抖音相关视频，核实后推送到这里。'), ...cards.map(card => h(CardView, {
        key: card.id,
        card,
        open: !!open[card.id],
        onToggle: () => setOpen(o => ({ ...o, [card.id]: !o[card.id] })),
        onAct: (action, extra) => void act(action, extra),
    })), snap.patrol.last && h('div', { style: { opacity: 0.55, fontSize: 11, marginTop: 4 } }, `上次巡查 ${fmtTime(snap.patrol.last.startedAt)}：发现 ${snap.patrol.last.found} / 新增 ${snap.patrol.last.added}` +
        (snap.patrol.last.error ? ` · ${snap.patrol.last.error}` : '') +
        ` · 下次最早 ${fmtTime(snap.patrol.nextEligibleAt ?? Date.now())}`));
}
/** 客户端半侧：注册右栏自定义 tab 类型与卡片面板正文（Cordis 命名导出）。 */
export const inject = ['slots', 'sidebarRightTabs'];
export function apply(ctx) {
    ctx.effect(() => ctx.sidebarRightTabs.register({
        id: PKG,
        kind: 'douyin-radar',
        title: () => '抖音进展雷达',
        guide: [{
                id: PKG,
                kind: 'douyin-radar',
                title: () => '抖音进展雷达',
                description: () => '空闲巡查抖音话题视频，权威来源核实后推送进展卡片',
            }],
    }), 'radar tab type');
    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: PKG }, RadarPanel)), 'radar panel body');
}
