# HHBA Edge P0 — 独立真实网络联调环境（2026-11-07）

## 为什么建立单独的实验项目

原始 `hhba-talent` Cloudflare Pages 在 Preview 中包含约 31 项环境变量和数个隐藏的 `secret_text`。现有 Cloudflare API 不返回这些 Secret 的实际值，整组读回并 PATCH 的更新方式可能误删短信、AI、后台等其他服务密钥。为了不影响 hhba.work、主项目预览和现有数据，建立**单独 Pages 项目** `hhba-edge-p0-lab`。

- 项目域名：`https://hhba-edge-p0-lab.pages.dev`（仅用于联调；**非正式 HHBA 网站**）。
- 这个独立项目使用开发分支 `feature/apply-edge-isolated-live-lab-20261107` 作为**自身**发布分支；**没有**将 `yanm-jun/hhba-talent` 的 `main` 改为别的分支，也没有修改 hhba.work。
- 静态构建沿用已有 `cloudflare-pages-build.py`，额外运行 `edge-lab-noindex.py`，在页面明确标示「内部联调环境，请勿提交真实简历」，输出 `robots.txt` 和 `X-Robots-Tag: noindex`。
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
