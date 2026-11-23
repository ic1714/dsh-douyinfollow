# dsh-douyin-radar · 抖音进展雷达

适配 **DeepSeek Harness（DSH）官方桌面端 / Web UI** 的自研插件：DSH 空闲时自动巡查你设置的抖音话题视频，把视频当线索而非结论，提取事实点到 GitHub / 官网 / 官方文档等权威来源交叉核实，再以卡片流形式随时推送到独立侧栏面板。

## 能力与需求对应

| 需求 | 实现 |
| --- | --- |
| 空闲时刷抖音 | 监听会话轮次边界（`turn/start` / `turn/end`）判定空闲 + 最小巡查间隔；后台托管浏览器执行，不抢焦点 |
| 追踪我设置的内容 | 关键词/话题搜索相关新视频（不盯账号），本地增量去重 |
| 轻量理解视频 | 标题 + 文案 + 关键帧文字 OCR + 抖音内置 AI 讲解摘要（有则取，无则降级） |
| 博主说法不可信 | 独立核实会话逐条事实点交叉查证；卡片标注 已核实 / 部分核实 / 与权威来源不符 / 无法核实 + 来源链接；营销话术单独归类 |
| 随时推送、侧栏卡片 | 右栏自定义 tab「抖音进展雷达」；卡面 = 关键词 + 一句话进展 + 核实徽标，点开展详情；4 秒轮询即时刷新 |
| 只读边界 | 不点赞、不评论、不关注、不发布；路由仅接受 loopback |

## 工作流

```
空闲检测 + 间隔守卫
   → 托管浏览器搜索关键词（系统 Edge，持久化登录 profile）
   → 采集：标题/文案/AI 讲解/关键帧 OCR
   → 线索入库（去重）
   → 宿主 Schedule 派发独立后台会话（new_once）
   → 核实员用 web_search / web_fetch 查权威来源
   → douyin_radar_publish 回写卡片（服务端重算核实结论）
   → 侧栏面板卡片流推送
```

完整性规则：声称「已核实」但没有任何有效 http(s) 来源链接的事实点，服务端自动降级为「无法核实」；`overall` 一律由事实状态服务端重算，不信任回写值。

## 巡查触发与守卫

- 自动巡查（宿主每 20 秒 tick 一次）需同时满足：`enabled` 开启 + 关键词非空 + 抖音已登录 + 会话空闲（无进行中 agent 轮次，且静默超过 `idleQuietSeconds`）+ 距上次巡查 ≥ `intervalMinutes`。
- 未登录时低频复查登录态（距上次巡查 ≥ 10 分钟才查），避免每 tick 启浏览器。
- 手动「立即巡查」/ `douyin_radar_patrol` 绕过空闲与间隔守卫，但仍校验启用、关键词与登录态。
- 全屏游戏/视频/工作时**不跳过**自动巡查：窗口置底不激活、焦点归还，后台照跑。
- 登录/过验证等待期间 tick 与头模式切换让路，不打断用户操作。
- 推送时机：核实会话 `douyin_radar_publish` 回写即入列，面板 4 秒轮询刷新——随时推送、不等整批结束。

## 安装

前置：Node ≥ 22；DSH ≥ 0.2（本插件按 `0.2.2-rc.5` 开发，已在桌面端 `0.2.2-rc.1` 实测加载）；Windows 默认复用系统 Edge（`browserChannel` 可改 chrome / chromium）。

**官方桌面端（Electron）必须走 GUI 安装**：desktop profile 由 Electron 独占管理，CLI 的 `dsh plugin --profile desktop add …` 会被拒绝（`profile "desktop" is managed exclusively by the Electron application`）。

1. 打开 DSH 桌面端 → 左栏「插件」→「+ 添加插件」。
2. 粘贴本插件目录的绝对路径（或预构建 tarball 路径）→「安装」→「立即启用」→ 确认开关为 ON。
3. 重启桌面端使客户端 bundle 进入启动组合。

**Web profile** 仍可用 CLI：

```bash
dsh plugin --profile web add /path/to/dsh-douyin-radar
# 或预构建 tarball
dsh plugin --profile web add ./dsh-douyin-radar-0.1.0.tgz
```

## 首次使用

1. 右栏引导页点「抖音进展雷达」胶囊（或右栏 tab）打开面板 → 点「关键词设置」→ 输入话题关键词（逗号分隔，如 `DeepSeek，开源大模型，Harness`）→「保存设置」。关键词/间隔/自动巡查开关保存在插件数据目录，热生效、跨重启保留。
2. 点「扫码登录」，在弹出的系统 Edge 窗口中扫码；登录态保存在插件独立 profile，长期有效。也可在对话中说「扫码登录抖音」触发 `douyin_radar_login`。
3. 之后 DSH 空闲时自动巡查（打游戏/看视频/工作时照跑，窗口置底不抢前台）；也可点「立即巡查」或在对话中调用 `douyin_radar_patrol`。
4. 核实完成的卡片自动入列；点卡片展开事实点、来源链接、营销话术备注与原视频链接。

## 面板与卡片

- 顶栏：`n 未读` 徽标、立即巡查、扫码登录（未登录时）、过验证、全部已读、显示归档/隐藏归档、关键词设置；状态行显示登录态、关键词 chips、上次巡查结果与下次最早时间、风控/登录提示、「n 条线索正在核实编排中」。
- 卡面：核实徽标（已核实 / 部分核实 / 与权威来源不符 / 无法核实）+ 关键词 chip + 未读蓝点 + 时间 + 一句话进展 + 作者/发布时间；点击展开/收起。
- 详情：视频概述；事实点列表（每条带状态徽标 + 主张 + 可点击权威来源链接 + 备注）；营销话术（未经证实）单独归类；原视频链接；「标记已读」「归档/取消归档」操作。
- 归档卡片默认隐藏，「显示归档」切换查看；卡片保留上限 `retentionCards`，超出自动淘汰最旧。
- 线索侧：待核实线索数在面板提示；模型可用 `douyin_radar_skip` 跳过无关线索、`douyin_radar_verify` 重新派发核实。

## 风控与人工过验证

- 识别：标题 + 页面文字（验证码/滑块/拖动等）+ captcha iframe 三层判定，覆盖「验证码中间页」与内嵌滑块两种变体；命中即中止本次采集并在巡查记录留错误，不会空转。搜索 0 结果且页面含「登录/扫码」文案时抛「登录态失效：请重新扫码登录」，不把掉登录误报成风控或空结果。
- 面板「过验证」按钮：开有头窗口打开关键词搜索页。若出现滑块/点选请人工完成一次；若页面已能正常浏览则无需操作——判定条件为「无验证码 +（有视频链接 或 已登录且页面有实质内容）」连续两次成立，首页/恢复标签页没有视频链接也不会空等超时。
- 会话保留：登录/过验证成功后**不关窗**，浏览器上下文保留供巡查复用（关窗会丢弃风控信任态）。成功后窗口经 Win32 `ShowWindow(SW_RESTORE)` 恢复最小化（Edge 忽略 CDP 的窗口恢复，`bringToFront` 也救不了最小化窗）→ 缩右下角 460×360 → `HWND_BOTTOM` 置底 + `SWP_NOACTIVATE` → 焦点归还前台。失败才关窗。
- 用户主动窗口：点「扫码登录」/「过验证」时窗口恢复并居中 1200×800 置前台（需要你本人操作）；判定通过后自动缩角、置底、归还焦点，转回后台巡查形态。
- 信任态落在 profile：实测跨 DSH 重启存活；但 Edge 崩溃/被强杀后抖音可能重新挑战，需再点一次「过验证」完成点选。
- 登录/过验证等待期间，宿主 tick 与无头切换都会让路，不会把正在扫码/过验证的窗口关掉。
- **启动零弹窗**：登录态判定直接读 profile 的 Cookies 表（node:sqlite 只读 → 副本 → 名字扫描三级回退），不启动浏览器；实测启动后插件 Edge 进程数为 0。
- **常驻标签防弹窗**：巡查结束保留一个 about:blank 标签。Edge 关完最后一个标签会退居后台（无窗口），下次巡查再开标签就是一次弹窗打扰；保留常驻标签后窗口始终是启动时摆好的右下角小窗，不再反复弹出。
- **后台巡查不抢前台**：全屏游戏/视频/工作时自动巡查照跑；巡查窗口以 `SWP_NOACTIVATE` 置底、不激活，并把焦点归还巡查前的前台窗口（启动时与每次巡查收尾各一次）。另加 `--disable-backgrounding-occluded-windows` / `--disable-renderer-backgrounding` / `--disable-background-timer-throttling`，被全屏应用遮挡时页面仍正常渲染、不被节流停摆。
- **进程治理**：每次启动浏览器前清理上次崩溃/强杀残留的本 profile Edge 进程；浏览器崩溃或被关窗后自动清掉死上下文引用，下次巡查干净重建，不再抱着死上下文持续报错。
- **崩溃还原对话框抑制**：强杀残留进程会被 Edge 记为「意外关闭」，下次启动弹「还原页面 / Microsoft Edge 意外关闭」对话框盖住巡查页、并造成反复弹窗。已加 `--disable-session-crashed-bubble` / `--hide-crash-restore-bubble` / `--noerrdialogs`，并在启动前把 profile `Preferences` 的 `profile.exit_type` 写为 `Normal`、`exited_cleanly=true`。
- **负载控制**：关键帧默认 2 帧、JPEG 质量 60 截图后再 OCR；OCR 单 worker 串行；巡查全程串行、拟人 pacing。打游戏时如仍嫌占资源，可在面板「关键词设置」里关掉自动巡查开关，或把间隔调大。

## 配置项

`enabled` / `keywords` / `intervalMinutes` 三项可直接在侧栏面板「关键词设置」中编辑（存于 `state.json` 的 `prefs`，覆盖宿主配置默认值）。其余字段走宿主配置层（`cordis.patch.yml` / profile 配置，热生效）：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| enabled | true | 空闲自动巡查开关 |
| keywords | [] | 追踪话题关键词 |
| intervalMinutes | 60 | 两次巡查最小间隔（分钟，≥5） |
| idleQuietSeconds | 120 | 无 agent 轮次后的静默判定秒数 |
| maxVideosPerPatrol | 6 | 每次巡查最多采集新视频数（1–20） |
| ocrEnabled / frameCount | true / 2 | 关键帧 OCR 开关与帧数（JPEG q60 截图，越多越耗 CPU） |
| aiSummaryEnabled | true | 优先取抖音 AI 讲解摘要 |
| headlessPatrol | false | 有头巡查：窗口自动缩到屏幕右下角 460×360 小窗并置底不激活。无头、屏外、最小化窗口实测均被验证码拦截（信任 cookie 在场也拦），保持 false |
| browserChannel | msedge | 系统浏览器通道 |
| dataDir | 空 | 数据目录；留空用 `$DSH_HOME/plugin-data/dsh-douyin-radar` |
| loginTimeoutSeconds | 180 | 扫码等待超时 |
| retentionCards | 200 | 卡片保留上限 |

## 模型工具

`douyin_radar_status` / `douyin_radar_patrol` / `douyin_radar_leads` / `douyin_radar_publish` / `douyin_radar_skip` / `douyin_radar_cards` / `douyin_radar_login` / `douyin_radar_verify`。核实编排由 Schedule 派发的独立会话执行，提示词内置只读与来源约束。

## 数据与隐私

- `state.json`（已看视频、线索、卡片、巡查记录）与 `browser-profile/`（抖音登录 cookie）全部本地保存，原子写盘。
- 面板通道 `/plugin-data/dsh-douyin-radar/*` 仅接受 loopback 请求。
- 抖音 AI 讲解本身标注「仅供参考」，本插件只将其作为线索补充，不作为事实结论。

## 已知限制与风险

- 抖音网页前端改版可能使选择器失效：采集会降级为标题/文案链路并记录错误，不会中断插件；必要时更新 `src/browser.ts` 选择器。
- 抖音风控：无头、屏外、最小化窗口（`visibilityState=hidden` 或窗口不可见）都会被验证码拦截，信任 cookie 在场也拦。默认有头 + 右下角小窗置底 + 低频（建议间隔 ≥ 10 分钟）+ 拟人 pacing + 只读是缓解手段；详见「风控与人工过验证」。
- OCR 语言模型首次使用时从 CDN 下载并缓存到数据目录；失败时降级为空文本。
- 核实会话消耗模型配额；线索量由 `maxVideosPerPatrol` 控制。
- 验证状态：已在真实桌面端（0.2.2-rc.1）端到端 live 验证（2026-11-21）：entry 激活、tab 注册、面板取数与配置写回、扫码登录、风控识别与人工过验证、有头小窗巡查搜索（found=6）、采集（标题/文案/关键帧 OCR）、Schedule 派发独立核实会话、`douyin_radar_publish` 回写 5 张卡片（含 verified / contradicted / unverified 与权威来源链接、营销话术归类）全链路通过；确定性逻辑通过 `scripts/smoke.mjs` 自测。个别视频页仍可能单独命中风控，该条采集降级记录错误、不影响同批其他视频。
- 打扰/性能治理验证（2026-11-22）：启动后插件 Edge 进程数 = 0（读盘判定登录态）；巡查期间前台焦点保持在用户应用（不被 Edge 抢走）；「还原页面/意外关闭」崩溃对话框已抑制；最小化窗口经 Win32 恢复后缩角置底。无头/屏外/最小化三种隐藏方式均实测被风控拦截，故保留「有头可见但置底小窗」方案。Edge 崩溃/强杀后风控信任需一次人工过验证恢复。
- 启动报 `web boot: 1 entry did not activate / dsh-douyin-radar: failed` 时：查看 `%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log` 的 renderer console 段，本插件激活失败会打印 `[radar-apply]` 错误栈；也可在崩溃对话框选「禁用第三方插件、备份 profile patch 并重启」先恢复应用。

## 开发

```bash
npm install
npm run build        # tsc 宿主 + esbuild 客户端 lazy-CJS bundle
node scripts/smoke.mjs   # 确定性逻辑自测
```

目录：`src/index.ts` 入口；`config/store/idle/browser/ocr/engine/tools/routes` 宿主各层；`src/client/index.ts` 侧栏面板；`cordis.patch.yml` 组合补丁；`scripts/build-client.mjs` 客户端打包。

## 许可

MIT