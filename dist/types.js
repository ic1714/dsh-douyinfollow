/**
 * douyinfollow 共享类型：宿主与客户端面板共用的数据形状。
 * 视频只是线索来源；卡片上的事实点必须带权威来源核实状态。
 */
export function emptyState() {
    return { seen: [], leads: [], cards: [], patrols: [], prefs: {} };
}
export function overallOf(facts) {
    if (facts.length === 0)
        return 'unverified';
    if (facts.some(f => f.status === 'contradicted'))
        return 'contradicted';
    if (facts.every(f => f.status === 'verified'))
        return 'verified';
    if (facts.some(f => f.status === 'verified'))
        return 'mixed';
    return 'unverified';
}
export const OVERALL_LABEL = {
    verified: '已核实',
    mixed: '部分核实',
    contradicted: '与权威来源不符',
    unverified: '无法核实',
};
export const FACT_LABEL = {
    verified: '已核实',
    contradicted: '不符',
    unverified: '无法核实',
};
