import { join } from 'node:path';
/**
 * 关键帧文字识别（best-effort）：tesseract.js 中文+英文。
 * 语言模型首次使用时下载并缓存到插件数据目录；失败时降级为空文本，
 * 不影响标题/文案/AI 讲解主链路。
 */
export class FrameOcr {
    cacheDir;
    worker;
    starting;
    ready = false;
    constructor(cacheDir) {
        this.cacheDir = cacheDir;
    }
    async ensure() {
        if (this.worker)
            return this.worker;
        if (!this.starting) {
            this.starting = (async () => {
                try {
                    const mod = await import('tesseract.js');
                    const worker = await mod.createWorker(['chi_sim', 'eng'], 1, {
                        cachePath: join(this.cacheDir, 'ocr-cache'),
                        logger: () => undefined,
                    });
                    this.worker = worker;
                    this.ready = true;
                    return this.worker;
                }
                catch {
                    this.ready = false;
                    return undefined;
                }
                finally {
                    this.starting = undefined;
                }
            })();
        }
        return this.starting;
    }
    /** 识别多帧并合并去重行。 */
    async recognize(frames) {
        if (frames.length === 0)
            return '';
        const worker = await this.ensure();
        if (!worker)
            return '';
        const lines = new Set();
        for (const frame of frames) {
            try {
                const { data } = await worker.recognize(frame);
                for (const line of data.text.split(/\r?\n/)) {
                    const t = line.replace(/\s+/g, ' ').trim();
                    if (t.length >= 4)
                        lines.add(t);
                }
            }
            catch {
                // 单帧失败忽略
            }
        }
        return [...lines].join('\n').slice(0, 4000);
    }
    async dispose() {
        const worker = this.worker;
        this.worker = undefined;
        this.ready = false;
        if (worker)
            await worker.terminate().catch(() => undefined);
    }
}
