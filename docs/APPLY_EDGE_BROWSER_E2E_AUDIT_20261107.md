# HHBA Edge 插件 P0：真实 Chromium 弹窗联调记录（2026-11-07）

## 测试结论

本批次基于 PR #276 分支开 PR #277，在 Playwright 推荐的 Chromium `launch_persistent_context(..., channel='chromium')` 下实际加载 Manifest V3 扩展，而非仅运行 JavaScript 单元测试。

**已通过的流程：** 内测测试包按随机公钥建立稳定 ID → 进入插件账户页 → 单击连接按钮 → 验证站点权限存在 → 12 位测试连接码换取短期设备凭证 → 只读账户余额 → 未确认资料授权时拒绝领取 → 明确同意后一次性领取结构化资料并保存在浏览器扩展本地存储 → 重复领取拒绝 → 断开连接后会话消失。

所有人名、院校、手机号、Token 都是 CI 生成的**虚构样例**。使用内存拦截合成的 HHBA Preview API 响应，不向正式站或第三方 AI 请求真实简历。不改变手机号认证、支付宝或 AI 的正式数据。

## 实际发现并修复的问题

首次真实浏览器测试发现，`chrome.permissions.request()` 需要浏览器级弹窗，而无头 Chromium 无法接收人工点击。仅针对 CI 合成测试环境，内部专用构建将虚构 Preview 主机设为预授权权限；默认内测构建与最终 Microsoft Edge 商店包的 `optional_host_permissions` **未改变**，用户仍需主动同意。

随后真实浏览器捕获到：浏览器的跨域 GET `/api/apply/extension/wallet` 请求可能省略 `Origin`，原服务端出于安全原因拒绝，导致已经连接的账户显示查询失败。

修复方式：将该接口改为 **POST**，确保 Chromium 扩展主动请求携带扩展来源；保留原有严格 `chrome-extension://<精确32位ID>` 校验、`hhbaext_` 临时 Bearer、只读数据库查询和无缓存规则。不允许 GET 绕过来源限制，也不允许扩展使用网站登录 token 代替独立凭证。已同步更新客户端、服务端和完整业务路由回归。

## 自动化证据

- PR #277：`https://github.com/yanm-jun/hhba-talent/pull/277`
- 真实 Chromium 浏览器 + 模拟接口/CI 权限准备：`apps/browser-extension/scripts/edge-browser-preview-e2e.py`
- 完整账户签发、一次性连接码、资料授权/领取/撤销路由测试：`apps/web/scripts/apply-pairing-real-flow.contract.test.mjs`
- 正式 Edge 安装包独立审计（拒绝附带 `manifest.key` 或越权权限）：`apps/browser-extension/scripts/edge-package-audit.mjs`
- 预览构建/制作工具：`apps/browser-extension/scripts/stage-preview.mjs`
- GitHub CI：`.github/workflows/hhba-apply-credits-product.yml`

## 上线前仍然缺少的现场条件

1. Cloudflare Pages 需确认 **本 PR 最新提交**的独立 Preview 构建部署成功。
2. 要做真实远端 Preview 账号联调，需用专属**内测** Edge 扩展 ID、独立安全的配对密钥及 AES-256-GCM 密钥配置 Preview。该项目目前拥有 31 项 Preview 环境变量，其中若干 `secret_text` 在 API 返回中仅为空串占位符，**不可将 API 返回值整组写回，否则有抹除现有秘密的风险**。本 PR 没有修改 Pages Preview/Production 的 env_vars。
3. 通过真实浏览器和隔离测试账号联网验证 `/extension/claim`、`/extension/wallet`、`/extension/profile/claim`、`/extension/disconnect` 与网站主动授权；留存完整、不含个人信息的验收记录。
4. Windows + macOS 上的 Microsoft Edge **实机**体验仍需验收。Playwright Chromium 是底层引擎兼容性测试，不能冒充真实 Edge 商店安装及审核。
5. 微软商店开发者实名认证、商店正式图片、支持渠道与隐私政策完善、密文 Cron 调度真实启用仍是上架条件。

**上线纪律：** #272→#273→#274→#275→#276→#277 依序验收、合并。未获验收不更新 `main` 或 `hhba.work`，不启用真实支付宝扣款或第三方 AI。
