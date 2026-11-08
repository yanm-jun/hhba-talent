# HHBA V8 — DeepSeek 主导的动态岗位发现（预览 P0）

日期：2026-11-08。基线 V7：`fcb9f041`，V7 PR #298 仍为 Draft；V8 从 V7 分支派生，独立 Draft PR，未合并 main。

## 用户问题与产品目标

不再以“逐家企业开发、逐家人工录入招聘职位”作为主要扩张路线。DeepSeek V4 Pro 自主选择同职业搜索查询、调用公网 Search、按需要阅读独立招聘详情；HHBA 服务端控制安全范围、每次费用上限和可核验证据。

目标范围：**实际工作地点在中国大陆的岗位**。外资公司在中国大陆的真实岗位可以纳入；仅境外工作岗位排除。对外按中文输出，未确认开放状态均标记 `NEEDS_OFFICIAL_CONFIRMATION`。

## 官方文档核验

- DeepSeek Responses API：`POST https://api.deepseek.com/responses`，`deepseek-v4-pro` 支持函数工具调用及内置 `web_search`。
  https://api-docs.deepseek.com/guides/responses_api/
- 官方 Search 与 Fetch：`POST /v1/tools/search` 和 `POST /v1/tools/fetch`。
  https://api-docs.deepseek.com/zh-cn/guides/search/
- **重要**：Responses API 当前忽略 `max_tool_calls`，因此此版没有给模型启用无硬成本界限的内置 web_search，而是把 Search/Fetch 暴露为 **服务端执行的函数工具**，对每次调用的数量、链接和去向执行硬限制。

## 真实实现

代码：`apps/web/functions/_lib/deepseek-official-job-agent.js`，后端 `apps/web/functions/api/match/[[path]].js` 接入。

只允许模型看到**规范化职业方向**，不向联网检索发简历正文、姓名、手机号、邮箱或个人履历。V8 仍沿用 V7 的用户登录、简历 AI 处理授权、D1 每用户每天额度、按日全站限额。

- `search_jobs`：模型自主生成查找同职业岗位的查询，程序检查 PII/违法指令/境外地点及职业关联；搜索次数最多 4 次。
- `read_job`：只读取实际搜索结果里出现过的 **HTTPS 单职位详情链接**；原六家官方招聘站，以及通用 Ashby / Greenhouse / Lever 单职位 URL。网页正文需要岗位、城市、职责、任职要求、申请入口，已关闭职位拒绝。
- `prove_ats`：对于新增 ATS 单职位，需要有企业官网首页在搜索结果出现过，且 Fetch 到的官网内容包含指向相同 ATS 招聘板的链接，才能将其作为**有企业官网反链的岗位证据**进入独立资格筛选；否则只是未核实候选，不参与 Top10。
- 每次最多 **4 次模型 Responses、4 次 Search、8 次 Fetch**；不使用无限内置搜索。实际计费视 DeepSeek 模型 Token、成功的 Search/Fetch 及平台价格而定。
- 每个外部来源均不自动宣称“仍在招聘”；三态任职资格判定（符合、信息不足、不符合）及大陆地点过滤继续由 HHBA 的独立核验和融合组件处理。
- 这套动态能力不预先限定具体企业名单，只限定可信**招聘系统及链接格式**；依然无法保证全中国企业完全覆盖，也不提供对企业工商主体的法律尽调。

## 开关与发布安全

V8 开关 `HHBA_MATCH_V8_DEEPSEEK_AGENT_ENABLED`，**缺省关闭**。即使设置该开关，仍须原 `HHBA_MATCH_SERVICE_ENABLED=1`、`HHBA_MATCH_EXTERNAL_SEARCH_ENABLED=1`、已登录候选人、必要 AI 授权、D1 每日搜索额度才会触发。

本 PR 只做受控预览/合约测试。正式站 `hhba.work` 不启用 AI 和动态检索；不放出额外的无登录、可消耗 Token 的测试接口。

## 风险与下一阶段

1. Search 可能不能收录部分招聘详情，Fetch 可能遇到登录、动态加载或访问限制。不能拿搜索摘要冒充任职条件。
2. 企业官网反向链接证明**网站之间的链接关系**，不等于第三方绝对认证该公司的法人身份和实时在招状态。对公司域名仿冒需持续改进，尤其是大公司母子公司招聘板或不同品牌域名。
3. ATS 解析仅支持明确包含公司名、具体国内城市、职责、要求与申请入口的单职位网页。解析失败时不纳入匹配。
4. 需要在无个人资料的少量真实样本上测量 DeepSeek V4 Pro 的总费用、实际搜索链接数、正式岗位详情获取率、可信候选数；达到质控阈值后再由用户验收决定上线。

## CI 变更说明

V8 专项测试已整合到既有、可靠的 `hhba-domestic-match-fusion-v1.yml` 工作流，避免重复增加难以稳定触发的新工作流；每次 PR 验收均包含 V8 API 静态检查、模型模拟和 V7 融合回归。
