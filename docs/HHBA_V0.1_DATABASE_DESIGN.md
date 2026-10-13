# HHBA V0.1 核心数据设计

状态：逻辑模型，尚未创建迁移。所有主键建议 UUID；业务表含 `created_at`、`updated_at`，审计表只追加。

## 可见性与主体

`visibility`: `private`（仅本人/受控管理员）、`verified_enterprise`（满足企业身份和个人授权）、`public`（明确允许公开）。默认均为 `private`。`actor_type`: `user`、`enterprise_member`、`agent_client`、`admin`。

## 表清单

| 表 | 关键字段 | 用途/约束 |
|---|---|---|
| `users` | `id`, `email_normalized`, `status`, `deleted_at` | 个人身份；email 唯一；软删除/匿名化流程 |
| `auth_identities` | `id`, `user_id`, `provider`, `provider_subject` | 密码/OAuth 可扩展；不存明文凭据 |
| `organizations` | `id`, `legal_name`, `status` | 企业租户边界 |
| `organization_memberships` | `organization_id`, `user_id`, `role`, `status` | 唯一 `(organization_id,user_id)`；`owner/member` |
| `profiles` | `id`, `owner_user_id`, `status`, `search_enabled` | 个人能力卡片聚合；一位用户可有一个 active profile |
| `profile_versions` | `id`, `profile_id`, `version`, `content_json`, `confirmed_at` | 用户确认后的不可变快照；版本唯一 |
| `resumes` | `id`, `owner_user_id`, `storage_key`, `mime_type`, `sha256`, `status` | 原件受限保存；不直接参与搜索 |
| `parsing_jobs` | `id`, `resume_id`, `state`, `provider`, `error_code` | 异步处理状态；不存敏感错误正文到客户端 |
| `parsing_drafts` | `id`, `job_id`, `structured_json`, `source_map`, `reviewed_at` | 草稿与来源定位；未确认不得发布 |
| `skills` | `id`, `canonical_name`, `normalized_name` | 受控技能词表；`normalized_name` 唯一 |
| `profile_skills` | `profile_version_id`, `skill_id`, `level`, `evidence` | 版本化技能声明；可追溯证据 |
| `profile_experiences` | `id`, `profile_version_id`, `employer`, `title`, `start_date`, `end_date`, `visibility` | 经历，字段级 visibility |
| `profile_projects` | `id`, `profile_version_id`, `name`, `summary`, `evidence_url`, `visibility` | 项目能力证据，默认私有 |
| `capability_statements` | `id`, `profile_version_id`, `statement`, `embedding`, `visibility` | 可检索能力摘要；向量仅由允许字段生成 |
| `resource_grants` | `id`, `profile_id`, `grantee_type`, `grantee_id`, `scope`, `field_set`, `starts_at`, `expires_at`, `revoked_at` | 个人对企业/Agent/公开的显式授权；撤回即时生效 |
| `agent_clients` | `id`, `organization_id`, `name`, `status`, `credential_hash` | Agent 机器身份；仅保存密钥哈希/公钥指纹 |
| `agent_delegations` | `id`, `agent_client_id`, `organization_id`, `scope`, `expires_at`, `revoked_at` | Agent 代表企业的可验证委托 |
| `contact_requests` | `id`, `profile_id`, `requester_org_id`, `agent_delegation_id`, `purpose`, `message`, `state` | `pending/approved/rejected/withdrawn/expired`；不可含联系方式回传 |
| `contact_channels` | `id`, `profile_id`, `channel_type`, `encrypted_value`, `visibility` | 仅获批时解密/呈现；密钥管理另行设计 |
| `deletion_requests` | `id`, `user_id`, `scope`, `state`, `completed_at` | 删除、导出与合法保留例外可追踪 |
| `audit_events` | `id`, `occurred_at`, `actor`, `action`, `resource`, `outcome`, `request_id`, `metadata_redacted` | 只追加，不记录原始简历、token 或敏感正文 |

## 隔离与索引规则

* 所有企业查询均以 `organization_id` 和 `actor user_id` 绑定；Agent 再额外绑定有效 `agent_delegation_id`。
* 搜索投影以 `profile_version_id`、`visibility`、`search_enabled`、有效 grant 为输入生成；原始 `resumes` 永不被检索 API 读取。
* `embedding` 采用 pgvector，必须和生成它的版本与可见性绑定；授权撤回后投影立即不可查询，并异步删除/重建向量。
* 数据库可加 Row-Level Security 作为纵深防御，但 V0.1 首先保证 API Policy 层的显式过滤和集成测试；两者规则必须同源。

## 删除生命周期

用户发起 → 身份校验 → 立刻禁用登录、搜索与外部访问 → 删除/加密擦除原件及联系方式 → 匿名化允许保留的审计引用 → 完成事件。法定保留、争议和安全调查例外必须由产品/法务定义，不能静默忽略请求。
