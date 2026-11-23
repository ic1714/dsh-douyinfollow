import { join } from 'node:path'

type Worker = {
  recognize: (image: Buffer) => Promise<{ data: { text: string } }>
  terminate: () => Promise<void>
}

/**
 * 关键帧文字识别（best-effort）：tesseract.js 中文+英文。
 * 语言模型首次使用时下载并缓存到插件数据目录；失败时降级为空文本，
 * 不影响标题/文案/AI 讲解主链路。
 */
export class FrameOcr {
  private worker?: Worker
  private starting?: Promise<Worker | undefined>
  ready = false

  constructor(private cacheDir: string) {}

  private async ensure(): Promise<Worker | undefined> {
    if (this.worker) return this.worker
    if (!this.starting) {
      this.starting = (async () => {
        try {
          const mod = await import('tesseract.js')
          const worker = await mod.createWorker(['chi_sim', 'eng'], 1, {
            cachePath: join(this.cacheDir, 'ocr-cache'),
            logger: () => undefined,
          })
          this.worker = worker as unknown as Worker
          this.ready = true
          return this.worker
        } catch {
          this.ready = false
          return undefined
        } finally {
          this.starting = undefined
        }
      })()
    }
    return this.starting
  }

  /** 识别多帧并合并去重行。 */
  async recognize(frames: Buffer[]): Promise<string> {
    if (frames.length === 0) return ''
    const worker = await this.ensure()
    if (!worker) return ''
    const lines = new Set<string>()
    for (const frame of frames) {
      try {
        const { data } = await worker.recognize(frame)
        for (const line of data.text.split(/\r?\n/)) {
          const t = line.replace(/\s+/g, ' ').trim()
          if (t.length >= 4) lines.add(t)
        }
      } catch {
        // 单帧失败忽略
      }
    }
    return [...lines].join('\n').slice(0, 4000)
  }

  async dispose(): Promise<void> {
    const worker = this.worker
    this.worker = undefined
    this.ready = false
    if (worker) await worker.terminate().catch(() => undefined)
  }
}