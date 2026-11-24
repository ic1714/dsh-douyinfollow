# douyinfollow · 抖音跟进

适配 **DeepSeek Harness（DSH）官方桌面端 / Web UI** 的自研插件：DSH 空闲时自动搜索你设置的抖音话题视频，把视频当线索而非结论，提取事实点到 GitHub / 官网 / 官方文档等权威来源交叉核实，再以卡片流形式随时推送到独立侧栏面板。

## 能力与需求对应

| 需求 | 实现 |
| --- | --- |
| 空闲时刷抖音 | 监听会话轮次边界（`turn/start` / `turn/end`）判定空闲 + 最小跟进间隔；后台托管浏览器执行，不抢焦点 |
| 追踪我设置的内容 | 关键词/话题搜索相关新视频（不盯账号），本地增量去重 |
| 轻量理解视频 | 标题 + 文案 + 关键帧文字 OCR + 抖音内置 AI 讲解摘要（有则取，无则降级） |
| 博主说法不可信 | 独立核实会话逐条事实点交叉查证；卡片标注 已核实 / 部分核实 / 与权威来源不符 / 无法核实 + 来源链接；营销话术单独归类 |
| 随时推送、侧栏卡片 | 右栏自定义 tab「抖音跟进」；卡面 = 关键词 + 一句话进展 + 核实徽标，点开展详情；4 秒轮询即时刷新 |
| 只在指定时间段跑 | 全天 / 谷时·半价 / 峰时 / 自定义窗口四种模式；自动跟进受时间段约束，手动跟进不受限 |
| 知道花了多少钱 | 精确统计核实会话 token 用量，按 DeepSeek 官方峰谷牌价入账；今日/近7天/累计 + 批次明细 + 卡片批次花费 |
| 只读边界 | 不点赞、不评论、不关注、不发布；路由仅接受 loopback |

## 工作流

```
空闲检测 + 间隔守卫 + 时间段守卫
   → 托管浏览器搜索关键词（系统 Edge，持久化登录 profile）
   → 采集：标题/文案/AI 讲解/关键帧 OCR
   → 线索入库（去重）
   → 宿主 Schedule 派发独立后台会话（new_once，登记 sessionId 归属）
   → 核实员用 web_search / web_fetch 查权威来源
   → douyin_follow_publish 回写卡片（服务端重算核实结论）
   → 侧栏面板卡片流推送；核实会话 token 用量按峰谷牌价计入花费
```

完整性规则：声称「已核实」但没有任何有效 http(s) 来源链接的事实点，服务端自动降级为「无法核实」；`overall` 一律由事实状态服务端重算，不信任回写值。

## 自动跟进触发与守卫

- 自动跟进（宿主每 20 秒 tick 一次）需同时满足：`enabled` 开启 + 关键词非空 + 处于跟进时间段 + 抖音已登录 + 会话空闲（无进行中 agent 轮次，且静默超过 `idleQuietSeconds`）+ 距上次跟进 ≥ `intervalMinutes`。
- 未登录时低频复查登录态（距上次跟进 ≥ 10 分钟才查），避免每 tick 启浏览器。
- 手动「立即跟进」/ `douyin_follow_patrol` 绕过空闲、间隔与时间段守卫，但仍校验启用、关键词与登录态。
- 全屏游戏/视频/工作时**不跳过**自动跟进：窗口置底不激活、焦点归还，后台照跑。
- 登录/过验证等待期间 tick 与头模式切换让路，不打断用户操作。
- 推送时机：核实会话 `douyin_follow_publish` 回写即入列，面板 4 秒轮询刷新——随时推送、不等整批结束。

## 跟进时间段

面板「设置」里一排快速预设，点选后「保存设置」即生效（存于 `state.json` 的 `prefs`，热生效、跨重启保留）：

| 模式 | 规则 |
| --- | --- |
| 全天（默认） | 不限制，与旧版行为一致 |
| 谷时·半价 | 官方峰时之外自动跟进，含周末全天；谷时模型调用半价 |
| 峰时 | 仅官方峰时自动跟进（此时段模型调用全价） |
| 自定义 | 每日窗口编辑器，格式 `HH:MM-HH:MM`，支持跨午夜（如 `22:00-06:00`），最多 6 条；空列表视为全天 |

- 官方峰时定义（北京时间）：**工作日 9:00–12:00、14:00–18:00**，其余均为谷时（含周末全天）；谷时价格 = 峰时一半。见 [DeepSeek 官方价格页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)。
- 峰谷预设按**北京时间（UTC+8）**判定，与官方计费对齐；自定义窗口按**机器本地时间**。
- 时间段只约束**自动跟进**；手动「立即跟进」/ `douyin_follow_patrol` 不受限。窗口内启动的跟进与核实会话允许跑完，不因出窗中断。
- 面板状态行在窗口外显示「窗口外 · 下次开窗 …」；「下次最早」取间隔到期与下次开窗的较晚者。
- 已知近似：官方把法定节假日也算谷时，本插件不内置节假日日历，按周一~周五判峰时（节假日略保守，少跑几个其实便宜的时段）。

## 安装

前置：Node ≥ 22；DSH ≥ 0.2（本插件按 `0.2.2-rc.5` 开发，已在桌面端 `0.2.2-rc.1` 实测加载）；Windows 默认复用系统 Edge（`browserChannel` 可改 chrome / chromium）。

仓库已直接提交构建产物（`dist/`），**以下所有安装方式都无需编译、无需安装开发依赖**。

**官方桌面端（Electron）必须走 GUI 安装**：desktop profile 由 Electron 独占管理，CLI 的 `dsh plugin --profile desktop add …` 会被拒绝（`profile "desktop" is managed exclusively by the Electron application`）。

1. 获取插件（任选其一）：
   - 在本仓库 GitHub 页面点 Code → Download ZIP，解压，记住含 `package.json` 的那层文件夹路径；
   - 或到 [Releases](https://github.com/ic1714/dsh-douyinfollow/releases) 下载对应版本的 `.tgz` 安装包（最新标签 `0.2.2_v4`，包内版本 `0.2.2-v.4`；旧版本同页取）；
   - 或开发者直接 clone 本仓库。
2. 打开 DSH 桌面端 → 左栏「插件」→「+ 添加插件」。
3. 粘贴插件目录的绝对路径（或 `.tgz` 路径）→「安装」→「立即启用」→ 确认开关为 ON。
4. 重启桌面端使客户端 bundle 进入启动组合。

**Web profile** 可用 CLI：

```bash
# 直接从 GitHub 仓库安装（无需手动下载）
dsh plugin --profile web add github:ic1714/dsh-douyinfollow
# 或本地目录（ZIP 解压 / clone 后的路径）
dsh plugin --profile web add /path/to/douyinfollow
# 或预构建 tarball（从 Releases 页下载对应版本）
dsh plugin --profile web add ./douyinfollow-0.2.2-v.4.tgz
```

## 首次使用

1. 右栏引导页点「抖音跟进」胶囊（或右栏 tab）打开面板 → 点「设置」→ 输入话题关键词（逗号分隔，如 `DeepSeek，开源大模型，Harness`）→ 选配跟进时间段 →「保存设置」。关键词/间隔/自动跟进开关/时间段保存在插件数据目录，热生效、跨重启保留。
2. 点「扫码登录」，在弹出的系统 Edge 窗口中扫码；登录态保存在插件独立 profile，长期有效。也可在对话中说「扫码登录抖音」触发 `douyin_follow_login`。
3. 之后 DSH 空闲时自动跟进（打游戏/看视频/工作时照跑，窗口置底不抢前台）；也可点「立即跟进」或在对话中调用 `douyin_follow_patrol`。
4. 核实完成的卡片自动入列；点卡片展开事实点、来源链接、营销话术备注、原视频链接与本批核实花费。

## 面板与卡片

- 顶栏：`n 未读` 徽标、立即跟进、扫码登录（未登录时）、过验证、全部已读、显示归档/隐藏归档、设置；状态行显示登录态、今日花费、窗口外提示、关键词 chips、上次跟进结果与下次最早时间、风控/登录提示、「n 条线索正在核实编排中」。
- 卡面：核实徽标（已核实 / 部分核实 / 与权威来源不符 / 无法核实）+ 关键词 chip + 未读蓝点 + 时间 + 一句话进展 + 作者/发布时间；点击展开/收起。
- 详情：视频概述；事实点列表（每条带状态徽标 + 主张 + 可点击权威来源链接 + 备注）；营销话术（未经证实）单独归类；原视频链接；本批核实花费（同批卡片共享）；「标记已读」「归档/取消归档」操作。
- 设置区：关键词、跟进最小间隔、自动跟进开关、跟进时间段（预设 + 自定义窗口编辑器）、核实花费统计（今日/近7天/累计 + 最近批次明细）。
- 归档卡片默认隐藏，「显示归档」切换查看；卡片保留上限 `retentionCards`，超出自动淘汰最旧。
- 线索侧：待核实线索数在面板提示；模型可用 `douyin_follow_skip` 跳过无关线索、`douyin_follow_verify` 重新派发核实。

## 花费统计

DSH 纯按量计费，本插件把**自己派发的核实会话**的消耗精确入账：

1. 派发核实会话时（Schedule `new_once` 创建即预留 sessionId），登记 `sessionId → batchId` 归属映射，持久化到 `state.json`，重启后归属不丢。
2. 监听宿主 `session/event`：`request/header` 记录 provider/model，`assistant/message` 携带适配器上报的**精确 token 用量**（未命中输入 / 缓存命中输入 / 输出分桶），逐条计价入账。
3. 计价按请求时刻的官方峰谷状态（北京时间）自动选档，谷时半价。默认价格表（元/百万 token，2026-09-10 起生效）：

| deepseek-flash | 谷时 | 峰时 |
| --- | --- | --- |
| 输入·缓存命中 | 0.02 | 0.04 |
| 输入·未命中 | 1.0 | 2.0 |
| 输出 | 4.0 | 8.0 |

另内置 deepseek-v4-pro 档（缓存命中 0.15/0.30、未命中 4.5/9.0、输出 13.5/27.0）；旧模型名（deepseek-chat / deepseek-v4-flash 等）归一到 flash 档，未知模型按 flash 档兜底。官方调价后可经宿主配置 `pricingJson` 覆盖（峰时价，谷时自动半价）。

展示与查询：

- 状态行常驻「今日 ¥…」chip；设置区有今日 / 近7天 / 累计的调用次数、token 与金额，以及最近批次明细。
- 卡片详情显示「本批核实花费 ¥…（同批卡片共享）」。
- 对话中可用 `douyin_follow_usage` 直接查；`douyin_follow_status` 也带今日/累计花费。
- 花费区底部与 `douyin_follow_usage` 带「事件诊断：收到 / 归属 / 入账」（内存计数、重启归零）：「收到」长期为 0 说明会话事件没到插件；「收到」有数但「入账」为 0 说明归属或用量字段问题。

口径与边界：

- token 数为适配器上报的精确值；金额按 DeepSeek 官方 API 牌价计算，即实际花费口径。
- 只统计本插件派发的核实会话，**不含你的主对话消耗**；主对话里调用 `douyin_follow_*` 工具本身的开销属于主会话，不计入。
- 插件停机期间的用量不计入（不做回补）；升级前的历史消耗无数据。
- 日汇总保留 400 天，明细保留最近 1000 条，批次保留最近 200 个；累计总额长期保留。

## 风控与人工过验证

- 识别：标题 + 页面文字（验证码/滑块/拖动等）+ captcha iframe 三层判定，覆盖「验证码中间页」与内嵌滑块两种变体；命中即中止本次采集并在跟进记录留错误，不会空转。搜索 0 结果且页面含「登录/扫码」文案时抛「登录态失效：请重新扫码登录」，不把掉登录误报成风控或空结果。
- 面板「过验证」按钮：开有头窗口打开关键词搜索页。若出现滑块/点选请人工完成一次；若页面已能正常浏览则无需操作——判定条件为「无验证码 +（有视频链接 或 已登录且页面有实质内容）」连续两次成立，首页/恢复标签页没有视频链接也不会空等超时。
- 会话保留：登录/过验证成功后**不关窗**，浏览器上下文保留供跟进复用（关窗会丢弃风控信任态）。成功后窗口经 Win32 `ShowWindow(SW_RESTORE)` 恢复最小化（Edge 忽略 CDP 的窗口恢复，`bringToFront` 也救不了最小化窗）→ 缩右下角 460×360 → `HWND_BOTTOM` 置底 + `SWP_NOACTIVATE` → 焦点归还前台。失败才关窗。
- 用户主动窗口：点「扫码登录」/「过验证」时窗口恢复并居中 1200×800 置前台（需要你本人操作）；判定通过后自动缩角、置底、归还焦点，转回后台跟进形态。
- 信任态落在 profile：实测跨 DSH 重启存活；但 Edge 崩溃/被强杀后抖音可能重新挑战，需再点一次「过验证」完成点选。
- **过验证可中断**：点「取消验证」或直接关闭验证窗口都会立即结束本次验证并给出重试提示（旧版关窗后对空标签列表空转到超时，面板按钮卡死无响应）；过验证的导航与重载放后台执行，抖音落地页卡加载不再拖住窗口置前台与判定循环。
- 登录/过验证等待期间，宿主 tick 与无头切换都会让路，不会把正在扫码/过验证的窗口关掉。
- **启动零弹窗**：登录态判定直接读 profile 的 Cookies 表（node:sqlite 只读 → 副本 → 名字扫描三级回退），不启动浏览器；实测启动后插件 Edge 进程数为 0。
- **常驻标签防弹窗**：跟进结束保留一个 about:blank 标签。Edge 关完最后一个标签会退居后台（无窗口），下次跟进再开标签就是一次弹窗打扰；保留常驻标签后窗口始终是启动时摆好的右下角小窗，不再反复弹出。
- **后台跟进不抢前台**：全屏游戏/视频/工作时自动跟进照跑；跟进窗口以 `SWP_NOACTIVATE` 置底、不激活，并把焦点归还跟进前的前台窗口（启动时与每次跟进收尾各一次）。另加 `--disable-backgrounding-occluded-windows` / `--disable-renderer-backgrounding` / `--disable-background-timer-throttling`，被全屏应用遮挡时页面仍正常渲染、不被节流停摆。
- **进程治理**：每次启动浏览器前清理上次崩溃/强杀残留的本 profile Edge 进程；浏览器崩溃或被关窗后自动清掉死上下文引用，下次跟进干净重建，不再抱着死上下文持续报错。
- **崩溃还原对话框抑制**：强杀残留进程会被 Edge 记为「意外关闭」，下次启动弹「还原页面 / Microsoft Edge 意外关闭」对话框盖住跟进页、并造成反复弹窗。已加 `--disable-session-crashed-bubble` / `--hide-crash-restore-bubble` / `--noerrdialogs`，并在启动前把 profile `Preferences` 的 `profile.exit_type` 写为 `Normal`、`exited_cleanly=true`。
- **负载控制**：关键帧默认 2 帧、JPEG 质量 60 截图后再 OCR；OCR 单 worker 串行；跟进全程串行、拟人 pacing。打游戏时如仍嫌占资源，可在面板「设置」里关掉自动跟进开关，或把间隔调大。

## 配置项

`enabled` / `keywords` / `intervalMinutes` / `scheduleMode` / `activeWindows` 五项可直接在侧栏面板「设置」中编辑（存于 `state.json` 的 `prefs`，覆盖宿主配置默认值）。其余字段走宿主配置层（`cordis.patch.yml` / profile 配置，热生效）：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| enabled | true | 空闲自动跟进开关 |
| keywords | [] | 追踪话题关键词 |
| intervalMinutes | 60 | 两次跟进最小间隔（分钟，≥5） |
| scheduleMode | all | 自动跟进时间段：all 全天 / offpeak 谷时 / peak 峰时 / custom 自定义 |
| activeWindows | [] | custom 模式每日窗口（HH:MM-HH:MM，支持跨午夜，≤6 条；空 = 全天） |
| idleQuietSeconds | 120 | 无 agent 轮次后的静默判定秒数 |
| maxVideosPerPatrol | 6 | 每次跟进最多采集新视频数（1–20） |
| ocrEnabled / frameCount | true / 2 | 关键帧 OCR 开关与帧数（JPEG q60 截图，越多越耗 CPU） |
| aiSummaryEnabled | true | 优先取抖音 AI 讲解摘要 |
| headlessPatrol | false | 有头跟进：窗口自动缩到屏幕右下角 460×360 小窗并置底不激活。无头、屏外、最小化窗口实测均被验证码拦截（信任 cookie 在场也拦），保持 false |
| browserChannel | msedge | 系统浏览器通道 |
| dataDir | 空 | 数据目录；留空用 `$DSH_HOME/plugin-data/douyinfollow` |
| loginTimeoutSeconds | 180 | 扫码等待超时 |
| retentionCards | 200 | 卡片保留上限 |
| pricingJson | 空 | 花费价格表覆盖（JSON，峰时价，元/百万token）；留空用官方默认价，谷时自动半价 |

## 模型工具

`douyin_follow_status` / `douyin_follow_patrol` / `douyin_follow_leads` / `douyin_follow_publish` / `douyin_follow_skip` / `douyin_follow_cards` / `douyin_follow_login` / `douyin_follow_verify` / `douyin_follow_usage`。核实编排由 Schedule 派发的独立会话执行，提示词内置只读与来源约束。

## 数据与隐私

- `state.json`（已看视频、线索、卡片、跟进记录、花费统计）与 `browser-profile/`（抖音登录 cookie）全部本地保存，原子写盘。
- 面板通道 `/plugin-data/douyinfollow/*` 仅接受 loopback 请求。
- 抖音 AI 讲解本身标注「仅供参考」，本插件只将其作为线索补充，不作为事实结论。

## 已知限制与风险

- 抖音网页前端改版可能使选择器失效：采集会降级为标题/文案链路并记录错误，不会中断插件；必要时更新 `src/browser.ts` 选择器。
- 抖音风控：无头、屏外、最小化窗口（`visibilityState=hidden` 或窗口不可见）都会被验证码拦截，信任 cookie 在场也拦。默认有头 + 右下角小窗置底 + 低频（建议间隔 ≥ 10 分钟）+ 拟人 pacing + 只读是缓解手段；详见「风控与人工过验证」。
- OCR 语言模型首次使用时从 CDN 下载并缓存到数据目录；失败时降级为空文本。
- 核实会话消耗模型配额；线索量由 `maxVideosPerPatrol` 控制，花费见面板统计，可用谷时模式减半。
- 峰谷判定不内置法定节假日日历（按周一~周五判峰时）；官方调价后需更新 `pricingJson` 或插件默认价格表。
- 验证状态：已在真实桌面端（0.2.2-rc.1）端到端 live 验证（2026-11-21）：entry 激活、tab 注册、面板取数与配置写回、扫码登录、风控识别与人工过验证、有头小窗搜索（found=6）、采集（标题/文案/关键帧 OCR）、Schedule 派发独立核实会话、`douyin_follow_publish` 回写 5 张卡片（含 verified / contradicted / unverified 与权威来源链接、营销话术归类）全链路通过；确定性逻辑通过 `scripts/smoke.mjs` 自测。个别视频页仍可能单独命中风控，该条采集降级记录错误、不影响同批其他视频。
- 打扰/性能治理验证（2026-11-22）：启动后插件 Edge 进程数 = 0（读盘判定登录态）；跟进期间前台焦点保持在用户应用（不被 Edge 抢走）；「还原页面/意外关闭」崩溃对话框已抑制；最小化窗口经 Win32 恢复后缩角置底。无头/屏外/最小化三种隐藏方式均实测被风控拦截，故保留「有头可见但置底小窗」方案。Edge 崩溃/强杀后风控信任需一次人工过验证恢复。
- 0.2.2-v.2 / 标签 0.2.2_v2（2026-11-24）：跟进时间段（跨午夜/边界/周末峰谷/下次开窗）、峰谷计价（缓存分桶/价格表覆盖）、用量归属与入账的确定性逻辑全部通过 `scripts/smoke.mjs`；桌面端 live 验证待重启加载新版后进行。
- 0.2.2-v.3 / 标签 0.2.2_v3（2026-11-24）：修复过验证卡死——关窗/取消立即结束并提示重试、导航与重载改后台不再被卡加载的落地页拖住；确定性逻辑通过 `scripts/smoke.mjs`，桌面端 live 验证待重装后进行。
- 0.2.2-v.4 / 标签 0.2.2_v4（2026-11-24）：修复花费统计与空闲检测收不到 `session/event`——dsh-scope 按作用域链路由事件，插件 ctx 不在会话 scope 祖先链上，普通监听被过滤（v2/v3 今日¥0.00 根因）；监听改 `global: true` 注册，smoke 加回归断言；新增事件诊断计数（收到/归属/入账）。空闲守卫自本版真正生效：主会话轮次进行中自动跟进让路。
- 启动报 `web boot: 1 entry did not activate / douyinfollow: failed` 时：查看 `%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log` 的 renderer console 段，本插件激活失败会打印 `[follow-apply]` 错误栈；也可在崩溃对话框选「禁用第三方插件、备份 profile patch 并重启」先恢复应用。

## 开发

普通用户无需本节：仓库已含构建产物，安装即用。修改源码才需要：

```bash
pnpm install         # 安装开发依赖（DSH 框架、TypeScript、esbuild 等）
pnpm build           # tsc 宿主 + esbuild 客户端 lazy-CJS bundle，输出到 dist/
pnpm smoke           # 确定性逻辑自测
pnpm pack            # 生成可安装的 .tgz（打包前自动重新构建）
```

修改 `src/` 后请执行 `pnpm build`，并把更新后的 `dist/` 随源码一并提交，保证 github: / ZIP 安装的用户直接拿到新版本。

**版本号规范**：DSH 兼容版本 + 插件迭代号。npm 包版本须为合法 semver，写作 `0.2.2-v.4`（预发布格式，数字段保证 v2 < v3 < … < v10 排序正确）；对外标签 / git tag 用 `0.2.2_v4`。每次插件发版迭代号 +1；DSH 升到 0.3 后从 `0.3.0-v.1` 重新计。

**发布与版本隔离**：仓库只提交源码与 `dist/`，安装包不入库；每个版本一个 git tag，`.tgz` 挂在该 tag 的 [GitHub Release](https://github.com/ic1714/dsh-douyinfollow/releases) 附件里，旧版本去 Releases 页取，根目录不再堆安装包。发版流程：改 `package.json` 版本 → `pnpm build` + `pnpm smoke` → 源码与 `dist/` 提交推送 → 打**带发布说明的 annotated tag**（`git tag -a 0.2.2_v3 -m "本次改动…"`)→ 推 tag；`.github/workflows/release.yml` 自动构建 + smoke + pack + 发 Release（tag 说明即 Release 正文）。推 main 时会自动补发尚无 Release 的 tag。本地 `pnpm pack` 产物已被 gitignore，仅供本机安装。

目录：`src/index.ts` 入口；`config/store/idle/browser/ocr/engine/tools/routes` 宿主各层；`schedule.ts` 时间段与峰谷判定；`pricing.ts` 价格表与计价；`usage.ts` 用量归属与花费统计；`src/client/index.ts` 侧栏面板；`cordis.patch.yml` 组合补丁；`scripts/build-client.mjs` 客户端打包。

## 许可

MIT