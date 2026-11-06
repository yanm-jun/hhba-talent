# HHBA Edge P0 — 独立真实网络联调环境（2026-11-07）

## 为什么建立单独的实验项目

原始 `hhba-talent` Cloudflare Pages 在 Preview 中包含约 31 项环境变量和数个隐藏的 `secret_text`。现有 Cloudflare API 不返回这些 Secret 的实际值，整组读回并 PATCH 的更新方式可能误删短信、AI、后台等其他服务密钥。为了不影响 hhba.work、主项目预览和现有数据，建立**单独 Pages 项目** `hhba-edge-p0-lab`。

- 项目域名：`https://hhba-edge-p0-lab.pages.dev`（仅用于联调；**非正式 HHBA 网站**）。
- 这个独立项目使用开发分支 `feature/apply-edge-isolated-live-lab-20261107` 作为**自身**发布分支；**没有**将 `yanm-jun/hhba-talent` 的 `main` 改为别的分支，也没有修改 hhba.work。
- 实验项目最小化构建使用 `edge-lab-minimal-build.py && edge-lab-noindex.py`，**仅**生成内部警告首页、插件隐私说明、robots、noindex headers 和 Pages Functions `/api/apply/*` 路由白名单；不在实验域名发布完整 HHBA 主页、招聘目录、管理员页面或其他 API。**原 HHBA Pages 仍使用完整既有构建，不受改动。**
- **数据库仅绑定现有 Preview PNVS D1**，未引用生产 D1 ID；其他 D1/R2 不配置，避免访问正式简历/指标/支付。
- 新项目只设置本次配对所需的独立随机 Secret（配对 pepper、AES-256-GCM 密钥），无支付宝、短信、DeepSeek 秘钥；付款和付费任务默认关闭。**不要将 Secret 明文写入文档、代码、CI、日志或截图。**
- 固定开发扩展 Origin 使用 `chrome-extension://fjkcpgikachmfhajlghgekeicgbdagej`，仅为**测试**；源于 `tests/fixtures/edge-lab-public-key.b64` 的公钥，私钥从未保存或发布；不等于 Microsoft Edge Add-ons 审核后的正式商店 ID。
- 手工内测：使用环境变量 `HHBA_EDGE_LAB_ID=1` 调用 `stage-preview.mjs`，输入**精确的实验室域名**，生成显著标注的内部扩展目录。默认路径保持原有动态生成本地测试身份，正式商店 ZIP 完全不包含测试公钥或 `manifest.key`。

## 自动化实时 HTTPS 安全烟测

`apps/web/scripts/edge-lab-live-smoke.py` 只允许固定的 lab 域名，使用公网 HTTPS 测试真实 Cloudflare 部署，不使用任何账号或个人数据：

1. `/api/apply/config` 应表明 `pairingEnabled=true`、`profileSyncEnabled=true`；`paymentEnabled=false`、`tasksEnabled=false`。
2. 从正确测试扩展来源发出的 `OPTIONS /api/apply/extension/wallet` 预检成功并有精确 `Access-Control-Allow-Origin`，绝不允许凭证跨源泛化。
3. 缺失或伪造 `Origin` 的 `POST /api/apply/extension/wallet` 应拒绝（403）。
4. 正确 Origin + **虚构、未签发**的设备形状 Bearer 也应拒绝（401）。
5. 无效连接码不得兑换设备凭证；没有正式网站登录令牌不得准备结构化简历同步。
6. 页面必须显示 HHBA 品牌，`/robots.txt` 拒绝索引，插件隐私政策可读取。

烟测在 GitHub Actions 的独立工作流 `HHBA Edge P0 Isolated Cloudflare Lab Live Smoke` 中执行，仅本开发分支的 PR 触发，且先校验公钥身份。部署未成功前烟测会等待最多 240 秒；结果失败不得标注为“已联调通过”。

## 仍须进一步完成的真实账号 E2E

实时烟测**并不**是有账号的完整端到端联调。需要用**短期、单独生成的非公开测试令牌**及虚构简历在 lab 服务端跑完创建配对码、真实浏览器兑换、资料加密上传/领取和撤销，并在结束后清除 Preview D1 中的测试账号/简历/设备数据。不能在公开 CI 文件或 PR 日志公开仍然有效的令牌/连接码。普通求职者也不能在 lab 上传真实简历。

待最终人工确认：Microsoft Edge Windows/macOS 实机、Partner Center 上架 ID 与隐私政策、官网部署、到期数据清理 Worker Cron 配置。开发顺序依赖 #272→#273→#274→#275→#276→#277→本 PR，默认不改 main、hhba.work、支付宝或 DeepSeek。

## 操作安全

- 独立 Pages 项目的生产分支只是**实验项目内部**的发布分支，并非 HHBA 正式网站生产分支。
- 新实验项目若不用，应单独清理（删除前先确认没有其他引用）；**不能**在结束测试时误删除主项目、正式 PNVS D1 或 Preview PNVS D1。
- 尽量维持真实 App 的来源校验：即使测试域名，也不能让 `Origin` 缺失、任意扩展 ID 或网站 Cookie 获得设备资料。

## 隔离过期密文清理 Worker：已部署与计划核验

Cloudflare 账号中新增 **`hhba-edge-p0-lab-expiry-janitor`**，只用于实验室；从本分支的 `apps/web/workers/apply-profile-transfer-janitor.js` 与 `apps/web/functions/_lib/apply-profile-sync.js` 上传为 ESM Worker，公开 HTTP 路由始终返回 404。

**2026-11-07 完成的配置核验：**
- Worker 已部署并有正式 deployment 记录；`HHBA_PNVS_AUTH_DB` 是 **Preview PNVS D1** `8916eebc-c730-4597-8a6b-abe16cec1e40`，明确不同于生产 PNVS D1。
- `HHBA_APPLY_CLEANUP_ENABLED=1` 只在此独立测试 Worker 中生效。原 Pages 的 Preview 和 Production Secret 均未修改。
- Worker Cron Trigger 已创建，Cloudflare 返回 `*/15 * * * *`。即按 UTC 每 15 分钟运行其 `scheduled()` 事件。
- 清理 SQL 只针对 `hhba_apply_profile_transfers`：`expires_at <= 当前时间 OR claimed_at IS NOT NULL`，不删除未过期且未领取的数据，不读取明文简历或 R2 文件。
- 配置前核对 D1 Time Travel 恢复书签可获取、转移暂存表为零条；Worker 绑定和 Cron 再读取后均匹配。

**验收边界：** 以上证明代码、部署、资源绑定和 Cron 配置生效；Cloudflare 的计划变更可能延迟传播，尚未在 Cron Events 中观察到第一次实际运行，不得宣称已经核验过真实定时触发的删除结果。上线正式网站前，仍必须为正式环境单独评估绑定、数据保留期限和权限；不能沿用实验室的 Preview D1 与测试密钥。

## Windows/macOS Microsoft Edge 内部手工验收包

GitHub Actions `HHBA Edge P0 Isolated Cloudflare Lab Live Smoke` 在通过 HTTPS 安全烟测后，生成**仅开发者/内部测试使用**的 Artifact `hhba-edge-p0-lab-qa-only`。2026-11-07 验收 run：`https://github.com/yanm-jun/hhba-talent/actions/runs/42285938934`（已确实生成、非空，内含 `hhba-edge-p0-lab-qa-only.zip`）。

在 Windows 或 macOS 的 Edge **手工内部测试**时：
1. 登录项目 GitHub，在上述 Actions run 的 Artifacts 区域领取 `hhba-edge-p0-lab-qa-only`，解压外层 Artifact，再解压里面的 `hhba-edge-p0-lab-qa-only.zip`，得到含 `manifest.json`、`popup.html`、`account.mjs`、`icons` 的目录。
2. 打开 Edge 的 `edge://extensions`，开发者模式仅供验收人员使用，点击「加载解压缩的扩展」，选择含 `manifest.json` 的目录；**不要向普通求职者宣传此开发者操作，也不要将该 ZIP 上传 Microsoft Edge Add-ons 商店。**
3. 应显示“HHBA 智能网申助手（隔离预览测试）”，内测 Extension ID 必须与 `fjkcpgikachmfhajlghgekeicgbdagej` 完全一致。站点访问权限只能是 `https://hhba-edge-p0-lab.pages.dev/*`，并且默认仍需用户主动授权。
4. 测试弹窗、字段 UI、账户页、隐私政策链接、本地档案清除、异常网络提示和权限拒绝。**实验室页面仅有 API 与警告首页，不提供真实注册/登录 UI；没有单独准备的虚构测试账号和一次性连接码时，不能声称完整真实账户配对成功。**
5. 测试结束从 Edge 移除内测扩展并删除解压目录与本地测试档案。正式上架仍只走 Microsoft Edge Add-ons 经过审核的安装入口。

**安全注意：** 内部测试扩展使用固定的**公钥** `manifest.key`，并没有私钥或 Cloudflare API Key。此身份仅供独立实验室使用，不是正式上架身份。Cloudflare lab 仅用于合成账号/字段演示，严禁上传真实简历或填写真实个人信息。
