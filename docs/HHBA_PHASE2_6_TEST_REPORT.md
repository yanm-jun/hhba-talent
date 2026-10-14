# Phase 2.6 测试报告

状态：READY（实际执行；仅使用合成资料与隔离测试库）。

- `pytest tests/test_phase1_p0.py tests/test_phase25_requirements.py tests/test_phase26_worker.py -q`：7 passed（Phase 1：1，企业需求隔离：2，Worker：4）。
- `pytest tests/test_phase2_profile_security.py`：4 passed（公开发布/撤回、私有文件隔离、DOCX 解析、PDF 解析）。
- `python -m compileall app -q` 与 `npm run build`：通过。

合计 11 个 pytest 用例通过、0 失败、0 跳过；用例数不以断言数计算。

专用库 `hhba_phase12_test` 实际执行 `alembic upgrade head`、`current`、`heads` 与重复 `upgrade head`，均为 `20261014_phase26_worker_queue (head)`。开发库经列、主键、外键及唯一性语义比对后安全纳管为 Phase 1 基线，并前向升级到同一 head；没有 reset、drop 或删除数据。

Compose Worker 在 PostgreSQL 测试库实际解析合成 DOCX 和文本型 PDF，均为 `parsed`、`attempts=1` 且结果已回写。两个 Worker 竞争同一任务的实测结果为 `attempts=1`、仅一个 `worker_id`。实际 cgroup/容器限制：uid/gid `10001`、内存 2GB、1 CPU、PID 64、只读根与上传目录、`/tmp` 的 `noexec,nosuid,nodev`。

Docling PDF 改用 native、无模型管线；运行时 `HF_HUB_OFFLINE=1` 和 `TRANSFORMERS_OFFLINE=1`，不会在解析时下载模型或调用外部服务。
