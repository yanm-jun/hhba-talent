# HHBA 项目准备状态

**结论：READY** — Phase 0 所需的 Web、API、项目自包含 Python 3.12、Docling、MCP SDK、Docker Engine、PostgreSQL 与 pgvector 均已通过实际验证，可以正式开始 HHBA V0.1 的受控研发。

## 已验证

| 验收项 | 证据 | 状态 |
|---|---|---|
| 独立 HHBA 工作区 | 创建前 `Test-Path` 为 False；后仅写入 `...\HHBA` | 通过 |
| Git 可用 | `git version 2.55.0.windows.3` | 通过 |
| Node/npm/pnpm 可执行 | Node v24.15.0、npm 11.12.1、pnpm 11.25.0 | 通过 |
| 端口空闲 | `Get-NetTCPConnection` 未列出 3000/8000/5432 listener | 通过（审计时点） |
| 工作区结构 | `apps/web`、`apps/api`、`packages/shared`、`infra`、`docs`、`scripts`、`tests`、`references` 已创建 | 通过 |
| 秘钥排除规则 | `git check-ignore` 确认 `.env`、`.venv`、`node_modules`、`data` 均为 IGNORED，源码为 TRACKABLE | 通过 |
| Web 安装、构建与服务 | npm 官方注册表安装 24 个包、`npm audit` 为 0 vulnerabilities；`npm run build` 通过；Vite 监听 `127.0.0.1:3000` 且 HTTP 200 | 通过；验证后已停止测试进程 |
| Compose 解析 | `docker compose -f infra/compose.yaml config --quiet` 成功 | 通过 |
| Python 3.12 虚拟环境 | `.tooling/python312` 内置 Python 3.12.14；`apps/api/.venv` 基路径已切换至该项目内副本 | 通过（不依赖 Codex 缓存） |
| API 健康检查 | Uvicorn 监听 `127.0.0.1:8000`；`GET /healthz` 返回 `status=ok, phase=0` | 通过；验证后已停止测试进程 |
| Docling 与 MCP SDK v2 | `docling==2.138.0`、`mcp==2.3.0` 已导入；`pip check` 无损坏依赖 | 通过 |
| Python 依赖锁定 | `apps/api/requirements.lock` 记录 124 个已安装包 | 通过 |
| Docker Engine | Docker Desktop 已从 4.71.0 就地升级至 4.95.0；`docker version` 返回 Client/Server 29.8.2 | 通过 |
| PostgreSQL + pgvector | `hhba-postgres-dev` healthy；PostgreSQL 17.8；已创建并查询 `vector` 0.8.1 扩展；仅监听 `127.0.0.1:5432` | 通过 |

## 非阻塞系统维护项

| 验收项 | 状态 | 原因 |
|---|---|---|
| 系统级 Python 3.12 | 待单独维修 | 官方 3.12.10 安装器签名有效，但遗留 Windows Installer 注册事务返回 1618、1601。HHBA 不再依赖该系统注册或 Codex 缓存，因此不阻断开发。 |

## 已完成的恢复措施

Docker Desktop 4.71.0 在 Windows build 26200 上因残留 AF_UNIX socket（`dockerInference`、`engine.sock`）启动失败。未执行 Factory Reset、Docker prune、WSL unregister 或数据迁移；只在完全停止 Docker/WSL 后，将两个已审计、仅含零字节 reparse-point 的临时运行目录改名为 `*.hhba-stale-20261013`，新建空运行目录，然后就地升级官方签名的 Docker Desktop 至 4.95.0。原临时目录保留，可审计和恢复。

详细检测原始结果见 `ENVIRONMENT_AUDIT.md`，技术决策见 `TECH_STACK_DECISION.md`，上游与许可证见 `DEPENDENCY_LICENSES.md`。
