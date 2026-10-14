# Phase 2.6 安全审查

状态：适用 P0 通过。

- FastAPI 只入队，不在 API 进程执行 Docling；Worker 用 PostgreSQL `FOR UPDATE SKIP LOCKED` 领取任务。
- 私有文件仅由 owner API 访问；Worker 仅以只读挂载访问，且无公网端口。
- 非 root、只读根文件系统、capability drop、`no-new-privileges`、CPU/内存/PID 和临时目录限制均已实际读取验证。
- 默认离线运行；不会向外部模型发送简历。
- 公开 API 只返回展示名称、简介、技能和服务；撤回后立即返回 404。
- 会话、CSRF、组织隔离、成员移除、审计脱敏和私有资源隔离的回归均已通过。

非阻塞风险：恶意文档仍可能触发 Docling/底层解析器漏洞；扫描型 PDF 在离线、无 OCR 模型模式下会安全失败。当前镜像携带 CUDA 构建的 PyTorch，但容器无 GPU、运行时为 CPU 限制；后续应换 CPU-only wheel 缩小镜像。
