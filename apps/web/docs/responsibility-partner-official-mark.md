# HHBA 外部责任投资合作机构官方标识

## 目标与事实边界
该页面位于 `/transparency`，用于展示 HHBA 经营方自行披露的 ESG／劳工权益主题责任投资合作与资金信息。**ESG 不是可统一授权的机构 Logo**。不得把 PRI、联合国、任何公募基金或 ESG 评级机构的标识当作本项目的合作机构，除非其确实是合作方且获得标识展示授权。

此前未公开具体合作机构名称、官方站点或对应授权标识，所以系统默认**不显示任何第三方官方 Logo**。代码不会根据「60 万元」或「ESG」自行推测合作机构，也不要求用户提供不可公开的合同或转账文件。

## 只用 Cloudflare Pages 公开配置，无需传输私密协议

Pages 项目：`hhba-talent`；环境：`Production`。在 Cloudflare Dashboard > Workers & Pages > hhba-talent > Settings > Variables and Secrets，配置：

| 环境变量 | 作用 | 示例格式 |
|---|---|---|
| `VITE_HHBA_PARTNER_OFFICIAL_NAME` | **已获准公开**的实际资金支持机构名称 | 机构的真实注册或品牌名称 |
| `VITE_HHBA_PARTNER_OFFICIAL_WEBSITE` | 实际机构 HTTPS 官网 | `https://fund.example.org/`（占位示例，不能照抄） |
| `VITE_HHBA_PARTNER_OFFICIAL_LOGO_URL` | 真正官方提供或由对方允许使用的 Logo HTTPS 直链 | `https://fund.example.org/assets/logo.svg`（占位示例） |
| `VITE_HHBA_PARTNER_LOGO_AUTHORIZED` | **已核对合作方标识公开使用许可**后才设为 `1` | 未核对时留空 |

四项条件必须同时满足，页面才显示实际官方 Logo、机构名称与官网跳转。Logo 图片必须是 HTTPS 的 SVG/PNG/WebP/JPEG，源站属于该机构官网及其子域，或托管在 HHBA 官方网站 `hhba.work`；不允许任意第三方跟踪域名、恶意 scheme 或虚构机构图标。

`VITE_` 前缀配置是**公开构建变量**：它们会出现在公开网站资源中，不应填写合同、凭据、API 密钥、管理密码、未公开自然人信息等。修改后需重新触发 Production 构建，且仅在新的构建完成后生效。

## 默认公开文案

在没有合法公开的名称和授权标志前，保留“合作机构官方标识暂未公开”的诚实状态，ESG/LABOR RIGHTS 只是领域标签而非机构 Logo。60 万元为 HHBA 经营方**自述披露**，页面清晰说明未经独立第三方鉴证；不会将外部资金支持混入营业收入或 60/40 利润分配。

## 验收

1. 无配置：不得显示任何外部机构 Logo 或随机基金名称。
2. 只有机构名、或只有 Logo、或无 `AUTHORIZED=1`：必须仍隐藏。
3. Logo 地址非 HTTPS、与实际官方域不匹配，或含非图片扩展名：必须隐藏。
4. 四项完整且确已获得公开授权：展示正确名称、真实 Logo 与官网，页面继续显示自述与未独立鉴证的说明。
5. 验收生产站时同时检查横版、手机版和图片加载失败状态。

> **提醒：机构间真实合作关系不必然等于该机构准许在商业网站展示其 Logo。** 只有允许展示的资料应进入公开配置。
