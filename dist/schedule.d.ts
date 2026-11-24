import type { ScheduleMode } from './types.js';
/**
 * 跟进时间段：预设峰谷规则 + 自定义每日窗口。
 * 峰谷按官方计费口径（北京时间）：工作日 9:00–12:00、14:00–18:00 为峰时，其余谷时（含周末全天）。
 * 已知近似：官方把法定节假日也算谷时，这里不内置节假日日历，按周一~周五判峰时（略保守）。
 * 自定义窗口按机器本地时间，支持跨午夜（start > end）。
 */
/** 解析 "HH:MM-HH:MM" 为分钟区间；非法或起止相同返回 null。 */
export declare function parseWindow(s: string): {
    start: number;
    end: number;
} | null;
/** 规范化为补齐两位的 "HH:MM-HH:MM"；非法返回 null。 */
export declare function normalizeWindow(s: string): string | null;
/** 自定义窗口判定（本地时间）；无有效窗口视为全天。 */
export declare function inWindows(now: Date, windows: string[]): boolean;
/** 官方峰时判定（北京时间 UTC+8）：工作日 9:00–12:00、14:00–18:00。 */
export declare function isPeakBeijing(now: Date): boolean;
/** 当前是否处于允许自动跟进的时间段。 */
export declare function inSchedule(now: Date, mode: ScheduleMode, windows: string[]): boolean;
/** 下次开窗时间（毫秒时间戳）；已在窗内返回 undefined。分钟粒度向前扫描，上限 8 天。 */
export declare function nextOpenAt(now: Date, mode: ScheduleMode, windows: string[]): number | undefined;
