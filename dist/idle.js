/**
 * 空闲检测：监听持久化会话事件的轮次边界。
 * 有任一 agent 轮次进行中即视为忙；全部结束后再静默 quietMs 才算空闲。
 */
export class ActivityTracker {
    busy = 0;
    lastActivityAt = Date.now();
    attach(ctx) {
        // 会话事件按 dsh-scope 作用域链路由：默认只投递给会话 scope 祖先链上的监听器。
        // 插件 ctx 带独立 scope 标签、不是任何会话的祖先，不加 global 会一个事件都收不到（空闲判定永久失效）。
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
        }, { global: true });
    }
    isIdle(quietMs) {
        return this.busy === 0 && Date.now() - this.lastActivityAt >= quietMs;
    }
}
