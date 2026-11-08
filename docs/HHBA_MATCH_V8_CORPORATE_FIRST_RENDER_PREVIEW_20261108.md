# HHBA V8：企业官网优先召回 + 动态职位页保守读取（预览版）

日期：2026-11-08。PR #299，基于 V7 草稿分支。**尚未达到真实官方岗位推荐上线验收，禁止合并 `main`、禁止收费上线**。

## 第一部分：企业官网优先，不依赖雇主私有 API

改动：`deepseek-job-search-quality.js`、`deepseek-official-job-agent.js`

- 仍通过 DeepSeek 官方公开 Search 发现岗位，不限定企业名单。
- 搜索同时出现**独立企业网站首页或招聘介绍页**和该注册域名下的单职位详情时，后者增加有限的优先读取分数（只是 `CORPORATE_SITE_SEEN` 检索线索）。
- 继续对高匹配的岗位正文、准确工作城市、资格和申请入口进行真正 Fetch；公司的官网证据依然要独立 Fetch 核验，不可由搜索摘要或同域名推断直接放行。
- 继续排除已在第七至九轮识别的跨企业招聘聚合站、校园就业站。岗位库仍不依赖企业开放 API。
- 所有中国大陆真实工作地点要求、V7 学历、经验、职业证书与硬性技能限制保留。

## 第二部分：动态渲染页面的真实字段

改动：`mainland-job-workplace-evidence.js`、`deepseek-official-job-agent.js`

- DeepSeek Fetch 返回 Markdown；有些企业网页依赖 JS，普通 Fetch 未必取得实际职位头部和工作地点。
- 新规则在一个已实际读取的岗位详情中，保守识别“职位名称 + 上海”等**单个标题行**，即使前方有官网导航、招聘防诈骗说明，也不从导航文字或企业总部地址推断工作地点。
- 当本次额外获取的真实单岗 HTML 含 `application/ld+json` / `JobPosting` 时，支持提取与职位名称一致的 `jobLocation.address.addressLocality`、`addressRegion`；**不允许**海外国家、过去截止日期、同页多个 JobPosting、与 Markdown 的工作城市冲突或仅有不相关职位 JSON-LD。
- 识别职位页“腾讯招聘”这一页内雇主品牌线索，但必须再取得独立真实企业官网证明，不能把品牌线索当认证。
- 所有未获取正文、未能确认大陆工作城市、职位已关闭、无任职条件、无有效申请动作的情形继续拒绝。

## 第三部分：Cloudflare Browser Rendering 独立补充读取

新增：`cf-job-browser-preview.js`、`0020_match_v8_browser_render_accounting.sql`

- 仅当 `HHBA_AUTH_ROLLOUT=preview` 且 `HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED=1`，并在预览环境配置私有 `HHBA_BROWSER_ACCOUNT_ID` 和 `HHBA_BROWSER_RENDER_TOKEN`，才提供浏览器补读函数。**默认关闭、生产环境禁用**。
- 只读取先前真实 Search 发现、通过安全 URL 校验、属于合理企业招聘域名或与检索出的企业网页同注册域名的职位链接。
- 首次 DeepSeek Fetch 文本缺失关键字段才尝试；每次智能推荐最多 **2 次额外浏览器渲染**，不计入原有 **4 模型 / 8 Search / 20 Fetch** 调用上限，但单独计费。
- 使用 Cloudflare Browser Rendering Snapshot（`content` HTML 和 `markdown`）；只加载公开内容，不传简历、账号凭证、Cookie，也不执行登录、破解验证码、绕过反爬或自动投递。
- 由于 Cloudflare 浏览器渲染价格未纳入 DeepSeek 的费率表，**只要实际使用，整体金额估计 `complete=false`，`browser_cost_estimate_cny=null`**。不能把 DeepSeek 成本冒充总费用。
- 预览 D1 在启用前必须部署 `0020` 新表：仅保存匿名 request ID、日期、账户哈希、额外渲染调用数（≤2）、成功恢复与失败计数以及“费用未完整核算”。表未部署则**先拒绝整次付费实验**；不能边收费边丢日志。

## 真实公开页面技术抽查

使用 Cloudflare 浏览器渲染了公开的腾讯职位详情
`https://careers.tencent.com/jobdesc.html?postId=2094968965272092672`：

- 实际公开渲染结果包含“在研UE5策略竞技游戏-内容运营经理 上海”、岗位职责、任职条件及页面的申请入口。
- 网页前有“社会招聘”“工作地点”导航和新加坡招聘诈骗提醒；这些**不构成**正文职位的海外工作地点，不应掩盖真正的职位头部。
- 此项是**浏览器技术可读性抽查**，不是 V8 DeepSeek→浏览器补读→企业核验→资格审查的正式端到端成功案例；不据此宣称任意企业都可抓取或 Top10 已有效。

## 发布门槛

- 代码和模拟回归可验证新功能及防误判，**不能替代新的真实端到端正例**。
- 未开启新浏览器付费服务、未部署新表之前不得声称预览浏览器补读已上线。
- 下一轮受控实测应先核实 Cloudflare Browser Rendering 的费用额度和许可、启用预览环境单次授权；逐条保存证据摘要和拒绝代码，不保存简历/网页全文。必须拿到至少几个**独立可人工核验**的真实大陆岗位、企业官网主体证明和申请入口，并确保 V7 硬性资格通过，才能提请合并。
- `hhba.work` 生产开关继续关闭，PR #299 保持 Draft。
