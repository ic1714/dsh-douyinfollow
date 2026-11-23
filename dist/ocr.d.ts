/**
 * 关键帧文字识别（best-effort）：tesseract.js 中文+英文。
 * 语言模型首次使用时下载并缓存到插件数据目录；失败时降级为空文本，
 * 不影响标题/文案/AI 讲解主链路。
 */
export declare class FrameOcr {
    private cacheDir;
    private worker?;
    private starting?;
    ready: boolean;
    constructor(cacheDir: string);
    private ensure;
    /** 识别多帧并合并去重行。 */
    recognize(frames: Buffer[]): Promise<string>;
    dispose(): Promise<void>;
}
