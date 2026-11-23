# HHBA Clean Match V2 — GPT Responses 兼容后端（含中转站）（2026-11-23）

## 本次范围
重做现有 `/api/match-next`，不创建 V3，不重写 HHBA 的用户账号、简历库、历史记录、Word 编辑器、财务系统或 D1/R2。
V2 不调用 DeepSeek，默认走 OpenAI 官方 API；可明确选择用户授权的 reqtoken HTTPS 中转站。不会将旧 DeepSeek 作为失败时的兜底。曾经公开过的密钥须撤销/轮换，密钥只通过 Cloudflare Secret 私下配置。

## 架构

1. 已登录候选人上传 PDF/DOCX：客户端优先本地解析；实在无法解析时，需明确授权经服务端把原始文件发送至已配置的 Responses 兼容服务（可能是第三方中转站）的 `input_file`。`/api/match-next/ocr` 要求 `X-HHBA-OCR-Consent: openai-resume-ocr-v2`，仅响应脱敏文本。
2. 已脱敏简历通过隔离 `resume-jd-match-openai-v2.js` 获取可逐字回查的事实 ID，不能虚构学历、技能、年限、经历或资质。
3. 模型规划岗位方向与城市；模型使用已配置服务提供的 `web_search`；只从服务端响应的 `web_search_call.action.sources` 或正式 `url_citation` 中提取网址，模型自行写出的链接不算来源。**私有简历内容不交给公共 web_search**。
4. 拒绝第三方招聘站、境外/非大陆岗位、非单个职位页；对候选企业岗位 URL 用有限超时、有限内容长度的 HTTPS GET 读取。不携带 AI 服务 API Key 请求企业网站，不跟随重定向。
5. 逐条提取岗位名称、企业身份、明确的工作城市、JD 职责/要求原文；没有支持证据则不制造有效岗位或随机评分。
6. 匹配评分必须能对上本次简历事实 ID 和真实 JD 原文。独立 JD 归档核验仍是解锁可信 Word 优化的前提。缺少证据返回 `null`，不可冒充录用概率。
7. 返回阶段进度、Search 来源数量、被拒绝链接计数、网页读取数和失败阶段；虚构简历运行不保存真实个人匹配历史。

## 服务端配置

在 Cloudflare Pages **Preview** 环境设置：
- `HHBA_MATCH_OPENAI_API_KEY`：**Secret**，可为 OpenAI 官方 Key，或授权的 reqtoken 中转站 Token。绝不存放在浏览器、GitHub、文档或聊天里；聊天里公开过的密钥须轮换。
- `HHBA_MATCH_V2_RUNTIME`：**纯文本 JSON，不包含密钥**。Cloudflare Pages 免费方案只有 64 个变量/Secret 名额，原来四个非敏感配置已合并：`{"baseUrl":"https://api-c.reqtoken.com/v1","model":"gpt-6.2-sol","matchEnabled":true,"wordEnabled":true}`。生产环境不会因为这个预览配置而开启 V2。
- `HHBA_MATCH_OPENAI_BASE_URL`、`HHBA_MATCH_OPENAI_MODEL`、`HHBA_MATCH_CLEAN_V2_ENABLED`、`HHBA_MATCH_OPENAI_WORD_V2_ENABLED`：单独配置的旧字段仍可向后兼容，但预览环境已将它们清理，由紧凑字段替代。
- 仅两个固定 HTTPS 地址可接收 Token：`https://api.openai.com/v1`、`https://api-c.reqtoken.com/v1`，其他源返回 `AI_PROVIDER_ENDPOINT_NOT_APPROVED`。模型权限、Responses 和 web_search 必须真机验证。
- `HHBA_MATCH_SERVICE_ENABLED=1` 和授权登录的 D1 绑定。
- `HHBA_PREVIEW_AI_DIAG_ENABLED=1`：仅用于 Cloudflare **preview hostname** 的明确授权诊断。
- 生产不设置 `HHBA_MATCH_CLEAN_V2_ENABLED=1`，且紧凑配置的 preview 标志绝不能自动打开正式站：验收前在**生产**保持关闭。**不要将预览诊断设置复制到正式站。**

### Word 简历优化迁移（预览隔离）
- 可在独立预览环境使用紧凑配置中的 `wordEnabled:true`（或旧变量 `HHBA_MATCH_OPENAI_WORD_V2_ENABLED=1`）。**仅当** `HHBA_AUTH_ROLLOUT=preview` 且 `HHBA_PREVIEW_AI_DIAG_ENABLED=1` 时，Word 的 `resume_optimization`、`resume_rewrite` 和 `resume_reviewer` 才会被强制改走指定 GPT Responses 兼容接口。
- Word 使用 V2 的 `HHBA_MATCH_OPENAI_API_KEY`、`HHBA_MATCH_OPENAI_BASE_URL` 和 `HHBA_MATCH_OPENAI_MODEL`；没有有效的对应服务 Token 则报告未配置，**不静默回退 DeepSeek**。
- `generateSuggestions` 和 `completeJson` 对 OpenAI 使用 Responses API，覆盖定向建议、整篇撰写、独立事实审核和 Agent 续写。原本非 OpenAI 的 provider 行为不变。
- Word 改写仍要求已经可信核验的 JD 身份、签名续写 checkpoint、求职者登录、明确授权；所有建议还需要用户确认，不应直接修改原始简历。
- 这并**不会**把整个网站的所有遗留 AI 服务切成 OpenAI，也不会让预览环境自动开放生产功能；原有 Word 独立发布和合规开关仍需配置。
- 回归测试：`apps/web/scripts/clean-match-v2-openai-word.contract.test.mjs`；必须继续运行既有 Word / JD archive / 页面回归测试。

V2 使用 `{HHBA_MATCH_OPENAI_BASE_URL}/responses`。只有官方 OpenAI 与用户指定中转站获准传输 API Key。中转站实际转发的模型身份、支持的工具和数据保留条款由中转站决定；`store:false` 只是一项请求参数，不等于中转站已经承诺不保存个人数据。V2 部署不要求/读取 `HHBA_MATCH_DEEPSEEK_KEY`。原本停用的旧匹配后端文件未被删除，以免影响不相关遗留服务。

## 验收状态与边界

- 当前独立 PR / 分支仅表示代码提交；GitHub CI 模拟数据测试，不等同于中转站或官方 OpenAI 的真实付费调用成功，也不等同于实际找到 10 条可投递岗位。
- `/api/match-next/provider-check` 只验证所选服务的 Responses JSON 与联网搜索的公开来源；`fetch_content_verified=false` 是诚实表示该检查**没有**读取企业 JD。
- `/api/match-next/synthetic-check`：预览域、候选登录、自愿授权、固定虚构简历；只有真实网页成功读取并得到证据时才算岗位候选。
- 正式发布前要求：至少 3 类真实非个人简历画像、10 个可打开的**具体单岗官方 URL**目标、完整 JD 核验、速度和错误日志验收，且优化简历对应的**共享 Word 优化后端模型**需要单独完成 OpenAI-only 迁移与回归，不允许误称整站已经彻底替换 DeepSeek。
- 没有确认模型可用、搜索来源和完整 JD 时，不将 V2 生产开关置 1。面向真实用户发送原始文档或脱敏简历前，必须清楚披露第三方处理方及数据政策，取得本人授权。

## 代码入口与隔离
- `apps/web/functions/api/match-next/[[path]].js`
- `apps/web/functions/_lib/openai-match-v2-provider.js`
- `apps/web/functions/_lib/resume-jd-match-openai-v2.js`
- `apps/web/functions/_lib/resume-ocr-openai-v2.js`
- `apps/web/functions/_lib/clean-match-v2.js`
- `apps/web/scripts/clean-match-v2-openai.contract.test.mjs`

新模块独立，禁止从 V2 路由调用旧 DeepSeek 识别/搜索工具。`HHBA_MATCH_CLEAN_V2_ENABLED` 保持生产关闭是发布门槛，不是待修功能。

## Cloudflare Pages 免费变量数量修复
2026-11-23 新版 Preview 构建曾因 66 个 worker binding 超出免费计划 64 限制，在 Function 发布步骤失败。已将预览四个明文项合并为一个 `HHBA_MATCH_V2_RUNTIME`，预览绑定项从 64 减至 61，不触碰其他业务环境变量，给 Preview 的独立 Secret 留出名额。当前发现用户误将 `HHBA_MATCH_OPENAI_API_KEY` 加入 Production，必须由用户在 Cloudflare 控制台的 **Preview** 分组重新输入密钥；加密 Secret 不能从 Production 读取或复制。正式部署未放行。
