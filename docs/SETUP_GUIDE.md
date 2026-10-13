# HHBA 本地启动指南

## 前置条件

1. Git 2.55+、Node 22–24 已具备。
2. 本项目已内置受忽略的 `.tooling/python312`（Python 3.12.14）及 `apps/api/.venv`；无需系统 PATH 中的 Python 才能运行 HHBA。
3. Docker Desktop 4.95.0 与 Docker Engine 29.8.2 已验证。数据库端口只绑定本机回环地址。

## 仅在本仓库内的初始化

从仓库根目录复制安全占位配置：

```powershell
Copy-Item .env.example .env
```

将 `.env` 中的 `POSTGRES_PASSWORD` 替换成仅本地使用的强密码；不要将 `.env` 提交。不要在聊天、日志或截图中输出该值。

安装 Web 依赖并启动：

```powershell
Set-Location apps/web
npm install
npm run dev
```

访问 `http://127.0.0.1:3000`。此页面仅用于环境验收。

当前工作区已创建 `apps/api/.venv`，基于 `HHBA/.tooling/python312` 内的 Python 3.12.14。可直接使用此环境并启动：

```powershell
Set-Location apps/api
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

访问 `http://127.0.0.1:8000/healthz`，预期 `{"status":"ok","phase":"0"}`。

启动本地数据库（先确认 Docker Engine 正常）：

```powershell
docker compose --env-file .env -f infra/compose.yaml config
docker compose --env-file .env -f infra/compose.yaml up -d postgres
docker compose --env-file .env -f infra/compose.yaml exec postgres psql -U hhba_app -d hhba_dev -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extversion FROM pg_extension WHERE extname = 'vector';"
```

停止但保留本地测试数据：`docker compose --env-file .env -f infra/compose.yaml stop`。不要运行带 `-v` 的删除命令，除非明确要删除 `hhba_postgres_data` 测试数据。

## Docling 与 MCP

Docling 2.138.0 和 MCP Python SDK 2.3.0 已安装并导入验证。Docling 依赖（含 PyTorch/OpenCV 等）使 `apps/api/.venv` 约 1.31 GiB；模型权重仍按首次实际解析按需下载。不要用真实简历作为首次解析测试材料。若需重建虚拟环境，运行 `..\.tooling\python312\python.exe -m venv .venv`。
