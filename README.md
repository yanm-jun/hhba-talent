# HHBA — Phase 0

AI 时代的人类能力搜索与连接平台。本仓库目前只包含开发环境准备、架构决策和最小启动骨架；尚未实现任何人才、招聘或企业业务功能。

## 当前状态

**PARTIAL**（2026-10-13）：工作区、Git、Web 最小骨架、API 契约骨架及本地 PostgreSQL + pgvector Compose 配置已准备。Python 3.12 未能从 `PATH` 运行，且 Docker Engine 未运行，因此 API 依赖、Docling 与数据库容器尚未验收。

详见 [docs/PROJECT_READINESS.md](docs/PROJECT_READINESS.md) 和 [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)。

## 目录

```text
apps/web       React + TypeScript + Vite 最小前端骨架
apps/api       Python 3.12 / FastAPI API 骨架（待创建独立虚拟环境）
packages/shared 未来共享的 JSON Schema / TypeScript 类型
infra          仅本地绑定的 PostgreSQL + pgvector Docker Compose
docs           审计、选型、许可和风险记录
references     第三方来源与固定版本记录（不含第三方代码）
```
