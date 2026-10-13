# Phase 2.5 后端

## 新增/复用接口

- `GET /api/v1/auth/me`：读取当前服务端会话身份。
- `GET /api/v1/organizations`：只返回当前活跃成员所属组织及审核状态。
- `POST|GET /api/v1/organizations/{orgId}/hiring-requirements`
- `GET|PATCH /api/v1/organizations/{orgId}/hiring-requirements/{id}`

需求记录为组织私密草稿，状态仅限 `draft` 与 `archived`。活跃成员可读取本组织；普通成员仅可修改自己创建的需求；组织所有者可管理本组织需求。其他组织、被移除成员和猜测 ID 的请求统一返回 404。所有写入仍经现有 CSRF 和审计机制。

## 迁移

`20261014_phase25_requirements` 在 `hiring_requirements` 中创建外键 `organization_id`、`created_by`、必要字段和组织索引。历史迁移未被重写。

Alembic 连接层已把通用 `postgresql://` URL 正规化为当前项目已安装的 `postgresql+psycopg://`，避免 SQLAlchemy 错选未安装的 `psycopg2`。
