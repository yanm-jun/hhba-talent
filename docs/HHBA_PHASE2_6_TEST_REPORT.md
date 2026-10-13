# Phase 2.6 测试报告

实际结果：

- `pytest tests/test_phase1_p0.py tests/test_phase25_requirements.py tests/test_phase26_worker.py -q`：5 passed。
- 合成 DOCX Worker 路径：1 passed，约 10 秒。
- 合成 PDF Worker 路径：1 passed，约 21 秒。
- PostgreSQL 专用 `hhba_phase12_test`：`alembic upgrade head`、`current`、`heads` 通过，head 为 `20261014_phase26_worker_queue`；队列字段已用 inspector 校验。
- `npm run build`：通过。

浏览器验收实际发现并修复：422 验证错误被错误渲染为 `[object Object]`；刷新后 CSRF 丢失；身份恢复前深链跳转。

Docker Compose 配置通过 `docker compose --env-file .env -f infra/compose.yaml config --quiet`。Worker 镜像构建已开始，但 Docling Linux/PyTorch 大依赖尚未在单次执行窗口内完成，因此不能报告容器运行时资源限制已验证。
