# HHBA OpenAI 智能核心：接入、隔离和上线验收（2026-11-24）

## 状态

此改造在独立 GitHub 开发分支和草稿 PR 内；**尚未完成真实 API 授权的端到端招聘验收，不能宣称生产 OpenAI 匹配已可用**。不改变既有前端简历入口、登录、D1 用户数据、R2 文件、求职历史、Word 编辑 UI。现有 Clean V2 是分阶段工作流，AI 可规划/补充搜索并对照证据；**不宣称已经搭建了可无限自主行动的通用 Agent**。下一阶段的可控工具决策循环必须在独立实测后建设。

## 配置：最小变更

Cloudflare Pages 有 Secret 绑定名称 `HHBA_MATCH_OPENAI_API_KEY`；仅根据绑定名称可判断“配置项存在”，不能推断真实 Key、模型权限、额度和可用性。不得从客户端或日志泄露 Secret。

- `HHBA_MATCH_AI_PROVIDER=openai`：显式启用 OpenAI 作为 Clean V2 匹配引擎；缺省时若配置 OpenAI key 优先 OpenAI，没有时用旧 DeepSeek。设置 `deepseek` 可回退。
- `HHBA_MATCH_OPENAI_MODEL=gpt-6.2-sol`：可覆盖 OpenAI 模型 ID；必须以实际项目权限和官方可用模型为准，默认同此值。
- `HHBA_MATCH_SERVICE_ENABLED=1` 且 `HHBA_MATCH_CLEAN_V2_ENABLED=1`：同时满足且 DB 可用才解锁正式 `POST /api/match-next/resume`。**在真实端到端验收前保持 `HHBA_MATCH_CLEAN_V2_ENABLED` 关闭。**
- `HHBA_PREVIEW_AI_DIAG_ENABLED=1`：仅独立 `*.hhba-talent.pages.dev` 预览域且符合已有登录/QA Token 约束时开放真实诊断；**正式域名禁止此开关**。
- Word 简历写作是另一条业务链路：**默认保留现有 DeepSeek**；在整份 Word 事实检查和版本保存的真实测试通过后才给预览环境设置 `HHBA_AI_DEFAULT_PROVIDER=openai` 或对应 `HHBA_AI_<TASK>_PROVIDER=openai`，然后逐步推广。沿用匹配 OpenAI Key，不要求重复保存。
- 原始 PDF/DOCX 二进制 OCR 仍用 DeepSeek OCR 服务，**不会错误地将 OpenAI Key 传给不同厂商的 OCR URL**。这不代表“完全没有 DeepSeek 依赖”，OCR 迁移需要独立解决。

## 已接入的技术链路

1. `openai-match-adapter.js`：统一 `/v1/responses` JSON 输出和模型配置；使用 `store:false`，模型凭证仅用于服务端。
2. OpenAI `web_search` 真实工具调用：仅以 `web_search_call.action.sources` 或带来源的 `url_citation` 作为候选 URL；**不能把模型生成的链接列表当成已核验官方链接**。
3. 对候选官网职位详情发独立 HTTPS GET（不跟随跳转、阻止常见局域网/测试域名、限制响应字节和内容类型），读取正文。
4. 沿用 `clean-match-v2.js` 的中国大陆工作地点、职位详情 URL、企业名称/岗位名/职责原文与任职要求逐字核验；证据不足不提供虚构的打分。招聘状态、投递资格仍以官网为准。
5. `resume-jd-match-agent.js` 负责简历真实事实提取、完整 JD 简历对照，保留证据 ID；`clean-match-v2-jd-bridge.js` 继续归档独立校验的 JD。
6. Word 编辑的 `resume-ai-provider.js` 与 `resume-rewrite-provider.js` 支持新的 Responses API，但默认供应商不自动切换；保持用户确认和原格式验证链路。

## 验收分层

- **代码/合约（自动）**：服务端选型、Secret 不泄露、`store:false`、Search 来源可信、非法 URL/HTTP 重定向拒绝、真实页面文本解析、简历证据 ID、初步评分、未启用时路由拒绝、既有 DeepSeek 兼容；Node 语法/Cloudflare 路由/Vite build；模拟响应 **不能证明** 真实权限和真实岗位。
- **隔离真实供应商（运营人员执行）**：使用只包含虚构公开简历的独立预览端，检查 OpenAI Responses JSON、Web Search 权限、来源候选量、官网返回 HTML/动态页面读取能力、真实有效 JD 及抽取/评分。验证需自带精确数字与错误阶段，不制造 10 条岗位成果。
- **用户前完整回归**：不同城市/行业的合成简历，原文字段、JD、Word 优化前后修订和多个岗位独立 Word 版本、匹配历史、移动端/电脑端、匿名请求/越权访问、性能超时/429/5xx/断流和重试幂等。
- **上线放行**：所有关键真实环节验证通过、监控可用、回退可执行且本人同意放行后，才启用生产服务。否则保持 PR 草稿和正式匹配开关关闭。

## 技术约束与下一阶段

- 第三方招聘动态脚本、反爬和过期岗位不能靠 API Key 自动解决；需专门授权网站读取策略、失败诊断和来源核验。
- 固定 36 次页面尝试等属于目前 Clean V2 的单次执行保护，不等于 AI 无法自主规划新的搜索范围。下一阶段可在 Cloudflare Worker 时限、任务队列和可观察费用基础上改为可恢复的工具决策循环。
- 即使已配置 OpenAI Key，也必须验证账号实际可调用的模型、`web_search` 和项目账单。任何权限问题应返回相应错误，不应假装“0 个匹配岗位”。
- 禁止把简历正文、API 凭据、个人身份、完整模型输出写入公开日志；仅记录阶段、计数、错误码。
