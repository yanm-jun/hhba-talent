# HHBA 本地启动指南（Phase 0）

> 适用：开发者本机（Windows / macOS / Linux）。本指南假设你已按
> `docs/TECH_STACK_DECISION.md` 确认技术栈。
> 在自己电脑上先跑一遍 `bash scripts/audit.sh` 确认环境。

## 0. 前置要求

| 组件 | 要求版本 | 说明 |
|---|---|---|
| Git | 2.30+ | — |
| Python | 3.12.x | `python3 --version` 确认 |
| Node.js | 18+（推荐 20 LTS） | Vite 6 需要 |
| npm | 9+ | 或 pnpm（可选） |
| Docker Engine + Compose | 24+ / v2 | 用于本地 PostgreSQL + pgvector；**需管理员权限安装，安装前请确认** |

## 1. 进入项目并配置环境变量

```bash
cd HHBA
cp .env.example .env
# 用编辑器打开 .env，把 CHANGE_ME 换成你自己的本地测试值
# 注意：.env 已被 .gitignore 忽略，绝不提交
```

## 2. 后端 API（FastAPI）

```bash
cd HHBA
python3 -m venv .venv
# Windows: .venv\Scripts\activate ｜ macOS/Linux: source .venv/bin/activate
.venv/bin/pip install fastapi "uvicorn[standard]" asyncpg
.venv/bin/uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
# 验证：curl http://127.0.0.1:8000/healthz  应返回 {"status":"ok",...}
# 文档：http://127.0.0.1:8000/docs
```

## 3. 前端 Web（React + Vite）

```bash
cd HHBA/apps/web
npm install
npm run dev      # http://127.0.0.1:3000
npm run build    # 产物在 dist/（已忽略，不提交）
```

## 4. 数据库（PostgreSQL + pgvector，Docker）

```bash
cd HHBA/infra
docker compose up -d postgres
# 验证扩展：
docker exec hhba-postgres psql -U hhba -d hhba_dev -c "SELECT * FROM pg_extension WHERE extname='vector';"
# 应看到 vector 扩展行；初始化脚本已建 capability_profiles_phase0 占位表
```

Meilisearch 为 V0.2 可选项，Phase 0 不启动：
```bash
docker compose --profile search up -d   # 需要时再开
```

## 5. 停止与清理（测试数据，可随时重建）

```bash
cd HHBA/infra
docker compose down          # 停容器，保留数据卷
docker compose down -v        # 连数据卷一起删（测试库重建用）
```

## 6. 常见问题

- **pip/npm 下载慢或失败**：检查是否需要配置代理；公司网/特殊网络下给 pip 配
  `PIP_INDEX_URL` 镜像源（只改本机 pip 配置，不改项目）。
- **端口被占**：8000（API）/3000（Web）/5432（PG）/7700（Meili），用
  `scripts/audit.sh` 的端口段自查。
- **Docling 装不上/跑不动**：正常。Docling 体积大、吃内存，Phase 0 只做评估，
  V0.1 按需接入，见 `docs/TECH_STACK_DECISION.md`。
- **Windows 用户**：Docker Desktop 需要 WSL2；Python 请用官网 3.12 安装包，
  安装时勾选 "Add to PATH"。
