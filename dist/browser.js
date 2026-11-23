import { mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (min, max) => min + Math.random() * (max - min);
const LOGIN_COOKIES = ['sessionid_ss', 'sessionid', 'passport_auth_status'];
/** Chrome cookie 过期时间戳（1601 纪元微秒）→ unix 秒；0 表示会话 cookie。 */
function chromeExpiresToUnix(v) {
    const n = Number(v);
    if (!n)
        return Number.MAX_SAFE_INTEGER;
    return n / 1e6 - 11644473600;
}
function ps(script, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
            if (err)
                reject(err);
            else
                resolve(stdout);
        });
    });
}
/**
 * 插件自管的持久化浏览器：登录态保存在独立 profile，巡查后台运行、不抢焦点。
 * 全程只读：不点赞、不评论、不关注、不发布。
 */
export class DouyinBrowser {
    opts;
    ctx;
    ctxHeadless;
    loginWaiter;
    humanWaiter;
    loggingIn = false;
    loginError;
    checkingHuman = false;
    humanError;
    humanConfirm = false;
    foregroundHwnd = 0;
    constructor(opts) {
        this.opts = opts;
    }
    async ensure(headless, minimize = false) {
        // 登录/人工验证等待期间不得把有头窗口换成无头：先等流程结束，避免扫到一半被关窗。
        if ((this.loggingIn || this.checkingHuman) && this.ctx && this.ctxHeadless !== headless) {
            await (this.loginWaiter ?? this.humanWaiter)?.catch(() => undefined);
        }
        if (this.ctx && this.ctxHeadless === headless)
            return this.ctx;
        await this.close();
        await this.killOrphanEdge();
        await this.markCleanExit();
        await mkdir(this.opts.userDataDir, { recursive: true });
        this.ctx = await chromium.launchPersistentContext(this.opts.userDataDir, {
            channel: this.opts.channel,
            headless,
            viewport: { width: 1440, height: 900 },
            locale: 'zh-CN',
            timezoneId: 'Asia/Shanghai',
            // 去掉「正受到自动测试软件的控制」提示条；被前台窗口遮挡时仍正常渲染/跑定时器，
            // 保证游戏/视频全屏期间后台巡查不被懒渲染或节流停摆。
            ignoreDefaultArgs: ['--enable-automation'],
            args: [
                '--disable-blink-features=AutomationControlled',
                '--mute-audio',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-background-timer-throttling',
                // 强杀残留进程会被 Edge 记为「意外关闭」，下次启动弹还原对话框盖住页面：禁掉。
                '--disable-session-crashed-bubble',
                '--hide-crash-restore-bubble',
                '--noerrdialogs',
            ],
        });
        this.ctxHeadless = headless;
        // 浏览器崩溃/被用户关窗后清掉引用：下次 ensure 干净重建，而不是抱着死上下文一直报错。
        const owned = this.ctx;
        owned.once('close', () => {
            if (this.ctx === owned) {
                this.ctx = undefined;
                this.ctxHeadless = undefined;
            }
        });
        await this.ctx.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        if (minimize && !headless) {
            // Edge 后台模式可能不自动显窗：先强制显窗（保证风控看到真实可见页面），随即缩角+置底+归还焦点。
            const p = this.ctx.pages()[0] ?? await this.ctx.newPage();
            await p.bringToFront().catch(() => undefined);
            await this.quietBounds();
            await this.restoreFocus();
        }
        return this.ctx;
    }
    /** 启动前清理上次崩溃/强杀残留的本 profile Edge 进程，避免进程堆积与 profile 锁冲突。 */
    async killOrphanEdge() {
        if (process.platform !== 'win32')
            return;
        try {
            await ps(`Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*douyinfollow*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`);
        }
        catch { /* 清理失败不阻塞启动 */ }
    }
    /** 把 profile 标记为「正常退出」，避免 Edge 启动时弹「还原页面/意外关闭」对话框盖住巡查页。 */
    async markCleanExit() {
        try {
            const { readFile, writeFile } = await import('node:fs/promises');
            const file = join(this.opts.userDataDir, 'Default', 'Preferences');
            const raw = await readFile(file, 'utf8');
            const j = JSON.parse(raw);
            j.profile = { ...(j.profile ?? {}), exit_type: 'Normal', exited_cleanly: true };
            await writeFile(file, JSON.stringify(j), 'utf8');
        }
        catch { /* 无 Preferences 或解析失败忽略 */ }
    }
    /** 记住巡查前的前台窗口， launches 后归还焦点，避免打断游戏/全屏应用。 */
    noteForeground(hwnd) {
        if (hwnd > 0)
            this.foregroundHwnd = hwnd;
    }
    /** 窗口缩到右下角 + 置底 + 不激活 + 焦点归还前台：巡查在后台跑，不置顶弹窗打断游戏/视频/工作。 */
    async quiet() {
        const hwnd = this.foregroundHwnd;
        if (process.platform !== 'win32')
            return;
        try {
            const script = [
                `Add-Type -Name W -Namespace N -MemberDefinition 'public delegate bool EnumWindowsProc(System.IntPtr h, System.IntPtr l); [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, System.IntPtr l); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint p); [DllImport("user32.dll")] public static extern bool IsWindowVisible(System.IntPtr h); [DllImport("user32.dll")] public static extern bool GetWindowRect(System.IntPtr h, out R r); public struct R { public int L; public int T; public int R2; public int B; } [DllImport("user32.dll")] public static extern bool SetWindowPos(System.IntPtr h, System.IntPtr after, int x, int y, int cx, int cy, uint flags); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int cmd);'`,
                `Add-Type -AssemblyName System.Windows.Forms`,
                `$global:rp = @( (Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*douyinfollow*' }).ProcessId )`,
                `$global:hw = [System.IntPtr]::Zero`,
                `$cb = [N.W+EnumWindowsProc]{ param($h,$l) $p = 0; [N.W]::GetWindowThreadProcessId($h, [ref]$p) | Out-Null; if ($global:rp -contains $p -and $global:hw -eq [System.IntPtr]::Zero -and [N.W]::IsWindowVisible($h)) { $r = New-Object N.W+R; [N.W]::GetWindowRect($h, [ref]$r) | Out-Null; if (($r.R2 - $r.L) -ge 200 -or ($r.L -lt -1000)) { $global:hw = $h } }; return $true }`,
                `[N.W]::EnumWindows($cb, [System.IntPtr]::Zero) | Out-Null`,
                `$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds`,
                `if ($global:hw -ne [System.IntPtr]::Zero) { [N.W]::ShowWindow($global:hw, 9) | Out-Null; [N.W]::SetWindowPos($global:hw, [System.IntPtr]1, ($b.Right - 460), ($b.Bottom - 360), 460, 360, 0x0010) | Out-Null }`,
                `if (${hwnd} -gt 0) { [N.W]::SetForegroundWindow([System.IntPtr]${hwnd}) | Out-Null }`,
            ].join('; ');
            await ps(script);
        }
        catch { /* 置底/归还焦点失败不影响功能 */ }
    }
    /** 用户主动扫码/过验证：恢复最小化窗口并置前台居中，保证用户看得见、能操作。 */
    async show() {
        if (process.platform !== 'win32')
            return;
        try {
            const script = [
                `Add-Type -Name W -Namespace N -MemberDefinition 'public delegate bool EnumWindowsProc(System.IntPtr h, System.IntPtr l); [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, System.IntPtr l); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint p); [DllImport("user32.dll")] public static extern bool IsWindowVisible(System.IntPtr h); [DllImport("user32.dll")] public static extern bool GetWindowRect(System.IntPtr h, out R r); public struct R { public int L; public int T; public int R2; public int B; } [DllImport("user32.dll")] public static extern bool SetWindowPos(System.IntPtr h, System.IntPtr after, int x, int y, int cx, int cy, uint flags); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int cmd);'`,
                `Add-Type -AssemblyName System.Windows.Forms`,
                `$global:rp = @( (Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*douyinfollow*' }).ProcessId )`,
                `$global:hw = [System.IntPtr]::Zero`,
                `$cb = [N.W+EnumWindowsProc]{ param($h,$l) $p = 0; [N.W]::GetWindowThreadProcessId($h, [ref]$p) | Out-Null; if ($global:rp -contains $p -and $global:hw -eq [System.IntPtr]::Zero -and [N.W]::IsWindowVisible($h)) { $r = New-Object N.W+R; [N.W]::GetWindowRect($h, [ref]$r) | Out-Null; if (($r.R2 - $r.L) -ge 200 -or ($r.L -lt -1000)) { $global:hw = $h } }; return $true }`,
                `[N.W]::EnumWindows($cb, [System.IntPtr]::Zero) | Out-Null`,
                `$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds`,
                `if ($global:hw -ne [System.IntPtr]::Zero) { [N.W]::ShowWindow($global:hw, 9) | Out-Null; [N.W]::SetWindowPos($global:hw, [System.IntPtr]0, ($b.Width - 1200) / 2, ($b.Height - 800) / 2, 1200, 800, 0x0040) | Out-Null; [N.W]::SetForegroundWindow($global:hw) | Out-Null }`,
            ].join('; ');
            await ps(script);
        }
        catch { /* 显窗失败不影响功能 */ }
    }
    async restoreFocus() {
        await this.quiet();
    }
    /** 把有头窗口缩到屏幕右下角：可见但不挡主窗口（最小化会触发风控/懒渲染停摆）。 */
    async quietBounds() {
        if (!this.ctx || this.ctxHeadless)
            return;
        try {
            const page = this.ctx.pages()[0] ?? await this.ctx.newPage();
            const scr = await page.evaluate(() => ({ w: window.screen.availWidth, h: window.screen.availHeight }));
            const session = await this.ctx.newCDPSession(page);
            const { windowId } = await session.send('Browser.getWindowForTarget');
            await session.send('Browser.setWindowBounds', {
                windowId,
                bounds: { windowState: 'normal', left: Math.max(0, scr.w - 460), top: Math.max(0, scr.h - 360), width: 460, height: 360 },
            });
        }
        catch { /* 摆位失败不影响功能 */ }
    }
    /** 风控识别：只认「可见的」验证码 UI；已能展示搜索结果/实质内容的页面视为已通过。
     *  旧版把 DOM 里残留的隐藏 captcha iframe/文案也当命中，导致用户过完验证后仍被误判、面板空等到超时。 */
    async captchaHit(page) {
        if (/verify\.douyin\.com|\/verify\/|\/captcha/i.test(page.url()))
            return true;
        return await page.evaluate(() => {
            const visible = (el) => {
                const r = el.getBoundingClientRect();
                if (r.width < 8 || r.height < 8)
                    return false;
                const cs = getComputedStyle(el);
                return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
            };
            // 可见的验证码 iframe（隐藏残留不算）
            if (Array.from(document.querySelectorAll('iframe')).some(f => /captcha|verify/i.test(f.src || '') && visible(f)))
                return true;
            // 可见的验证码容器（抖音 secsdk-captcha 等；不泛匹配 verify/slider，避免误伤作者认证标识/进度条）
            if (Array.from(document.querySelectorAll('[class*="captcha"], [id*="captcha"], [class*="secsdk"], [id*="secsdk"]')).some(visible))
                return true;
            // 已能看到搜索结果：定义上已过验证，忽略任何残留文案/标题
            if (document.querySelectorAll('a[href*="/video/"]').length > 0)
                return false;
            const txt = (document.body?.innerText || '').slice(0, 3000);
            if (/验证码|形状相同|滑块|拖动|captcha/i.test(txt))
                return true;
            return /验证码|captcha|verify/i.test(document.title);
        }).catch(() => false);
    }
    async pace() {
        await sleep(rand(1200, 3200));
    }
    async loggedInCookies(ctx) {
        const cookies = await ctx.cookies('https://www.douyin.com');
        return cookies.some(c => LOGIN_COOKIES.includes(c.name) && c.value.length > 0);
    }
    /** 是否已登录：活上下文直接读；否则读磁盘 cookie 表（不启浏览器、启动不弹窗）；读盘失败再无头复核（不可见）。 */
    async isLoggedIn() {
        try {
            if (this.ctx)
                return await this.loggedInCookies(this.ctx);
            const disk = await this.loginCookiesOnDisk();
            if (disk !== undefined)
                return disk;
            const ctx = await this.ensure(true);
            const ok = await this.loggedInCookies(ctx);
            // 无头复核只为读 cookie：读完即释放，避免后台进程常驻占内存。
            if (!this.opts.headlessPatrol)
                await this.close().catch(() => undefined);
            return ok;
        }
        catch {
            return false;
        }
    }
    /** 只读打开 profile 的 Cookies 表，按 cookie 名+有效期判定登录态，零浏览器启动。 */
    async loginCookiesOnDisk() {
        const file = join(this.opts.userDataDir, 'Default', 'Network', 'Cookies');
        const read = async (path) => {
            const spec = 'node:sqlite';
            const mod = (await import(spec));
            const db = new mod.DatabaseSync(path, { readOnly: true });
            try {
                const rows = db.prepare(`SELECT name, expires_utc FROM cookies WHERE host_key LIKE '%douyin.com' AND name IN (${LOGIN_COOKIES.map(() => '?').join(',')})`).all(...LOGIN_COOKIES);
                const now = Date.now() / 1000;
                return rows.some(r => chromeExpiresToUnix(r.expires_utc) > now);
            }
            finally {
                db.close();
            }
        };
        try {
            return await read(file);
        }
        catch {
            // WAL 库在只读模式可能打不开（需 shm 写权限）：复制一份再读，仍不启浏览器。
            try {
                const { mkdtemp, copyFile } = await import('node:fs/promises');
                const { tmpdir } = await import('node:os');
                const dir = await mkdtemp(join(tmpdir(), 'follow-cookies-'));
                for (const suffix of ['', '-wal', '-shm']) {
                    await copyFile(file + suffix, join(dir, 'Cookies' + suffix)).catch(() => undefined);
                }
                return await read(join(dir, 'Cookies'));
            }
            catch {
                // 宿主 node 可能不带 node:sqlite：退化为扫描 cookie 名字符串（存在性判定，零进程）。
                try {
                    const { readFile } = await import('node:fs/promises');
                    const txt = (await readFile(file)).toString('latin1');
                    return LOGIN_COOKIES.some(n => txt.includes(n));
                }
                catch {
                    return undefined;
                }
            }
        }
    }
    /** 打开有头浏览器供用户扫码；轮询登录 cookie 直到成功或超时。 */
    login() {
        if (this.loginWaiter)
            return this.loginWaiter;
        this.loggingIn = true;
        this.loginError = undefined;
        this.loginWaiter = (async () => {
            let closedEarly = false;
            let ok = false;
            try {
                const ctx = await this.ensure(false);
                ctx.once('close', () => { closedEarly = true; });
                const page = ctx.pages()[0] ?? await ctx.newPage();
                await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
                // 用户主动扫码：恢复最小化并置前台居中，保证看得见、能扫码。
                await this.show();
                const deadline = Date.now() + this.opts.loginTimeoutSeconds * 1000;
                while (Date.now() < deadline && !closedEarly) {
                    try {
                        if (await this.loggedInCookies(ctx)) {
                            ok = true;
                            return true;
                        }
                    }
                    catch {
                        closedEarly = true;
                        break;
                    }
                    await sleep(2000);
                }
                if (closedEarly) {
                    // 窗口被提前关闭（用户手动关窗等）：登录态可能已落盘，用无头上下文复核一次。
                    await this.close().catch(() => undefined);
                    if (await this.isLoggedIn()) {
                        ok = true;
                        return true;
                    }
                    this.loginError = '浏览器窗口被提前关闭且未检测到登录态：请重新点「扫码登录」，扫码后保持窗口打开直到面板显示已登录';
                    return false;
                }
                this.loginError = '登录超时：未检测到登录 cookie';
                return false;
            }
            catch (err) {
                this.loginError = String(err?.message ?? err);
                return false;
            }
            finally {
                this.loggingIn = false;
                // 成功则保留会话：风控信任态绑定浏览器会话，关窗即失效；巡查复用同一上下文。
                if (ok) {
                    await this.quietBounds();
                    await this.restoreFocus();
                }
                else
                    await this.close().catch(() => undefined);
                this.loginWaiter = undefined;
            }
        })();
        return this.loginWaiter;
    }
    /** 风控验证码中间页：开有头窗口请用户人工过一次滑块/点选，信任态落 profile。 */
    humanCheck(url) {
        if (this.humanWaiter)
            return this.humanWaiter;
        this.checkingHuman = true;
        this.humanError = undefined;
        this.humanConfirm = false;
        this.humanWaiter = (async () => {
            let ok = false;
            try {
                const ctx = await this.ensure(false);
                const page = await ctx.newPage();
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                // 用户主动过验证：恢复最小化并置前台居中，方便完成滑块/点选。
                await this.show();
                const deadline = Date.now() + this.opts.loginTimeoutSeconds * 1000;
                const startedAt = Date.now();
                let stable = 0;
                let lastReload = 0;
                let reloads = 0;
                let homeTried = false;
                while (Date.now() < deadline) {
                    // 信任恢复判定：扫描所有标签（验证可能在弹窗标签完成），任一标签无可见验证码
                    // 且（有视频链接 或 已登录且页面有实质内容）即累计；用户点「我已完成验证」后放宽为无可见验证码即可。
                    const logged = await this.loggedInCookies(ctx).catch(() => false);
                    let clean = false;
                    for (const p of ctx.pages()) {
                        if (p.isClosed() || await this.captchaHit(p))
                            continue;
                        const n = await p.locator('a[href*="/video/"]').count().catch(() => 0);
                        const bodyLen = await p.evaluate(() => (document.body?.innerText || '').length).catch(() => 0);
                        if (n > 0 || (logged && bodyLen > 200) || (this.humanConfirm && bodyLen > 50)) {
                            clean = true;
                            break;
                        }
                        // 502/空页等错误落地页：信任 cookie 已落盘但边缘仍拒旧响应，限频重载让信任态生效。
                        if (bodyLen < 50 && reloads < 8 && Date.now() - lastReload > 15000) {
                            lastReload = Date.now();
                            reloads += 1;
                            await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => undefined);
                        }
                    }
                    // 搜索页持续报错时回首页确认信任态（首页有实质内容即视为过验证成功）。
                    if (!clean && !homeTried && Date.now() - startedAt > 20000 && !(await this.captchaHit(page))) {
                        homeTried = true;
                        await page.goto('https://www.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => undefined);
                    }
                    if (clean)
                        stable += 1;
                    else
                        stable = 0;
                    if (stable >= 2 || (this.humanConfirm && clean)) {
                        ok = true;
                        return true;
                    }
                    await sleep(2000);
                }
                this.humanError = '验证超时：未等到搜索结果页，请重试';
                return false;
            }
            catch (err) {
                this.humanError = String(err?.message ?? err);
                return false;
            }
            finally {
                this.checkingHuman = false;
                this.humanConfirm = false;
                // 成功则保留会话供巡查复用（风控信任态绑定会话）；失败才关窗。
                if (ok) {
                    await this.quietBounds();
                    await this.restoreFocus();
                }
                else
                    await this.close().catch(() => undefined);
                this.humanWaiter = undefined;
            }
        })();
        return this.humanWaiter;
    }
    /** 用户在网页端完成验证后手动确认：下一轮轮询立即放宽判定，避免自动检测漏判时面板卡死。 */
    confirmHuman() {
        if (this.checkingHuman)
            this.humanConfirm = true;
    }
    /** 搜索话题视频，返回去重前的候选列表。 */
    async search(keyword, limit) {
        const ctx = await this.ensure(this.opts.headlessPatrol, !this.opts.headlessPatrol);
        const page = await ctx.newPage();
        try {
            const url = `https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=video`;
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            if (await this.captchaHit(page)) {
                throw new Error('抖音风控验证码：点面板「过验证」人工完成一次后重试');
            }
            const errPage = await page.evaluate(() => ({ t: document.title, len: (document.body?.innerText || '').length })).catch(() => ({ t: '', len: 0 }));
            if (errPage.len < 50 && /502|403|Bad Gateway|Forbidden|错误/i.test(errPage.t)) {
                throw new Error('抖音返回 502/403（风控未解除）：点面板「过验证」完成一次后重试');
            }
            await page.waitForSelector('a[href*="/video/"]', { timeout: 30000 }).catch(() => undefined);
            await this.pace();
            await page.mouse.wheel(0, 600).catch(() => undefined);
            await sleep(rand(800, 1600));
            const items = await page.evaluate(() => {
                const out = [];
                const seen = new Set();
                const anchors = Array.from(document.querySelectorAll('a[href*="/video/"]'));
                for (const a of anchors) {
                    const href = a.href || '';
                    const m = href.match(/\/video\/(\d+)/);
                    if (!m || seen.has(m[1]))
                        continue;
                    seen.add(m[1]);
                    const card = a.closest('li') ?? a.closest('[data-e2e]') ?? a.parentElement?.parentElement ?? a;
                    const text = (card.textContent || '').replace(/\s+/g, ' ').trim();
                    const title = (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim();
                    const authorEl = card.querySelector('[data-e2e="search-card-author-name"], [class*="author-name"], [class*="authorName"]');
                    const author = (authorEl?.textContent || '').trim();
                    const pm = text.match(/(\d+分钟前|\d+小时前|\d+天前|\d+周前|\d+个月前|\d+月前|昨天|前天|\d{4}-\d{2}-\d{2})/);
                    out.push({ videoId: m[1], url: `https://www.douyin.com/video/${m[1]}`, title: title || text.slice(0, 80), author, publishText: pm?.[1] });
                }
                return out;
            });
            if (items.length === 0 && await this.captchaHit(page)) {
                throw new Error('抖音风控验证码：点面板「过验证」人工完成一次后重试');
            }
            if (items.length === 0) {
                const wall = await page.evaluate(() => /登录|扫码/.test((document.body?.innerText || '').slice(0, 1500))).catch(() => false);
                if (wall)
                    throw new Error('抖音登录态失效：请点面板「扫码登录」重新登录');
            }
            return items.slice(0, limit);
        }
        finally {
            await this.closeTab(page);
        }
    }
    /** 保留一个常驻标签：Edge 关完最后一个标签会退居后台（无窗口），下次巡查再开就是弹窗打扰。 */
    async closeTab(page) {
        try {
            if (this.ctx && this.ctx.pages().length > 1)
                await page.close();
            else
                await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => undefined);
        }
        catch { /* 关标签失败不影响功能 */ }
    }
    /** 打开视频页采集标题/文案/AI 讲解/关键帧。任何一步失败都降级而非中断。 */
    async collect(item, opts) {
        const ctx = await this.ensure(this.opts.headlessPatrol, !this.opts.headlessPatrol);
        const page = await ctx.newPage();
        const result = { title: item.title, author: item.author, desc: '', frames: [] };
        try {
            await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            if (await this.captchaHit(page)) {
                throw new Error('抖音风控验证码：点面板「过验证」人工完成一次后重试');
            }
            await page.waitForSelector('video', { timeout: 30000 }).catch(() => undefined);
            await this.pace();
            const meta = await page.evaluate(() => {
                const pick = (sels) => {
                    for (const s of sels) {
                        const el = document.querySelector(s);
                        const t = (el?.textContent || '').replace(/\s+/g, ' ').trim();
                        if (t)
                            return t;
                    }
                    return '';
                };
                return {
                    title: pick(['[data-e2e="video-title"]', 'h1']),
                    // 文案限定在本视频信息区：全局 [class*="desc"] 会误抓下一条推荐视频的简介。
                    desc: pick(['[data-e2e="video-desc"]', '[data-e2e="video-info-detail"]', '[data-e2e="video-info"] [class*="desc"]']),
                    author: pick(['[data-e2e="video-author-name"]', '[class*="authorName"]', '[class*="author-name"]', 'a[href*="/user/"]']),
                };
            });
            if (meta.title)
                result.title = meta.title;
            if (meta.desc)
                result.desc = meta.desc;
            if (meta.author)
                result.author = meta.author;
            if (opts.aiSummary) {
                result.aiSummary = await this.tryAiSummary(page).catch(() => undefined);
            }
            if (opts.frames > 0) {
                result.frames = await this.captureFrames(page, opts.frames).catch(() => []);
            }
            return result;
        }
        finally {
            await this.closeTab(page);
        }
    }
    /** 尝试打开抖音内置 AI 讲解面板并读取摘要文本（有则取，无则降级）。 */
    async tryAiSummary(page) {
        const entries = [
            '[data-e2e="ai-summary-entry"]',
            '[class*="aiSummary"] [class*="entry"]',
            'button:has-text("AI 总结")',
            'button:has-text("AI总结")',
            '[class*="action"] >> text=/^AI/',
        ];
        for (const sel of entries) {
            const loc = page.locator(sel).first();
            if (await loc.isVisible().catch(() => false)) {
                await loc.click({ timeout: 5000 }).catch(() => undefined);
                await sleep(3000);
                break;
            }
        }
        const text = await page.evaluate(() => {
            const pick = (sels) => {
                for (const s of sels) {
                    const el = document.querySelector(s);
                    const t = (el?.textContent || '').replace(/\s+/g, ' ').trim();
                    if (t && t.length > 40)
                        return t;
                }
                return '';
            };
            return pick([
                '[data-e2e="ai-summary-content"]',
                '[class*="ai-summary"]',
                '[class*="aiSummary"]',
                '[class*="ai-panel"]',
            ]);
        });
        return text ? text.slice(0, 4000) : undefined;
    }
    /** 播放中截取若干关键帧（画面文字交给 OCR）。 */
    async captureFrames(page, count) {
        await page.evaluate(() => {
            const v = document.querySelector('video');
            if (v) {
                v.muted = true;
                void v.play().catch(() => undefined);
            }
        }).catch(() => undefined);
        const frames = [];
        const video = page.locator('video').first();
        for (let i = 0; i < count; i++) {
            await sleep(i === 0 ? 2500 : 3000);
            const buf = await video.screenshot({ timeout: 8000, type: 'jpeg', quality: 60 }).catch(() => undefined);
            if (buf)
                frames.push(buf);
        }
        return frames;
    }
    async close() {
        const ctx = this.ctx;
        this.ctx = undefined;
        this.ctxHeadless = undefined;
        if (ctx)
            await ctx.close().catch(() => undefined);
    }
}
