// 诊断「过验证」判定：用插件自己的 profile 打开搜索页，逐项 dump captchaHit 的判定信号。
// 用法：node scripts/diagnose-human.mjs [关键词] [秒数]
import { chromium } from 'playwright-core'
import { join } from 'node:path'
import { homedir } from 'node:os'

const kw = process.argv[2] ?? 'Deepseek'
const seconds = Number(process.argv[3] ?? 60)
const userDataDir = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'plugin-data', 'douyinfollow', 'browser-profile')

const ctx = await chromium.launchPersistentContext(userDataDir, {
  channel: 'msedge',
  headless: false,
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled', '--mute-audio', '--disable-session-crashed-bubble', '--hide-crash-restore-bubble', '--noerrdialogs'],
})
const page = ctx.pages()[0] ?? await ctx.newPage()
await page.goto(`https://www.douyin.com/search/${encodeURIComponent(kw)}?type=video`, { waitUntil: 'domcontentloaded', timeout: 60000 })

const deadline = Date.now() + seconds * 1000
while (Date.now() < deadline) {
  const sig = await page.evaluate(() => {
    const txt = (document.body?.innerText || '').slice(0, 3000)
    const m = txt.match(/验证码|形状相同|滑块|拖动|captcha/i)
    const ifs = Array.from(document.querySelectorAll('iframe')).map(f => {
      const r = f.getBoundingClientRect()
      const cs = getComputedStyle(f)
      return { src: (f.src || '').slice(0, 120), w: Math.round(r.width), h: Math.round(r.height), display: cs.display, visibility: cs.visibility }
    })
    // 命中词上下文
    let ctxSnippet = ''
    if (m) { const i = txt.indexOf(m[0]); ctxSnippet = txt.slice(Math.max(0, i - 60), i + 60).replace(/\n/g, ' ') }
    return {
      url: location.href.slice(0, 140),
      title: document.title,
      titleHit: /验证码|captcha|verify/i.test(document.title),
      bodyHit: !!m, bodyWord: m?.[0] ?? '', ctxSnippet,
      iframes: ifs,
      iframeHit: ifs.some(f => /captcha|verify/i.test(f.src)),
      videoLinks: document.querySelectorAll('a[href*="/video/"]').length,
      bodyLen: (document.body?.innerText || '').length,
    }
  }).catch(e => ({ err: String(e) }))
  const cookies = await ctx.cookies('https://www.douyin.com')
  const logged = cookies.some(c => ['sessionid_ss', 'sessionid', 'passport_auth_status'].includes(c.name) && c.value.length > 0)
  console.log(JSON.stringify({ t: new Date().toISOString().slice(11, 19), logged, ...sig }))
  await new Promise(r => setTimeout(r, 3000))
}
await ctx.close()