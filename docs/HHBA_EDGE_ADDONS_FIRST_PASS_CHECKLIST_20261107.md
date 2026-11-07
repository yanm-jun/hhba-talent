# HHBA 智能网申助手 · Microsoft Edge Add-ons 首次提交审核清单（2026-11-07）

> **状态：开发/审核准备资料，不等于已经提交或通过认证。** 唯一计划上架的平台是 Microsoft Edge Add-ons，面向 Windows / macOS 上的 Edge。不要发布到 Chrome 网上应用店或 Safari，不要把开发者 ZIP 称为「普通用户一键安装」。

## A. 官方要求与审核重点（必须逐项满足）

参考官方文档：
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies

1. 先使用真实的 Microsoft Partner Center 开发者账号建立 Edge 扩展商品；开发者身份由运营方独立验证。
2. 商店隐私页声明 **Single Purpose、Permission Justification、Remote Code、Data Usage、Privacy Policy**。不得忽略新的独立 Privacy 页面；全部声明需要与真实代码、Manifest 一致。
3. 清晰描述唯一用途：「在求职者亲自操作的招聘页面识别常见表单、协助预览与预填，并允许核对、撤销，不代替提交申请」。不要宣称全自动网投、多平台兼容、保证录用或用户无需核对。
4. 必要权限：`activeTab` 仅在用户主动打开或点击插件时短暂访问当前页；`scripting` 按点击注入**打包在扩展里的**内容脚本；`storage` 保存本地档案和会话凭证；`sidePanel` 让用户自行选择侧边栏；`https://hhba.work/*` 是**可选**站点权限，只有用户点击账号配对时申请。无 `<all_urls>`、无 Cookie 读取、无网页内远程执行代码。
5. 商店 ZIP 必须包含准确的 MV3 manifest、popup HTML/CSS/JS、同包 content/core/account、16/32/48/128 PNG 图标等必要资源；不要混入测试文件、私钥或开发者 README。各脚本从扩展本地加载，不使用 CDN、eval 或远程 JS。
6. 提供不低于 128×128 的官方方形图标，建议再准备 300×300 的正式商店展示图；PNG 现有 128 像素标识沿用 HHBA 项目 favicon 的 H 元素，运营方须再次确认品牌许可与视觉一致。
7. 提供真实、清晰的 Edge（Windows/macOS）功能截图及可复现演示；合成 ATS 风格页面可作为测试说明，但不能冒充已适配某个真实招聘平台。
8. 发布前最终确认独立的、可公开访问的 HHBA 扩展隐私政策页面和真实的联系/支持入口，补全个人信息处理主体、境外存储告知、数据保存/删除期限、访问更正删除方式及第三方 AI 说明。当前 `/apply-extension-privacy.html` 仍属于待法律审查草案。
9. 如有登录墙、账号授权或暂未开放的按钮，在 Partner Center 的**认证测试说明**中准确解释；若需审查账号，应提供专用虚构数据账号和可用的验证步骤，绝不能提交真实求职者简历、手机号或密码。
10. 正式提交前完成 Edge Windows/macOS 手工验收：权限提示、离线档案本地保存、标准 ATS 表单识别/预填/撤销、敏感字段跳过、动态表单回退、网络错误和卸载后删除；独立核查官网实际的 JSON / PDF / DOCX 授权同步是否开放。

## B. 可复用的商店信息草案（不得夸大）

**商店名称：** HHBA 智能网申助手

**单一用途说明：** 在用户主动操作的企业招聘页面，识别常见求职信息输入项，利用用户自行提供并核对过的本地档案建议填写，允许预览、手动确认与撤销。最终提交、附件上传、验证码及法律/隐私声明始终由用户亲自处理。

**推荐分类：** Productivity（生产力工具；以 Partner Center 实际分类为准）

**建议长描述草案：**
HHBA 智能网申助手是一款面向 Microsoft Edge 的求职表单辅助填写扩展。用户可以在插件内建立自己的求职档案，或在 HHBA 网站核对已有简历后，在单独授权的情况下把结构化资料导入插件。打开企业招聘申请页面后，用户主动点击扫描、查看建议，再自行选择需要填写的普通字段。插件支持撤销本次由插件写入且尚未被用户再次修改的字段。对于无法识别的表单、敏感项目、验证码、附件、本人声明或最终提交，插件会保留人工处理，不会未经确认就自动提交申请。插件本地预填无需联网、无需扣费，是否启用 HHBA 账号连接及可选 AI 字段标签分析依实际服务开关为准；未启用时不会静默发送资料。对于某些动态或特殊招聘系统，插件可能无法完整识别，用户需要亲自检查页面。详情请阅读 HHBA 网申插件专用隐私政策。

**权限说明（提交时逐项对应 Manifest）：**
- `activeTab`：仅在用户使用扩展时访问当前标签页的表单结构与状态。
- `scripting`：按点击注入本地打包的表单识别与填写脚本，不自动在所有页面运行。
- `storage`：保存本人自行填写的本地求职档案、短期配对凭证；共享电脑须主动清除。
- `sidePanel`：让用户主动打开侧边栏以查看填写建议。
- 可选 `https://hhba.work/*`：用户明确同意账号连接时访问 HHBA 自有的受限 API，独立临时令牌只可查询账户/领取经网站确认的资料；不读取网站 Cookie。

**远程代码声明：** 无远程可执行代码。扩展使用打包本地脚本，远程 HTTP 请求仅用于用户主动配对、只读次数或经额外同意的服务器字段标签建议；不远程下载执行脚本。

**商店图标：** 当前 `apps/browser-extension/icons/icon128.png`。**截图与支持邮箱/页面：** 待真实资料补齐，不得虚构截图或联系人。

## C. 自动检查与未完成事项

自动门禁：`node apps/browser-extension/scripts/edge-package-audit.mjs`，再运行插件协议、真实 Chromium PDF.js/合成表单回归，并在 GitHub Actions 取得审核用 ZIP Artifact。CI 只证明技术契约，**不等于** Microsoft Edge 上架审核通过。

**本轮后仍须手工完成的 P0 阻断项：**
- Partner Center 实际开发者账号与正式展示图/截图、支持渠道、隐私法务审查。
- 审查并配置专属 Edge Extension ID 及 Cloudflare Preview 的配对开关、pepper 与 AES-256-GCM Secret；不向源代码或用户端暴露秘密。
- 使用隔离测试账户在真实 Edge Windows/macOS 测试**完整的一次性资料同步链**；生产配置、收费和合并 main 均在验收后单独审批。
- 过期密文后台定时删除代码已实现于 `apps/web/workers/apply-profile-transfer-janitor.js`；**独立测试实验室**已配置 Preview D1 清理 Worker 和 15 分钟 Cron，但正式 hhba.work 仍未启用该计划，实际定时运行与承诺的物理留存上限还需单独核验。

**必须区分：** Chromium 扩展平台会在 Edge 使用 `chrome.*` API 和 `chrome-extension://<id>`，这不表示上传 Chrome Web Store。

审核时采用官方条款的最新版本，以 Microsoft Partner Center 当次页面必填项和真实功能为准。

## D. Cloudflare Preview 真实 Edge 联调的安全准备

已提供内部脚本 `apps/browser-extension/scripts/stage-preview.mjs`。它只允许 `https://<branch-or-id>.hhba-talent.pages.dev/` 地址，复制正式扩展的**全部必要静态文件**到隔离目录，再将自有 API、隐私政策、账户与简历入口全部替换为 Preview 域名；不会改动官网发布包，不会插入 API Key，也不支持其他第三方站点。独立测试产物显著标注「隔离预览测试」，**严禁上传到 Microsoft Partner Center**。

内部测试操作示例（仅开发者）：
```sh
node apps/browser-extension/scripts/stage-preview.mjs https://<真实Cloudflare-Preview>.hhba-talent.pages.dev /tmp/hhba-edge-preview
```
在 Microsoft Edge 的 `edge://extensions` 中将输出目录作为独立内测扩展加载，记下 Edge 为**该内测扩展**分配的 32 字符 ID。开发者需要先安全确认 Cloudflare Preview D1/R2 与生产隔离（已有只读核验），再把这个 Preview ID 与独立随机配对 pepper、独立 AES-256 密钥通过 Preview Secret 安全设置。整个过程不应修改生产环境，也不应为方便测试放松 origin 白名单。

使用虚构候选人账号、测试 PDF/DOCX 与经过授权的测试资料，再执行：官网真实会话登录 → 创建五分钟连接码 → 内测 Edge 兑换一次性会话 → 网站提取文字并人工核对 → 用户同意结构化同步 → Edge 二次勾选同意领取 → 读取一次成功 → 二次领取/跨账号/撤销/过期均失败。记录真实网络行为与截屏（避免泄露 token/个人信息）。未完成全部链路不得报告「真实账号端到端验收通过」。

**截至本次提交：未配置 Preview 配对或加密 Secret，未得到稳定扩展 ID；仅有真实 onRequest 合成账户 HTTP 协议验收，尚未完成真实浏览器与 Preview 服务端凭证联调。** 不把此步骤中的开发者加载流程展示给普通求职者。

## E. 定时物理清理（代码完成，部署需单独验收）

独立 Worker `apps/web/workers/apply-profile-transfer-janitor.js` 使用 Cloudflare Worker 的 `scheduled` 事件，每次运行仅对配置在其 `HHBA_PNVS_AUTH_DB` 绑定的 D1 删除 `expires_at<=当前时间 OR claimed_at IS NOT NULL` 的行，不读取原始简历或解密密文。

上线前：
1. 单独创建 Preview 清理 Worker，核验其 D1 绑定严格指向 **Preview PNVS**，不得误指向生产 D1。
2. 将 `HHBA_APPLY_CLEANUP_ENABLED=1` 仅写入该 Worker 的受控环境，配置必要的周期性 Cron Trigger（例如每 15 分钟）。
3. 用隔离合成数据验收「未过期行保留、过期行删除、已经领取行删除」，确认不清理任意其他表、不会写入个人字段日志。
4. 根据实际调度间隔、时钟偏差、失败重试和用户权利请求，准确修订隐私政策及物理删除时间。不能只凭代码存在就声称服务已按时删除。
5. **本分支对正式 HHBA 站点不部署 Worker、不创建生产定时任务、不修改生产 D1；测试实验室的独立 Worker/Cron 已作为隔离验收环境创建。**

## F. 新增投递记录识别（PR #281）

仅在用户明确授权后，对当前 Edge 招聘申请页面进行有限时间的提交跟踪。页面提示成功、待确认、人工补充是不同证据状态；不抓取表单答案，也不保证企业收到。投递记录先存扩展本地，由用户主动确认当前 HHBA 账号后同步；通过网站个人中心可查询、手动补充或删除。无记录仅显示“未记录投递”。首次商店审核应重新核对此行为的 Single Purpose、Data Usage、Privacy Policy，并增加真实 Edge 截图与用户权限验证；不能继续宣称扩展账号只支持只读钱包。对应独立 D1 迁移是 0015，正式部署前先按生产审批单独执行。
