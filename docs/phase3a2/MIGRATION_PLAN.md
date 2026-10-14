# 迁移与回滚计划

1. 在专用 PostgreSQL 测试库运行 `alembic upgrade head`、`current`、`heads`。
2. 生产执行前备份并由变更负责人核对 head；迁移不删除既有表或资料。
3. 不从既有组织成员推断招聘者授权；历史用户未满足新条件时会被安全拒绝。
4. 回滚只适用于未产生业务资料的受控环境；生产数据回退要采用前向修复，而不是删除认证/审计记录。

本轮实际 PostgreSQL 测试库：`hhba_phase3a2_test`，已到 `20261014_phase3a2_identity`。
