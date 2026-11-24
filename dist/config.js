import Schema from '@deepseek-ai/schemastery';
export const Config = Schema.object({
    enabled: Schema.boolean().default(true).volatile().description('启用空闲自动跟进'),
    keywords: Schema.array(Schema.string()).default([]).volatile().description('追踪的话题关键词（搜索抖音相关视频，不盯账号）'),
    intervalMinutes: Schema.number().min(5).default(60).volatile().description('两次跟进的最小间隔（分钟）'),
    scheduleMode: Schema.string().default('all').volatile().description('自动跟进时间段：all 全天 / offpeak 谷时（官方峰时取反，半价）/ peak 峰时 / custom 自定义窗口'),
    activeWindows: Schema.array(Schema.string()).default([]).volatile().description('custom 模式的每日跟进窗口，格式 HH:MM-HH:MM，支持跨午夜；空数组视为全天'),
    idleQuietSeconds: Schema.number().min(10).default(120).volatile().description('判定空闲所需的静默秒数（无 agent 轮次进行中）'),
    maxVideosPerPatrol: Schema.number().min(1).max(20).default(6).volatile().description('每次跟进最多采集的新视频数'),
    ocrEnabled: Schema.boolean().default(true).volatile().description('对关键帧做文字识别（画面字幕/界面文字）'),
    aiSummaryEnabled: Schema.boolean().default(true).volatile().description('优先取抖音内置 AI 讲解摘要作为补充'),
    frameCount: Schema.number().min(1).max(6).default(2).volatile().description('每个视频抽取的关键帧数（越多越耗 CPU）'),
    headlessPatrol: Schema.boolean().default(false).volatile().description('跟进用无头浏览器（实测无头/屏外窗口均被风控验证码拦截，保持 false；有头自动缩右下角小窗）'),
    browserChannel: Schema.string().default('msedge').volatile().description('系统浏览器通道：msedge / chrome / chromium'),
    dataDir: Schema.string().default('').volatile().description('数据目录（留空用 $DSH_HOME/plugin-data/douyinfollow）'),
    loginTimeoutSeconds: Schema.number().min(30).default(180).volatile().description('扫码登录等待超时（秒）'),
    retentionCards: Schema.number().min(20).default(200).volatile().description('卡片保留上限'),
    pricingJson: Schema.string().default('').volatile().description('花费价格表覆盖（JSON，峰时价，元/百万token）：{"models":{"deepseek-flash":{"cacheHit":0.04,"cacheMiss":2,"output":8}}}；留空用官方默认价，谷时自动半价'),
});
const MODES = ['all', 'offpeak', 'peak', 'custom'];
export function readConfig(config) {
    const mode = config.scheduleMode.get() ?? 'all';
    return {
        enabled: config.enabled.get() ?? true,
        keywords: (config.keywords.get() ?? []).map(k => k.trim()).filter(Boolean),
        intervalMinutes: config.intervalMinutes.get() ?? 60,
        scheduleMode: MODES.includes(mode) ? mode : 'all',
        activeWindows: (config.activeWindows.get() ?? []).filter(w => typeof w === 'string'),
        idleQuietSeconds: config.idleQuietSeconds.get() ?? 120,
        maxVideosPerPatrol: config.maxVideosPerPatrol.get() ?? 6,
        ocrEnabled: config.ocrEnabled.get() ?? true,
        aiSummaryEnabled: config.aiSummaryEnabled.get() ?? true,
        frameCount: config.frameCount.get() ?? 2,
        headlessPatrol: config.headlessPatrol.get() ?? false,
        browserChannel: config.browserChannel.get() ?? 'msedge',
        dataDir: config.dataDir.get() ?? '',
        loginTimeoutSeconds: config.loginTimeoutSeconds.get() ?? 180,
        retentionCards: config.retentionCards.get() ?? 200,
        pricingJson: config.pricingJson.get() ?? '',
    };
}
