# Phase 2.5 测试报告

## 实际执行结果

| 命令 | 结果 |
| --- | --- |
| `npm run build`（`apps/web`） | 通过；Vite 8.3.4，1,573 modules transformed |
| `.venv\\Scripts\\python.exe -m pytest tests/test_phase1_p0.py tests/test_phase2_profile_security.py tests/test_phase25_requirements.py -q` | **7 passed**，3 条 Docling 上游弃用警告 |
| `alembic upgrade head && alembic current && alembic heads && alembic upgrade head`（专用 `hhba_phase12_test`） | 通过；`20261014_phase25_requirements (head)`，重复升级无变更 |
| PostgreSQL inspector schema check | 通过；`hiring_requirements` 及 `organization_id`、`created_by`、`description`、`status` 存在 |

新增测试覆盖当前身份读取、企业 A/B 需求隔离、跨组织 ID 访问拒绝、无 CSRF 写入拒绝、被移除成员立即失去需求访问权限。既有测试继续覆盖会话、组织审核、上传所有权、Docling 合成 PDF/DOCX、档案发布与撤回。

测试只使用 UUID 合成身份和 SQLite 隔离库；PostgreSQL 迁移只使用既有专用测试库，未清空或重建开发库。
