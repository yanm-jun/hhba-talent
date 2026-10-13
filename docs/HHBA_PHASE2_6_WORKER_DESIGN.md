# Phase 2.6 Worker 设计

API 只负责私密上传与把 `parsing_jobs` 由 `uploaded` 置为 `queued`，不导入或调用 Docling。独立 `app.docling_worker` 使用 PostgreSQL `SELECT … FOR UPDATE SKIP LOCKED` 原子领取一个 queued 任务，再启动 Docling 子进程。

Worker 持久记录 `attempt_count`、`worker_id`、开始/结束时间、租约到期时间和取消标志。租约过期的 processing 任务会在下次领取时恢复为 queued，达到三次上限则失败。删除简历会将未完成任务标记取消；Worker 写回前再次检查取消状态。

`infra/compose.yaml` 定义非特权 UID 10001 Worker：无端口、只读上传目录、只读根文件系统、`/tmp` tmpfs、全 capability drop、`no-new-privileges`、1 CPU、2GiB 内存和 64 PID 上限。Worker 仅连接内部 PostgreSQL 网络；这不是“线程安全沙箱”。

子进程在 Linux 以新 session 启动，超时以 `killpg(SIGKILL)` 终止进程组；Windows 本地测试使用 `taskkill /T /F`。不可信文档从不被当作脚本执行。
