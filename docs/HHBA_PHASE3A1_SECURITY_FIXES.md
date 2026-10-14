# Phase 3A.1 安全修复

## 授权

- `consents` 已在开发 PostgreSQL 上具备 `uq_consents_user_type`。
- 企业检索、公开分享、搜索引擎收录仍是三项独立授权。
- 关闭 `enterprise_search` 时同步删除投影；即便异步删除延迟，检索 SQL 仍联结当前 `Consent.granted=true`，残留行不可返回。
- PostgreSQL UPSERT 与组织行锁分别处理授权和限流的并发首次创建。

## 企业投影

企业投影只允许展示名称、能力标题/摘要、技能、行业、粗粒度地区、合作方式、确认年限和已授权项目摘要。它不读取原始文件、解析证据、任意 JSON 顶层字段、手机号、邮箱、微信或详细地址。规则的局限是自然语言敏感信息不能被正则完全识别；因此仍应在公开运营前增加人工/模型安全审核策略。

本人预览接口 `GET /api/v1/me/profile/enterprise-preview` 只能由当前会话访问，并复用相同 `projection_values()` 转换，不会在未授权时创建投影。

## 未修复风险

- 本轮没有部署内容审核/PII DLP 服务；复杂变体、图片内联系方式和语义化住址仍属运营前风险。
- `candidate_ref` 仅是安全引用，不是访问授权；Phase 3C 必须重新执行企业、成员、状态与授权检查。
