/**
 * dsh-douyin-radar 共享类型：宿主与客户端面板共用的数据形状。
 * 视频只是线索来源；卡片上的事实点必须带权威来源核实状态。
 */
/** 单条事实点的核实状态。 */
export type FactStatus = 'verified' | 'contradicted' | 'unverified';
/** 卡片整体核实结论：全部核实 / 部分核实 / 与权威来源不符 / 无法核实。 */
export type OverallStatus = 'verified' | 'mixed' | 'contradicted' | 'unverified';
export interface FactSource {
    url: string;
    title?: string;
}
export interface Fact {
    /** 可核实的事实陈述（项目名、版本、功能、日期、数据等）。 */
    claim: string;
    status: FactStatus;
    /** 权威来源链接（GitHub / 官网 / 官方文档等）。unverified 时可为空。 */
    sources: FactSource[];
    note?: string;
}
export interface VideoRef {
    videoId: string;
    url: string;
    title: string;
    author: string;
    publishText?: string;
    keyword: string;
}
/** 巡查采集到、等待核实编排处理的原始线索。 */
export interface Lead {
    id: string;
    batchId: string;
    keyword: string;
    video: VideoRef;
    collectedAt: number;
    desc: string;
    aiSummary?: string;
    ocrText?: string;
    status: 'pending' | 'verifying' | 'published' | 'skipped';
    skipReason?: string;
}
/** 推送给侧栏面板的进展卡片。 */
export interface Card {
    id: string;
    leadId: string;
    keyword: string;
    /** 卡面一句话进展。 */
    headline: string;
    createdAt: number;
    read: boolean;
    archived: boolean;
    video: VideoRef;
    facts: Fact[];
    /** 博主营销话术 / 夸大表述，单独归类，不混入事实。 */
    marketing?: string;
    /** 视频内容概述（只求“这视频在说什么”）。 */
    summary?: string;
    overall: OverallStatus;
}
export interface PatrolRecord {
    id: string;
    startedAt: number;
    finishedAt?: number;
    keywords: string[];
    found: number;
    added: number;
    error?: string;
    trigger: 'idle' | 'manual' | 'tool';
}
/** 本地持久化状态（state.json）。 */
export interface RadarState {
    seen: string[];
    leads: Lead[];
    cards: Card[];
    patrols: PatrolRecord[];
    lastPatrolAt?: number;
    prefs?: RadarPrefs;
}
/** 面板内可改的运行偏好（覆盖宿主配置默认值，存于 state.json）。 */
export interface RadarPrefs {
    enabled?: boolean;
    keywords?: string[];
    intervalMinutes?: number;
}
/** 面板 / 路由 / 工具共用的运行时快照。 */
export interface RadarSnapshot {
    now: number;
    enabled: boolean;
    keywords: string[];
    intervalMinutes: number;
    login: {
        loggedIn: boolean;
        loggingIn: boolean;
        error?: string;
    };
    human: {
        checking: boolean;
        error?: string;
    };
    idle: {
        busy: number;
        lastActivityAt: number;
        idle: boolean;
    };
    patrol: {
        running: boolean;
        current?: PatrolRecord;
        last?: PatrolRecord;
        nextEligibleAt?: number;
    };
    leadsPending: number;
    leads: Lead[];
    cards: Card[];
    patrols: PatrolRecord[];
    ocrReady: boolean;
}
export declare function emptyState(): RadarState;
export declare function overallOf(facts: Fact[]): OverallStatus;
export declare const OVERALL_LABEL: Record<OverallStatus, string>;
export declare const FACT_LABEL: Record<FactStatus, string>;
