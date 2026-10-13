# Phase 1.1 实测结果

迁移命令：`alembic upgrade head`、`alembic current`、`alembic heads`；实际输出均为 `20261013_phase1 (head)`，在独立 `phase1-migration-test.sqlite3` 中执行。

独立 TestClient 安全脚本在首个 `register` 断言失败，未完成 P0 矩阵。由于失败响应尚未采集到逐项 HTTP body，测试证据不完整；禁止将任何 P0 项计为通过。此前 Web build、Python compile 通过，但不替代安全验收。
