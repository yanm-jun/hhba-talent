# HHBA 正式站 AI 匹配发布清单 · 2026-11-08

## 发布目标

将已通过 Preview 验收的 PR #283（R2 私有简历 → Cloudflare 智能匹配）、PR #284（DeepSeek Search/Fetch 国内官方招聘发现）和 PR #285（站内/站外 Top10 排序与弹窗展示）按依赖顺序合并至 main，交由 Cloudflare Pages 正式部署 hhba.work。

本发布补丁只新增生产模式标识 `HHBA_MATCH_RUNTIME_MODE=production` 对站外搜索路由的支持。它不会改变现有 `HHBA_AUTH_ROLLOUT` 或登录会话处理，避免影响真实用户账户。

## 生产前置条件

1. Cloudflare Production D1 `HHBA_PNVS_AUTH_DB` 与 Preview D1 不同；使用 D1 Time Travel 恢复书签确认可回退后，执行 `apps/web/d1/0017_resume_match_usage.sql` 和 `0018_external_search_usage.sql`。两表仅匿名账号哈希及调用额度，不保存简历。
2. Cloudflare Pages Production 专属变量 `HHBA_MATCH_RUNTIME_MODE=production`。
3. 生产专属 `HHBA_MATCH_DEEPSEEK_KEY` 和 `HHBA_MATCH_LIMIT_PEPPER` 必须由持有人在 Cloudflare 生产环境安全配置，不接受聊天内传递密钥；不得复制 masked secret 或沿用 Preview。
4. 仅在生产 D1、Secret、官方职位核验和少量真实外部搜索验证后才将 Production `HHBA_MATCH_SERVICE_ENABLED=1` 与 `HHBA_MATCH_EXTERNAL_SEARCH_ENABLED=1`。部署阶段默认关闭，保护付费接口和真实用户。
5. `/api/match/status` 和 `/api/match/discover` 可匿名读取只含功能状态的 JSON；实际 POST 仍需候选人登录、同源、显式授权，自动执行配额控制。

## 安全与费用规则

- 中国大陆地点和已审核的招聘来源强制核验；无真实岗位时不推荐海外岗位补数。
- 站外仅腾讯、华为、美团官方岗位详情；每用户每天最多两次、全站每日十二次；每次 Search≤2、Fetch≤3。
- AI 匹配仅在明确授权时发送脱敏文字，模型推荐分数不代表录用概率。
- 原正式站登录、R2 简历、支付、用户统计、企业岗位与城市人才政策不更改业务逻辑。

## 验收

- 新分支对上游 3 个 PR 进行完整 CI 回归。
- 合并后对正式站至少访问页面、匹配状态、外部搜索状态、匿名 POST 未授权行为、核心登录/职位路由和生产 D1 新表存在性。
- Cloudflare production deployment sha 应等于最新 main sha；完成 deploy:success 才宣布正式上线。
- 若 Secret 未配置，明确告知用户“前端代码已上线，付费 AI 功能仍待生产密钥激活”，不得称完整 AI 功能可用。
