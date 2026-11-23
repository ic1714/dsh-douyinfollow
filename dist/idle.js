/**
 * 空闲检测：监听持久化会话事件的轮次边界。
 * 有任一 agent 轮次进行中即视为忙；全部结束后再静默 quietMs 才算空闲。
 */
export class ActivityTracker {
    busy = 0;
    lastActivityAt = Date.now();
    attach(ctx) {
        ctx.on('session/event', (_session, event) => {
            const type = event.type;
            if (type === 'turn/start') {
                this.busy += 1;
                this.lastActivityAt = Date.now();
            }
            else if (type === 'turn/end') {
                this.busy = Math.max(0, this.busy - 1);
                this.lastActivityAt = Date.now();
            }
        });
    }
    isIdle(quietMs) {
        return this.busy === 0 && Date.now() - this.lastActivityAt >= quietMs;
    }
}
