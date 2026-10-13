# HHBA Phase 0 项目就绪状态报告

> 供用户与 ChatGPT 审阅。评估日期：2026-10-13。
> **检测范围声明**：本轮全部检测在 Hatch 沙盒 Linux VM（Ubuntu 24.04）执行，
> **不是用户真实电脑/云电脑**。用户本机请运行 `scripts/audit.sh` 复核。

## 一、当前电脑开发环境体检结果

| 类别 | 结果摘要 |
|---|---|
| 操作系统 | Ubuntu 24.04.5 LTS，内核 7.0.0-39-generic，x86_64 |
| CPU | AMD EPYC 9D25，2 核 |
| 内存 | 7.7G 总量，**可用仅约 332M** —— 主要瓶颈 |
| 虚拟化 | KVM 客户机（full）；无 vmx/svm（无嵌套虚拟化）；WSL2 不适用 |
| 磁盘 | /home/hatch 100G（btrfs），可用 96G，充足；/tmp 512M |
| 工具链 | git 2.43.0 ✅、gh 2.102.0（未登录）、codex-cli 0.149.0 ✅、node v24.20.0 ✅、npm 10.9.4 ✅、python 3.12.3 ✅、pip 24.0 ✅、make/curl/wget ✅ |
| 缺失 | VS Code/Cursor、pnpm、uv、**Docker Engine/Compose**、psql、Java/Go/Rust |
| 端口 | 3000/8000/5432/6379/7700 均空闲 |
| 详情 | `docs/ENVIRONMENT_AUDIT.md` |

## 二、已具备的环境

- Git（2.43.0）正常；Python 3.12 venv 实测可用；Node 24 + npm 10 正常，
  满足 Vite 6（需 Node 18+）与选型要求。
- 出站经 HTTP 代理，pip/npm 安装已验证可用。
- 项目磁盘空间充足（96G）。

## 三、缺失的软件及组件

- **Docker Engine + Compose**：未安装，本沙盒无法拉起 PostgreSQL+pgvector。
- pnpm / uv：缺失，但可用 npm / venv+pip 代替，非阻塞。
- psql：缺失，可用容器内命令或驱动代替，非阻塞。
- Docling：未安装（计划内延迟，见下）。

## 四、已完成的安装与配置（全部在 `~/workspace/HHBA` 内，无全局改动）

- Python venv（`.venv`）：fastapi 0.143.0、uvicorn 0.54.0、pyyaml。
- 前端：`apps/web` npm install（63 包）＋ `vite build` 成功。
- 后端骨架：`apps/api/main.py`（/healthz）。
- 基础设施：`infra/docker-compose.yml`（pgvector/pg16，端口仅绑 127.0.0.1；
  Meilisearch CE v1.55.0 为可选 profile）＋ `infra/initdb/01-init.sql`。
- 本地 Git 仓库已初始化并提交（未推送、无远程）。
- 文档：README / .gitignore / .env.example / ENVIRONMENT_AUDIT /
  TECH_STACK_DECISION / DEPENDENCY_LICENSES / SETUP_GUIDE / PROJECT_READINESS /
  INITIAL_RISKS；可移植审计脚本 `scripts/audit.sh`。

## 五、未完成的事项及原因

1. `docker compose config` 完整解析 —— 沙盒无 Docker，YAML 语法已校验通过，
   完整解析待用户电脑装 Docker 后验证（compose 文件本身已就绪）。
2. Docling 安装 —— 计划内延迟：模型约 800MB、建议 8GB+ 内存，
   本沙盒内存不足；V0.1 在用户电脑按需接入。
3. 用户本机审计 —— 沙盒无权访问用户电脑，待用户运行 `scripts/audit.sh`。
4. GitHub 私有仓库创建与推送 —— 沙盒走官方凭证流程返回 401，
   需用户在其已登录环境操作（见第十二节）。

> 2026-10-13 更新：PostgreSQL 连接与 pgvector 扩展验证**已完成**
> （apt 安装 PG 16.2＋pgvector 0.6.0 实测：扩展加载、init SQL 执行、
> 余弦检索全通过），不再列为未完成项。

## 六、HHBA 最终采用的技术栈建议

Web：React 18 + TS + **Vite 6** ｜ API：**FastAPI**（Python 3.12）｜
DB：**PostgreSQL 16 + pgvector v0.8.7** ｜ 解析：**Docling v2.138.0**（延迟安装）｜
数据：**JSON Resume schema v1.2.1 扩展** ｜ Agent：**MCP Python SDK v2.3.0**（v2 API）｜
搜索：pgvector 先行，Meilisearch CE v1.55.0 延后到 V0.2 ｜ 容器：Docker Compose ｜
模型 API：预留配置，不锁定供应商。
不引入：K8s、微服务、Redis、SeaweedFS、复杂 Agent 编排。
**Reactive Resume v6：仅借鉴设计（数据结构/编辑器 UX），不 fork、不做底座。**
决策依据见 `docs/TECH_STACK_DECISION.md`。

## 七、项目实际创建的目录

`~/workspace/HHBA/` —— apps/{web,api}、packages/shared、infra（含 compose＋initdb）、
docs（9 篇）、scripts（含 audit.sh）、tests、references。
本地 Git 仓库（分支 main），初始提交完成，未推送。

## 八、已经成功运行的测试

| # | 验证项 | 结果 |
|---|---|---|
| 1 | Git 运行 | ✅ init＋commit 成功 |
| 2 | 前端依赖管理 | ✅ npm install（63 包） |
| 3 | 前端构建 | ✅ vite build 成功（24 模块） |
| 4 | Web dev 服务 | ✅ :3000 返回 200 |
| 5 | Python venv | ✅ 创建＋pip 安装成功 |
| 6 | API 健康检查 | ✅ /healthz 返回 ok，/docs 200 |
| 7 | .gitignore | ✅ .env 被忽略验证通过 |
| 8 | compose 解析 | ✅ `docker compose config` 真实解析通过（沙盒 dockerd＋compose 插件） |
| 9 | PG 连接 / pgvector | ✅ PG 16.2＋pgvector 0.6.0 实测：扩展＋init SQL＋余弦检索全通过 |
| 10 | 依赖版本记录 | ✅ DEPENDENCY_LICENSES.md |
| 11 | 不影响原有项目 | ✅ 仅 HHBA 目录；HAAM/旧仓库未动 |
| 12 | SETUP_GUIDE 可重跑 | ✅ 沙盒内除 Docker 部分外均已重跑验证；PG 部分改为 apt 方案验证通过 |

## 九、需要用户授权的操作

1. **在其电脑安装 Docker Engine + Compose**（需管理员权限，约数百 MB 下载）——
   然后按 SETUP_GUIDE 第 4 步拉起 PG 验证。
2. **创建 GitHub 私有仓库并推送**（或明确暂不建远程）——Phase 0 默认不推送。
3. `gh auth login`（如需用 gh 操作远程）——可选。
4. 后续如需：pnpm/uv 安装（可选）、Docling 模型下载（V0.1 时，约 800MB＋）。

## 十、预计的资源占用与启动成本

- 本地：1 个 PG 容器（约 200–400MB 内存）＋ API/前端 dev（各约 100–300MB）。
  用户电脑建议空闲内存 ≥2G（Docling 接入后 ≥8G）。
- 磁盘：项目＋依赖约 1–2G；Docling 模型另加约 3–10G（V0.1 时）。
- 启动成本：`docker compose up -d`＋两个 dev 命令，约 1 分钟。

## 十一、当前存在的技术和安全风险

见 `docs/INITIAL_RISKS.md`（R1–R10）。最高两项：
R1 审计范围≠用户本机（高）；R10 需求侧冷启动（产品层，高）。
许可证层面：5 项直接使用的依赖全为宽松许可，无 GPL/AGPL；
Meilisearch 只用 CE（MIT），OpenCATS 不采用。

## 十二、是否达到"可以正式开始开发"的条件

**结论：PARTIAL（部分完成，存在待解决问题）。**

- ✅ 已完成：环境审计、依赖复核、技术选型、工作区＋文档、venv/npm/compose 配置、
  前后端骨架验证、Git 与密钥隔离验证、**PostgreSQL＋pgvector 实测验证**。
- ⏳ 待用户动作（沙盒物理上够不着）：本机 Docker 安装、`scripts/audit.sh` 本机复核、
  GitHub 私有仓创建与推送（沙盒凭证 401，需用户已登录环境操作）。
- ⏸️ 计划内延后：Docling（V0.1 按需接入）。
- ❌ 不存在 BLOCKED 级问题：未发现阻止 V0.1 立项的技术障碍。

> 2026-10-13 追加验证后：12 项验收中 11 项 ✅、1 项 ⚠️（容器实际运行需用户本机 Docker，
> 沙盒内核禁止创建网络命名空间，见 docs/ENVIRONMENT_AUDIT.md §D）。
> 用户在其电脑装好 Docker 并跑通 `docker compose up -d postgres` 即达 READY。

**下一步建议**：用户在自己电脑完成第九节第 1 项后，本报告即达 READY；
随后另行制定 HHBA V0.1 的产品目标、开发范围、任务拆解、验收标准与里程碑。
