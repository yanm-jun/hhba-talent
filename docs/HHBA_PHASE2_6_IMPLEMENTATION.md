# Phase 2.6 实施记录

- 新增 `app/docling_worker.py`、`Dockerfile` 与 Worker Compose 服务。
- 新迁移 `20261014_phase25_parse_worker`、`20261014_phase26_worker_queue`；未修改历史迁移。
- 解析 API 改为真实入队，状态 API 返回任务 ID、状态、次数、错误及仅所有者可读的结果。
- React 解析页按真实状态轮询，不再假定同步完成。
- 修复身份恢复后缺失 CSRF token 与身份恢复前路由跳转两个浏览器联调缺陷。

浏览器使用合成 DOCX 完成：注册 → 上传 → 入队 → Worker 解析完成 → 应用草稿 → 编辑保存 → 确认 → 授权发布。真实公开 API 响应只含白名单字段。
