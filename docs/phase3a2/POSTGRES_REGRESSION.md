# Phase 3A.2 PostgreSQL 回归记录

最后执行：2026-10-15（本机 Docker Desktop）。

- 隔离数据库：`hhba_phase3a2_test`。
- 未对 `hhba_dev` 执行清库、重建或迁移验证。
- 命令：以 Compose 的一次性 Worker 容器挂载只读 API 源码后执行 `alembic upgrade head`、`alembic current`、`alembic heads`，并再次执行 `alembic upgrade head`。
- 结果：当前与 head 均为 `20261015_phase3a2_recruiter_invitations`；第二次升级未报错。

发现并修复：早期基线的 `alembic_version.version_num` 为 `VARCHAR(32)`，无法保存现有描述性迁移标识。`migrations/env.py` 仅在 PostgreSQL 检测到该旧宽度时将该 Alembic 元数据列扩至 64；该操作不触及任何 HHBA 业务表、用户、档案、企业或审计记录。

本文件只记录迁移机制验证，不代表所有浏览器验收或生产合规已完成。
