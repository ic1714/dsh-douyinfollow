/**
 * 跟进时间段：预设峰谷规则 + 自定义每日窗口。
 * 峰谷按官方计费口径（北京时间）：工作日 9:00–12:00、14:00–18:00 为峰时，其余谷时（含周末全天）。
 * 已知近似：官方把法定节假日也算谷时，这里不内置节假日日历，按周一~周五判峰时（略保守）。
 * 自定义窗口按机器本地时间，支持跨午夜（start > end）。
 */
/** 解析 "HH:MM-HH:MM" 为分钟区间；非法或起止相同返回 null。 */
export function parseWindow(s) {
    const m = /^(\d{1,2}):(\d{1,2})\s*-\s*(\d{1,2}):(\d{1,2})$/.exec(String(s).trim());
    if (!m)
        return null;
    const h1 = Number(m[1]);
    const m1 = Number(m[2]);
    const h2 = Number(m[3]);
    const m2 = Number(m[4]);
    if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59)
        return null;
    const start = h1 * 60 + m1;
    const end = h2 * 60 + m2;
    if (start === end)
        return null;
    return { start, end };
}
/** 规范化为补齐两位的 "HH:MM-HH:MM"；非法返回 null。 */
export function normalizeWindow(s) {
    const w = parseWindow(s);
    if (!w)
        return null;
    const p = (n) => String(n).padStart(2, '0');
    return `${p(Math.floor(w.start / 60))}:${p(w.start % 60)}-${p(Math.floor(w.end / 60))}:${p(w.end % 60)}`;
}
function inWindow(now, w) {
    const t = now.getHours() * 60 + now.getMinutes();
    return w.start < w.end ? (t >= w.start && t < w.end) : (t >= w.start || t < w.end);
}
/** 自定义窗口判定（本地时间）；无有效窗口视为全天。 */
export function inWindows(now, windows) {
    const ws = windows.map(parseWindow).filter((w) => !!w);
    if (ws.length === 0)
        return true;
    return ws.some(w => inWindow(now, w));
}
/** 官方峰时判定（北京时间 UTC+8）：工作日 9:00–12:00、14:00–18:00。 */
export function isPeakBeijing(now) {
    const bj = new Date(now.getTime() + 8 * 3600_000);
    const day = bj.getUTCDay();
    if (day === 0 || day === 6)
        return false;
    const t = bj.getUTCHours() * 60 + bj.getUTCMinutes();
    return (t >= 540 && t < 720) || (t >= 840 && t < 1080);
}
/** 当前是否处于允许自动跟进的时间段。 */
export function inSchedule(now, mode, windows) {
    switch (mode) {
        case 'offpeak': return !isPeakBeijing(now);
        case 'peak': return isPeakBeijing(now);
        case 'custom': return inWindows(now, windows);
        default: return true;
    }
}
/** 下次开窗时间（毫秒时间戳）；已在窗内返回 undefined。分钟粒度向前扫描，上限 8 天。 */
export function nextOpenAt(now, mode, windows) {
    if (inSchedule(now, mode, windows))
        return undefined;
    const ws = mode === 'custom'
        ? windows.map(parseWindow).filter((w) => !!w)
        : [];
    const base = Math.floor(now.getTime() / 60000) * 60000;
    for (let i = 1; i <= 8 * 24 * 60; i++) {
        const t = new Date(base + i * 60000);
        const ok = mode === 'custom'
            ? (ws.length === 0 || ws.some(w => inWindow(t, w)))
            : mode === 'offpeak' ? !isPeakBeijing(t) : isPeakBeijing(t);
        if (ok)
            return t.getTime();
    }
    return undefined;
}
