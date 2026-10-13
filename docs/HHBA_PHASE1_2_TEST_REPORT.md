# Phase 1.2 测试报告

实际执行：`pytest tests/test_phase1_p0.py -q`，结果 `1 passed`（单个端到端用例包含 22 个断言）。覆盖注册、重复邮箱 409、错误密码 401、登录 Cookie、CSRF 写入、待审核拒绝、审核后访问、成员添加、普通成员越权 403、移除成员后拒绝、暂停企业后拒绝、跨组织成员枚举 404、三项独立授权、审计脱敏、登出和旧会话 401。

PostgreSQL 专用库 `hhba_phase12_test`：`alembic upgrade head`、`current`、`heads` 均为 `20261013_phase1 (head)`；重复 upgrade 无变更；实际表数 7；`CREATE EXTENSION IF NOT EXISTS vector` 后验证 vector 存在。未改动 `hhba_dev`。
