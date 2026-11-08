# HHBA 全国岗位动态搜索 V2：标准低成本方案

2026-11-08 · 独立草稿 PR #287（不合并 main，正式站 hhba.work 不受影响）

## 产品目标与能力边界
本版本不再把企业写死为腾讯、华为、美团。DeepSeek Search 动态寻找全国职位，并支持 Ashby、Lever、Greenhouse、SmartRecruiters 的不同企业招聘租户；原有三个企业招聘域名保留。
并不等于能够读取所有企业自建招聘站点，所有网页都必须符合可信招聘系统路径、职位正文、工作地点与申请入口的规则。

## 严格预算
搜索词仅包含职业方向，不能发送简历全文、姓名、手机、邮箱或任意用户 URL。
每次最多 5 次 Search、10 次 Fetch，并发限制分别为 2 和 3；总计最多 15 个外部请求。
DeepSeek Search/Fetch 以 HTTP 200 且有结果的调用按次计费：每个 0.005 元，15 次全成功时理论最多 0.075 元，不包含最初 DeepSeek Flash 简历分析 Token。
同一个抽象岗位方向的公开职位证据保存 24 小时（加盐哈希键），缓存命中返回来源信息但不重复调用服务，也不消耗新增配额。
未命中缓存时，继续限制每用户每天 2 次以及全站每天 12 次非缓存搜索。测试阶段默认不自动触发、只由用户点击按钮启动。

## 职位证明等级
VERIFIED_EMPLOYER_DOMAIN：目前限定已核验的企业自有招聘域名（如腾讯、华为、美团），仍不能保证职位当前开放。
VERIFIED_ATS_TENANT_ONLY：招聘系统上确实有该企业租户和完整职位详情，但企业法律主体归属尚未独立验证；必须在推荐界面明确标记该局限。
NEEDS_OFFICIAL_CONFIRMATION：所有站外职位统一标记为需要再次确认是否开放，不宣称现招、可投递成功或录用概率。
只有符合中国大陆工作城市、岗位职责、任职要求、申请入口和同版原文证据的职位才能参与 Top 10，不足 10 不凑数。

## 数据库和部署
Preview 独立 D1 执行 apps/web/d1/0019_external_search_public_cache.sql。生产环境仍未启用付费 AI 开关，不做生产数据库迁移或正式部署。
缓存表只保存加盐职业哈希和公开岗位证据、检查时间、过期时间；不保存个人简历和个人通讯方式。
运行专项 CI：node --test scripts/domestic-search-fetch.contract.test.mjs scripts/domestic-search-fetch.route.test.mjs scripts/domestic-match-fusion.contract.test.mjs；同时 npm run build。
在 Preview 首先验证功能状态、D1 限额和缓存命中，再以用户授权的测试账号做有界真实搜索。未实测前不宣称召回率或匹配准确率。

官方文档：https://api-docs.deepseek.com/zh-cn/guides/search/