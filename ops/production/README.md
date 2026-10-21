# ops/production —— Phase 1 部署包说明

前提：本包只在本地编写与校验，**未部署到任何服务器**。上线动作见仓库根 `RISKS_AND_MANUAL.md`
中账号所有者事项（ECS、备案、域名、短信资质齐备后才可执行）。

## 文件

| 文件 | 作用 |
|---|---|
| `docker-compose.yml` | hhba-web（复用根目录 `Dockerfile.hhba` 构建）+ postgres:17 + caddy:2；健康检查、自动重启（unless-stopped）、日志轮转、命名卷持久化都在其中 |
| `Caddyfile` | HTTPS 自动证书 + 反向代理 + 转发头。选 Caddy 不选 Nginx 的理由写在 compose 文件头注释 |
| `.env.production.example` | 全部环境变量模板（仅占位符）。真实文件 `.env.production` 须 chmod 600 且禁止进 Git |
| `backup-sqlite.sh` | SQLite 一致性备份（sqlite3 `.backup` 在线备份 API + integrity_check + 行数/sha256 清单）+ public-index 打包 |
| `restore-sqlite.sh` | 恢复脚本：先验完整性、旧库改名保留、绝不删除 |

## 数据对应关系（与 Phase 0 审计一致）

| Railway 现状 | ECS 等价物 |
|---|---|
| 卷 `/sync-state`（engagement/saved/overseas-jd/public-index） | 命名卷 `hhba_sync_state` 挂到同一路径 `/sync-state` |
| `/data/hhba-translations.sqlite`（审计：不在 /sync-state 卷内） | 命名卷 `hhba_data` 挂 `/data` |
| Railway 域名 + 平台 TLS | Caddy + Let's Encrypt（卷 `hhba_caddy_data` 持久化证书） |
| 无关系型库 | 新增 postgres:17（卷 `hhba_pgdata`），供 Phase 2 账户系统 |

## 本地校验（已在本机执行，结果见交付汇报）

```bash
bash -n backup-sqlite.sh && bash -n restore-sqlite.sh
python3 -c "import yaml,sys; yaml.safe_load(open('docker-compose.yml'))"  # 无 Docker 环境时退化为 YAML 语法校验
# 有 Docker 的机器上再跑: docker compose --env-file .env.production.example -f docker-compose.yml config
```

注意：`.env.production.example` 里的占位密码仅供 `config` 解析演示，不能直接用于启动生产。

## 备份/恢复演练顺序（迁移日）

1. Railway 侧只读挂载或导出 `/sync-state` 后，在中转机跑 `backup-sqlite.sh <导出目录>`；
2. 核对 `manifest.txt`：三个业务库 integrity=ok、行数与审计基线对得上、jobs.json sha256 记录在案；
3. ECS 上 `docker compose up -d postgres caddy` 后停 web，跑 `restore-sqlite.sh <备份目录> /sync-state对应的卷内路径`；
4. 启动 hhba-web，对比 `/api/jobs/page` total、`/api/admin/growth` 的 PV/收藏与 manifest 行数。
