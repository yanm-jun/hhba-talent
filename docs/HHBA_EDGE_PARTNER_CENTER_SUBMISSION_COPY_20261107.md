# HHBA 智能网申助手｜Microsoft Edge Add-ons 提交字段终稿候选（待真实资料确认）

**版本：2026-11-07 / 开发验收稿，不是审核通过或正式上线。**

唯一发布目标：Microsoft Edge Add-ons；适用于 Windows/macOS 的 Microsoft Edge。**不要提交到 Chrome 网上应用店或 Safari。** 本稿仅供 Partner Center 提交前复制与法务核对，必须跟最终上架构建一致。

官方依据（请以提交当日最新 Partner Center 页面为准）：

- <https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension>
- <https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies>

## 名称

HHBA 智能网申助手

## 简短说明

在 Microsoft Edge 中识别常见招聘网申字段，使用本人核对的档案辅助预填、逐项确认并支持撤销；不自动提交申请。

## 商店长描述（简体中文，需 250–10,000 字符）

HHBA 智能网申助手面向使用 Microsoft Edge 的求职者，帮助减少在不同企业招聘申请页面重复录入基本信息的工作。用户先在扩展中建立、检查并保存自己的结构化求职档案，然后打开企业招聘申请表，主动点击扫描或预填。扩展仅分析当前用户操作页面中的普通、可见表单控件，依据字段标签提出姓名、联系电话、电子邮箱、毕业院校、专业、学历等填写建议，并对写入结果进行回读确认。

用户始终拥有最终控制权：可以先预览建议、决定是否勾选填写项目，也可以使用安全字段的一键预填；发现问题时，可以撤销由扩展写入且之后未被用户再次修改的字段。已有填写内容不会被扩展强制覆盖。验证码、密码、身份证明、身份调查、个人声明、隐私勾选、附件上传和最终提交，均由求职者本人处理，不会由扩展代为操作。对于复杂动态下拉、iframe、特殊网站控件或无法可靠识别的字段，扩展可能跳过并提示手动填写，不能保证兼容所有招聘网站，也不会保证获得面试或录用。

基本的本地档案和网页预填功能不要求连接 HHBA 账户，也不会因为扫描页面就自动购买网申次数或向服务器上传完整简历。用户可自行选择连接 HHBA 账号：在网站生成短期一次性连接码后，通过独立授权读取受限账户信息；当用户在网站核对已有简历并另行同意时，才可将确认过的结构化资料一次性领取到扩展的本地存储。原始 PDF/DOCX 私有简历文件不会被插件直接下载。若未来启用可选 AI 字段标签分析，只有用户逐次同意才会请求服务，并限制在非敏感字段标签及可用资料类型范围，模型建议仍需用户确认。

使用公共电脑时，请在扩展中主动清除本地档案，并在 HHBA 网站撤销已连接设备。完整的数据处理说明和功能限制，请查看 HHBA 网申助手专用隐私政策。当前正式上架前仍须完成 Windows/macOS Edge 实机测试及商店审核，**提交正式版时必须移除此段开发状态提醒，并只描述实际上线、可操作的功能**。

## Single Purpose（单一用途）

帮助求职者在其主动打开的招聘申请页面，基于本人核对的结构化档案，安全地识别、预览、填写和撤销普通表单字段；不代为提交招聘申请。

## Permission justification（逐项权限依据）

| Manifest 权限 | 供 Partner Center 直接填写的依据 |
|---|---|
| `activeTab` | 仅当用户主动点击插件功能时，临时访问当前招聘网页的表单结构，进行识别和用户确认过的填写。 |
| `scripting` | 用户点击扫描、预填、定位或撤销时，向当前标签页注入扩展包内的本地脚本；不自动运行于所有网页。 |
| `storage` | 保存用户主动填写的结构化档案及短期配对会话；由用户控制导入、修改、清除。 |
| `sidePanel` | 用户可主动选择在侧边栏查看当前页面的建议和填写状态；不后台打开或主动申请额外网站权限。 |
| 可选 `https://hhba.work/*` | 用户点击「授权并连接 HHBA」时才请求，限于 HHBA 自有 API 的一次性账户配对、受限账户查询及经单独同意的结构化资料领取。不请求全部网站的持续访问。 |

## Remote code（远程代码）

**No.** Manifest V3 扩展中的可执行 JavaScript 全部由安装包随附，不会从服务器或 CDN 远程下载并执行。用户主动发起的 HTTPS API 仅返回结构化数据与字段建议，不返回可执行脚本。

## Data usage / Privacy（必须与真实行为和隐私政策一致）

扩展本地保存用户自己输入的求职档案，处理用户主动打开页面的字段标签、控件类型与填空状态，不应上传已存在的网页填写值、密码或身份证明。用户选择连接账号时，扩展会传输一次性连接码和受限设备凭证至 HHBA 自有服务；用户另外同意后才可领取核对过的结构化资料。可选 AI 字段分析如果启用，需另行逐次确认，可能将**非敏感**字段标签及资料字段类型发送至服务端/第三方模型，因此不可错误勾选“从不处理任何个人数据”。保存、删除、跨境处理、联系方式和第三方处理说明必须以已确认的正式隐私政策为准。

隐私政策候选 URL：`https://hhba.work/apply-extension-privacy.html`。

**现阶段阻断：** 页面仍声明是内测版；个人信息保护联系人、资料存储/日志保留期限和跨境告知尚需正式核实。不能把这份草案当作已通过法务审核。

## 认证测试说明（英文草案；实际账号另行安全提供）

HHBA Intelligent Application Assistant has one purpose: user-initiated, local assistance with ordinary job application forms. The reviewer can open a standard form in Microsoft Edge, manually create a synthetic applicant profile, click Scan, review the suggested fields, explicitly fill selected fields, and use Undo. The extension never clicks Submit, uploads attachments, bypasses CAPTCHA, or fills identity, consent, password, or other sensitive inputs. Custom dynamic selectors may require manual entry. The basic local workflow does not require a HHBA account. Account pairing and optional AI are separate consent-based features; please see the attached instructions and privacy policy for availability. We will provide a dedicated non-personal test account separately if reviewer access to gated features is required. No real applicant data should be used for certification.

## 最终商店资产检查

- **必须：** 正式扩展 ZIP（Manifest V3）、本地所有必需脚本与 icon（16/32/48/128 PNG）；不可混入 `manifest.key`、测试包固定 ID 或密钥。
- **必须：** 商店语言说明（250–10,000 字符），正式 logo（1:1，推荐 300×300，至少 128×128），开发者身份/Support contact、可公开访问且准确的隐私政策。
- **截图可选，强烈建议真实拍摄：** 640×480 或 1280×800，最多 6 张，真实 Edge 中展示本地档案、预览方案、填写确认、撤销。不能把合成测试截图冒充任何真实招聘网站兼容证明。
- **可选营销图：** 440×280 小宣传图；1400×560 大宣传图。
- **上线阻断：** Edge Windows/macOS 实机、Partner Center 实际账号与身份、真实支持入口、正式隐私/资料保留与数据使用声明、最终审查说明以及尚未合并/部署的功能。测试版不应作为商店正式版上传。
- **审核通过并非保证：** 微软有独立认证流程，正式提交可能需要最多 7 个工作日（以官方最新页面和实际审核进度为准）。

## 安全交付说明

以上正文是审核前候选内容，**严禁**在不知道商店实际运行开关时宣称 AI 已上线、收费已开通或所有企业网站都支持。当前 PR 的具体变更尚未合并主线；待代码与用户确认后再精简/更新说明并在 Partner Center 填写。
