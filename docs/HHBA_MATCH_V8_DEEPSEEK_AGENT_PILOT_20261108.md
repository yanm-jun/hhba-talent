# HHBA V8 第二阶段 — DeepSeek 全网公开招聘检索（不依赖企业私有 API）

日期：2026-11-08。用户明确要求以 **DeepSeek 自主搜索公开互联网** 为核心，不能以逐家企业开通 API 或适配国外 ATS 为前提。企业范围无限制；实际工作地点 **必须在中国大陆**，外资在中国大陆岗位亦可。

## 已验证的官方 API 能力（请勿混淆）

- DeepSeek **Search**：`POST /v1/tools/search`，使用企业公开网络索引查找 URL，无需向各招聘企业申请 API Key。
- DeepSeek **Fetch**：`POST /v1/tools/fetch`，读取公开网页的 Markdown，受到站点登录、政策和正文可访问性限制。
- DeepSeek V4 Pro **Responses**：`POST /responses`，允许模型动态决定搜索的关键词、读取哪些页面及何时核验，使用 `function` 工具调用；官方注明 `max_tool_calls` 会被忽略，因此不启用无法控费的内置 `web_search`。
- 资料：https://api-docs.deepseek.com/zh-cn/guides/search/ ；https://api-docs.deepseek.com/zh-cn/guides/responses_api/ 。

## 实现架构

代码：`apps/web/functions/_lib/deepseek-official-job-agent.js`。

1. 只向联网模型发送脱敏后的 **目标职业**，绝不发送手机号、邮箱、姓名或简历正文；现有 AI 简历理解仍走用户授权单独流程。
2. 模型决定搜索词；`search_jobs` 通过 DeepSeek Search 返回公开网页链接（不是企业招聘 API）。不在代码中维护固定的公司域名名单。
3. `read_job` 只能读取 Search 结果实际出现过的 HTTPS **单个岗位详情**。公开招聘聚合平台、社交媒体、普通职位列表、非 job URL、访问限制、没有岗位要求或无中国大陆办公城市的页面都不当作可推荐岗位。
4. `verify_employer` 查找 Search 搜出的另一独立公司网站页面，再通过公司名及公司域名一致性，或官网指向异域岗位网站的明确链接，交叉验证来源。仅通过搜索摘要、AI 单方声称“官网”、或单个职位页面都不能进入正式 Top10。
5. 只有有任职要求、独立公司网站佐证、准确大陆工作城市、申请入口证据和 Fetch 的时间戳才转 `OFFICIAL_DETAIL_FETCHED`，复用 V7 的已审计资格与融合排序。
6. **注意真实性边界**：公司名称和同注册域名相互印证只能证明公开网站之间存在一致性或链接关系，**不等于工商注册认证**；公开职位页面存在也不保证实时接收申请。前端仍显示需要到官网确认。

## 服务端硬限制

每次 **最多 4 次 Responses / 8 次 Search / 20 次 Fetch**；一旦达到请求的已核验岗位数量就提前结束，不要求耗尽预算。按用户每日 Search 限额及原有 AI 用户/全站每日配额执行。由于 DeepSeek 忽略 `max_tool_calls`，本实现没有开放内置服务端 web_search，而是由 HHBA 服务端执行每一个付费 Search/Fetch，并拒绝模型额外请求。

开关 `HHBA_MATCH_V8_DEEPSEEK_AGENT_ENABLED=1` 且现有 Preview `HHBA_MATCH_SERVICE_ENABLED=1`、`HHBA_MATCH_EXTERNAL_SEARCH_ENABLED=1` 才可能走此路径。正式站两个主开关继续关闭，V8 标志缺省关闭。

## 测试要求与评价指标

合约测试 `apps/web/scripts/match-v8-deepseek-agent.contract.test.mjs`：任意未预设企业招聘 URL、不同国内企业的公开网页、工作地点、任职要求、官网关联性、非官网/聚合页、伪造域名、境外职位、调用预算、Provider 错误、最终候选人资格融合。

下一项不是无条件上线，而是在受控 Preview 对**不含真实个人身份的职业搜索目标**执行小规模 V4 Pro + Search/Fetch 真实测试，记录搜索/抓取次数、职位详情确认数、最终合格推荐数、费用和时间。实测之前不能宣称达到“全中国覆盖”或者“搜索到即仍招聘”。

## 迁移说明

之前的 V8 海外 ATS 专用分支逻辑已替换为不依赖招聘管理系统供应商的公网页面发现和证据核验。六家原官方招聘源在 V7 仍可通过相应已有链路继续工作；**不需要新企业的私有 API**。

V8 是基于 V7 PR #298 的堆叠草稿 PR #299。不得提前合并 main，不得提前开放 hhba.work 的 AI 收费入口。

## 2026-11-08 用户确认：V8 配额和按实际使用量记录

- 最多 **4 次模型 Responses API**；0 到 4 次均合法，读取到足够的可交叉验证岗位提前停止。
- 最多 **8 次 Search**；这是服务器强制的请求上限，不是必须执行 8 次。
- 最多 **20 次 Fetch**；重复公司的相同官网主页可以复用本次请求内缓存，不能重复付费读取。
- 所有学历、经验、强制证书、必要技能和中国大陆工作城市限制仍由 V7 独立硬条件审核，不能因参考评分高而放行。
- 新增 `apps/web/functions/_lib/deepseek-discovery-billing.js`：分别记录实际尝试的模型/Search/Fetch 数量、成功返回结果的 Search/Fetch 数量、模型返回的 `input_tokens` / `cached_tokens` / `output_tokens`；按 DeepSeek 公布的当期人民币单价估算费用。
- DeepSeek 2026-11-08 官方公开费率快照：Search 和 Fetch 每次成功返回结果 0.005 元，V4 Pro 模型高峰输入缓存命中 0.30 元/百万、未命中 9 元/百万、输出 27 元/百万；非高峰分别 0.15、4.5、13.5 元/百万。中国法定节假日费率与实际最终结算以 DeepSeek 账单为准；提供高峰费率上界估算，不冒充真实发票。
- 使用新 D1 迁移 `apps/web/d1/0019_match_v8_discovery_accounting.sql` 记录**每个实际匹配动作**的匿名账户哈希、请求 ID、每日时间、调用数量、可计费成功调用数量、Token、人民币估计费用、费用是否完整。不保存简历、关键词、招聘 URL、个人信息。部署/启用预览 V8 前必须先创建这张表，后端在表缺失时拒绝产生新的 V8 付费调用。
- 仅 `HHBA_MATCH_V8_DEEPSEEK_AGENT_ENABLED=1` 触发新费用记录；未获用户验收前正式站两个主开关继续关闭，不合并 `main`。

### 验证

`node --test apps/web/scripts/match-v8-deepseek-agent.contract.test.mjs apps/web/scripts/match-v8-discovery-cost.contract.test.mjs`（在 `apps/web` 工作目录时使用 `scripts/...`）覆盖 8/20 上限、低于上限的实际使用费、复用/早停、强条件匹配和 D1 迁移。

## 真实 DeepSeek V4 Pro 联网验收——2026-11-08

测试：仅使用**虚构的求职方向“内容运营”**，经 GitHub Actions OIDC 验证后从 Cloudflare Preview 的保密 API Key 发起一次完整真实请求；不发送真实个人简历。结果参见：
https://github.com/yanm-jun/hhba-talent/actions/runs/42476956268

- 一次真实会话：**4 模型响应、3 Search、4 Fetch**；硬上限分别 4/8/20，未达到 8/20 上限。模型在 4 次调用额度用尽时结束。
- Search 发现 **12 条**通过程序 URL 初筛的单职位候选链接；4 次 Fetch 返回可计费内容。
- **经完整职位正文解析：0 条；独立官网证据核验：0 条；实际符合条件进入推荐：0 条。** 工作流 API 返回 `COMPLETE` 只代表调用过程没有接口错误，绝不能理解为成功推荐；现在新增独立 `quality_status` 标识 `NO_VERIFIED_JOBS`。
- 服务端返回的 usage：input 5528 Token（其中 cached 3456）、output 428 Token；Search 成功返回 3 次，Fetch 成功返回 4 次。
- 按当日 DeepSeek 官方人民币价格估算：Search/Fetch ¥0.035，模型 ¥0.01562，**总计 ¥0.05062**，高峰费率上界估算 ¥0.066241。**这不是服务商实际扣款账单。**
- 已核对**独立 Preview D1**的 `hhba_match_discovery_accounting` 记录：调用、Token 和费用与 GitHub 运行日志一致；未使用生产 D1。
- 实验成功证明了：**不依赖企业私有 API，DeepSeek V4 Pro 能运行完整的搜索→抓取工具循环，并能按实际使用量计费记录。**
- 实验尚未证明：公开招聘页面的内容解析、独立企业身份链接核验、符合岗位资格的推荐输出；不得把 12 条搜索链接称作 12 条真实在招岗位。
- **后续整改优先级**：进一步按阶段统计 `FETCH_NO_TEXT`、`MISSING_DUTIES`、`MISSING_REQUIREMENTS`、`MISSING_EXPLICIT_WORKPLACE`、`MISSING_COMPANY_LABEL` 等拒绝原因，在不放松真实性与学历经验硬门槛前提下改进解析；之后再做第二轮真实 API 对照。
- 临时的 `/api/match/v8-live-eval` 和 OIDC 工作流**必须在分支合并前撤除**，清理付费测试相关 Preview 部署。生产主线和 AI 开关保持不变。
