# HHBA V0.1 API 与 MCP 契约

状态：契约草案，尚未实现。版本前缀为 `/api/v1`；所有响应附 `request_id`，所有写操作写入审计。

## REST API

| 领域 | 方法/路径 | 权限与说明 |
|---|---|---|
| 身份 | `POST /auth/register`, `POST /auth/session`, `DELETE /auth/session` | 认证实现待选型；不在 URL 放 token |
| 我的档案 | `GET/PUT /me/profile`, `POST /me/resumes`, `GET /me/parsing-jobs/{id}` | 仅 owner；上传后仅产生草稿 |
| 确认 | `POST /me/parsing-drafts/{id}/confirm` | 本人确认，产生新 `profile_version` |
| 授权 | `GET/POST /me/grants`, `POST /me/grants/{id}/revoke` | 本人；撤回立即生效 |
| 企业 | `POST /organizations`, `POST /organizations/{id}/members` | owner 受限操作 |
| 搜索 | `POST /organizations/{id}/people:search` | 有效成员；请求由服务端策略裁剪 |
| 联系 | `POST /profiles/{id}/contact-requests`, `POST /contact-requests/{id}/decision` | 企业创建、个人决定 |
| 删除 | `POST /me/deletion-requests` | 本人；返回可追踪状态 |
| 管理 | `GET /admin/audit-events`, `POST /admin/deletion-requests/{id}/resolve` | 最小授权管理员；强审计 |

`people:search` 请求示例（模型解析后的结构化条件，非直接 SQL）：

```json
{"query":"有 B2B SaaS 增长经验的产品经理", "filters":{"skills":["product management"],"experience_years_min":3,"remote_allowed":true}, "page":{"limit":20,"cursor":null}}
```

搜索响应只返回经过 policy 的 `profile_card`：稳定 ID、经裁剪显示名/摘要、允许展示的技能与证据、匹配说明；不得返回 `resume_id`、邮箱、电话、私有经历、授权记录或原始 embedding。

## MCP Server（Python SDK v2）

MCP 仅接受已注册 `agent_client` 的机器认证和未过期 `agent_delegation`。每个 tool input 都包含或由连接绑定 `organization_id`、`delegation_id`；服务器忽略客户端自称的权限。

| Tool | 输入 | 输出 | 禁止行为 |
|---|---|---|---|
| `search_people` | `query`, `filters`, `page` | 政策裁剪的 profile cards、next cursor | 不返回私人字段、不得绕过 limit |
| `get_profile` | `profile_id`, `fields` | 仅 grant 允许字段；`denied_fields` 不泄露原因细节 | 不返回简历原件/联系方式 |
| `create_contact_request` | `profile_id`, `purpose`, `message`, `context_ref` | 请求 ID、`pending` 状态 | 不自动批准、不发送外部邮件 |
| `get_contact_request_status` | `request_id` | 调用方本组织拥有的状态 | 不显示个人决定备注，除非本人授权 |

所有 MCP 工具必须：验证 token/委托/组织归属、做每工具限流、生成 request ID、调用同一 Policy Service、记录审计事件。MCP server 不是数据库管理接口。

## 错误与幂等

* 使用问题详情格式：`code`、安全的 `message`、`request_id`；对不存在与无权资源采用一致的最小披露策略。
* 写入 API 要求 `Idempotency-Key`；联系申请在相同组织、档案、用途、时间窗内去重。
* 分页 cursor 是签名/不透明的，禁止客户端拼接 SQL 或 profile ID 列表绕过过滤。
