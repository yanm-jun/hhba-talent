# Phase 2.6 安全审查

API 不再直接解析文档；Worker 和 Docling 子进程与 API 分离。PostgreSQL 行锁防止双 Worker 重复领取，租约恢复防止 Worker 崩溃后永久 processing，重试上限为三次。

残余风险：恶意 PDF/DOCX 的解析器漏洞无法仅靠容器限制完全消除；Docker Worker 镜像与运行时限制尚未完成实际启动验证；开发机上的绑定目录权限不等价于生产秘密存储。上述风险阻止 READY。
