# HHBA 网申助手 — P0 官方安装与安全上手交付（2026-11-07）

## 版本状态与边界
- 本次分支从 main 建立，不包含尚待验收的 V0.6 AI 联调 PR #271。
- main 的 V0.5 离线填表、手动导入 JSON、一次性配对、钱包只读能力保持不变；插件账号连接不读取网站密码/Cookie/登录 Token。
- 新增普通用户入口：只有配置**真实官方商店详情页 URL** 时才渲染「前往 Chrome/Edge 官方商店安装」；未配置则明确显示「商店尚未发布」。
- 网站与插件均有现成的账号、简历库入口。网站支持经独立授权上传 PDF/DOCX 到 R2；插件目前**不会自动同步或解析**这些文件，插件内填表仍需要核实过的结构化档案。
- 网站公开展示静态隐私说明：`/apply-extension-privacy.html`。上线前须由实际运营方完成法务审核、跨境存储告知、留存周期和联系渠道完善。
- 本次不涉及真实支付配置、真实 AI 运行、次数扣减、网页自动提交或生产部署。

## 上架前的人工前置工作
1. 在 Chrome Web Store Developer Dashboard 注册扩展开发者账户；在 Microsoft Partner Center 注册 Edge 开发者账户。身份、费用和商店审核无法由代码自动代办。
2. 依据真实插件代码提交打包的 ZIP、商店图标/宣传图/截图、产品说明、支持联系渠道、数据用途、权限依据及隐私政策地址。
3. 校验 `manifest.json`：仅使用 `activeTab`、`scripting`、`storage`、`sidePanel` 和按点击授权的 `https://hhba.work/*`；解释各权限用途。若商店因 Side Panel 或其他兼容性提出要求，先在独立分支解决。
4. 审核扩展的真实演示与政策：当前不自动投递、不提供浏览器自动上传简历。DeepSeek 仅是待启用的可选字段映射服务，需要逐次同意。
5. 提交并等待商店审核；审核完成后取得公开的详情页链接与**稳定扩展 ID**。Chrome/Edge 两边的 ID 可能不同；当前服务端限制由 `HHBA_APPLY_EXTENSION_ID` 等配置控制，需对每个已批准 ID 分别核验身份白名单策略，不得把任何扩展来源全部放开。
6. 只在审核及安全验收通过后，于 Cloudflare Pages build-time 环境变量设置：
   - `VITE_HHBA_CHROME_WEB_STORE_URL`：`https://chromewebstore.google.com/detail/<name>/<32-letter-id>`
   - `VITE_HHBA_EDGE_ADDONS_URL`：`https://microsoftedge.microsoft.com/addons/detail/<name>/<32-letter-id>`
   重新构建部署后，网站才会出现对应的安装按钮。仅允许实际商店域名，不能替换成 ZIP 或第三方下载。
7. 审核后的代码改动与商店发布版本保持一致，安装后需现场验证首次授权、登录配对、撤销、刷新、离线预填、敏感字段跳过和跨域权限错误处理。

## 后续 P0 工作（尚未完成）
- **简历同步与解析**：通过真实账号、明确用途授权来选择已有私有 PDF/DOCX。需有可靠的文本解析、字段核对、来源记录和受限的传输机制。现有 R2 文件不会被隐式读出给插件。不能把「可在网站上传」称为「插件已自动同步」。
- 根据最终的隐私方案决定是否允许在浏览器内离线解析，再建立最小权限的跨端同步；同步必须有单独、未预勾选的授权，不能复用支付/AI 同意。
- P1 AI 自动填表要先以脱敏真实招聘页面兼容性验收；付费扣次要独立于本地预填，并以服务端幂等完成证据为准。

## 官方文档
- Chrome Web Store: https://developer.chrome.com/docs/webstore
- Chrome 权限/隐私申报: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Edge 发布流程: https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension

## 2026-11-07 CI 验收与独立预览
- PR #272 最新一轮 CI：`verify-commerce-foundations`、`verify-browser-extension` 均通过（含 TypeScript/Vite 构建、ZIP 完整性、Chromium 合成表单检查）。
- 已在 Cloudflare Pages 的 custom Preview 白名单中**仅追加**本开发分支，原有 35 条允许分支全部保留，`main` 仍为生产部署分支。此变更仅允许该开发分支触发预览，不代表生产发布。
- 以下推送用于触发本分支的 Preview 构建；预览成功与在线访问仍需按 Cloudflare 部署记录核验。
