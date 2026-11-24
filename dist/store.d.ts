import { type Card, type Lead, type PatrolRecord, type FollowPrefs, type FollowState } from './types.js';
/** 偏好清洗：关键词去空去重限长，间隔夹到合法区间，时间段模式与窗口校验。 */
export declare function sanitizePrefs(raw: unknown): FollowPrefs;
/**
 * 本地 JSON 存储：已看视频去重、线索、卡片、跟进记录、花费统计。
 * 写入走 tmp + rename 原子替换，避免崩溃留下半截文件。
 */
export declare class FollowStore {
    readonly dir: string;
    readonly file: string;
    state: FollowState;
    private seenSet;
    private saving;
    constructor(dir: string);
    load(): Promise<void>;
    /** 串行化写盘，后一次覆盖前一次。 */
    save(): Promise<void>;
    hasSeen(videoId: string): boolean;
    markSeen(videoIds: string[]): void;
    addLeads(leads: Lead[]): void;
    getLead(id: string): Lead | undefined;
    leadsOfBatch(batchId: string): Lead[];
    pendingLeads(): Lead[];
    addCard(card: Card, retention: number): void;
    getCard(id: string): Card | undefined;
    addPatrol(record: PatrolRecord): void;
    finishPatrol(id: string, patch: Partial<PatrolRecord>): void;
}
