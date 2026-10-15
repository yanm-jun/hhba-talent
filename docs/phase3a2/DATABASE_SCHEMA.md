# Phase 3A.2 数据库结构

新增迁移 `20261014_phase3a2_identity`（前置：`20261014_rotate_candidate_refs`）为加法迁移，不删除历史数据。

| 表 | 目的 |
| --- | --- |
| `business_identities` | 用户业务身份与状态，`(user_id, identity_type)` 唯一 |
| `organization_verifications` | 企业主体认证状态、复审时间与原因码 |
| `recruiter_verifications` | 经办人认证状态 |
| `recruiter_organization_authorizations` | 经办人与企业的角色、有效期和撤销记录 |
| `verification_documents` | 私有凭证元数据与随机存储键，非公开文件内容不入库 |
| `verification_reviews` | 管理员复核决定的不可变审计记录 |
| `platform_service_gates` | 网络招聘服务的运营启用门控 |

历史有能力档案的用户被补记为 candidate；历史组织成员不被推断为 recruiter，遵循默认拒绝。
