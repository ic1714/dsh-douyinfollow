export interface BrowserOptions {
    userDataDir: string;
    /** 系统浏览器通道：msedge / chrome / chromium。复用系统内核，免下载浏览器。 */
    channel: string;
    headlessPatrol: boolean;
    loginTimeoutSeconds: number;
}
export interface SearchResultItem {
    videoId: string;
    url: string;
    title: string;
    author: string;
    publishText?: string;
}
export interface CollectedVideo {
    title: string;
    author: string;
    desc: string;
    aiSummary?: string;
    /** 关键帧截图（PNG buffer），交给 OCR 提取画面文字。 */
    frames: Buffer[];
}
/**
 * 插件自管的持久化浏览器：登录态保存在独立 profile，跟进后台运行、不抢焦点。
 * 全程只读：不点赞、不评论、不关注、不发布。
 */
export declare class DouyinBrowser {
    private opts;
    private ctx?;
    private ctxHeadless?;
    private loginWaiter?;
    private humanWaiter?;
    loggingIn: boolean;
    loginError?: string;
    checkingHuman: boolean;
    humanError?: string;
    private humanConfirm;
    private foregroundHwnd;
    constructor(opts: BrowserOptions);
    private ensure;
    /** 启动前清理上次崩溃/强杀残留的本 profile Edge 进程，避免进程堆积与 profile 锁冲突。 */
    private killOrphanEdge;
    /** 把 profile 标记为「正常退出」，避免 Edge 启动时弹「还原页面/意外关闭」对话框盖住跟进页。 */
    private markCleanExit;
    /** 记住跟进前的前台窗口， launches 后归还焦点，避免打断游戏/全屏应用。 */
    noteForeground(hwnd: number): void;
    /** 窗口缩到右下角 + 置底 + 不激活 + 焦点归还前台：跟进在后台跑，不置顶弹窗打断游戏/视频/工作。 */
    quiet(): Promise<void>;
    /** 用户主动扫码/过验证：恢复最小化窗口并置前台居中，保证用户看得见、能操作。 */
    show(): Promise<void>;
    private restoreFocus;
    /** 把有头窗口缩到屏幕右下角：可见但不挡主窗口（最小化会触发风控/懒渲染停摆）。 */
    private quietBounds;
    /** 风控识别：只认「可见的」验证码 UI；已能展示搜索结果/实质内容的页面视为已通过。
     *  旧版把 DOM 里残留的隐藏 captcha iframe/文案也当命中，导致用户过完验证后仍被误判、面板空等到超时。 */
    private captchaHit;
    private pace;
    private loggedInCookies;
    /** 是否已登录：活上下文直接读；否则读磁盘 cookie 表（不启浏览器、启动不弹窗）；读盘失败再无头复核（不可见）。 */
    isLoggedIn(): Promise<boolean>;
    /** 只读打开 profile 的 Cookies 表，按 cookie 名+有效期判定登录态，零浏览器启动。 */
    private loginCookiesOnDisk;
    /** 打开有头浏览器供用户扫码；轮询登录 cookie 直到成功或超时。 */
    login(): Promise<boolean>;
    /** 风控验证码中间页：开有头窗口请用户人工过一次滑块/点选，信任态落 profile。 */
    humanCheck(url: string): Promise<boolean>;
    /** 用户在网页端完成验证后手动确认：下一轮轮询立即放宽判定，避免自动检测漏判时面板卡死。 */
    confirmHuman(): void;
    /** 搜索话题视频，返回去重前的候选列表。 */
    search(keyword: string, limit: number): Promise<SearchResultItem[]>;
    /** 保留一个常驻标签：Edge 关完最后一个标签会退居后台（无窗口），下次跟进再开就是弹窗打扰。 */
    private closeTab;
    /** 打开视频页采集标题/文案/AI 讲解/关键帧。任何一步失败都降级而非中断。 */
    collect(item: SearchResultItem, opts: {
        aiSummary: boolean;
        frames: number;
    }): Promise<CollectedVideo>;
    /** 尝试打开抖音内置 AI 讲解面板并读取摘要文本（有则取，无则降级）。 */
    private tryAiSummary;
    /** 播放中截取若干关键帧（画面文字交给 OCR）。 */
    private captureFrames;
    close(): Promise<void>;
}
