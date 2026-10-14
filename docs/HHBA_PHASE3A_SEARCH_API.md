# HHBA Phase 3A 搜索 API

`POST /api/v1/organizations/{organizationId}/talent-search`

需要有效会话、`X-CSRF-Token`、组织 active 成员资格及 `approved` 企业状态。非成员返回 404；待审核/暂停企业返回 403；超过限制返回 429。

请求字段：`keywords`（最多 200 字符）、`skills`（最多 8 项）、`industry`、`region`、`work_mode`、`work_years_min`、`work_years_max`、`page`（1–10）和 `page_size`（1–10）。至少需要一个条件；年份范围非法返回 422。

响应仅有最小候选人卡片：展示名、能力标题、技能、行业、地区、合作方式、本人确认的工作年限、已授权项目摘要、真实 `match_reasons` 和无总数的安全分页信息。没有简历文件、联系方式、原始 evidence、用户邮箱、审计字段或内部查询文本。

审计只保存查询规范化对象的短哈希、结果范围桶和页码，不保存完整自然语言内容。
