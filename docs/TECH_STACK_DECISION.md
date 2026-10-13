# HHBA 技术选型决策（Phase 0 · 阶段 C）

> 原则：**满足需求的最小可行架构**。不为技术先进引入不必要组件。
> 暂不需要：Kubernetes、微服务集群、云电脑、复杂 Agent 编排。
> 依赖事实依据见 `docs/DEPENDENCY_LICENSES.md`，环境约束见 `docs/ENVIRONMENT_AUDIT.md`。

## 一、最终技术栈

| 层 | 选型 | 锁定版本/说明 |
|---|---|---|
| Web 前端 | React 18 + TypeScript + **Vite 6** | SPA；Node 18+ 即可 |
| API 后端 | **FastAPI**（Python 3.12） | 自动 OpenAPI 文档，async |
| 数据库 | **PostgreSQL 16 + pgvector v0.8.7** | 业务数据＋向量检索同一库 |
| 文件解析 | **Docling v2.138.0** | MIT；延迟到 V0.1 按需安装（模型约 800MB，需 8GB+ 内存） |
| 数据格式 | **JSON Resume schema v1.2.1 扩展** | 扩展字段 HHBA 自行定义（能力标签/公开范围/验证状态） |
| Agent 接口 | **官方 MCP Python SDK v2.3.0** | `mcp.server.MCPServer` API；Streamable HTTP 传输 |
| 搜索（V0.1） | pgvector（向量＋基础全文） | Meilisearch CE v1.55.0 延后到 V0.2，按需引入 |
| 容器 | Docker Compose | 端口仅绑 127.0.0.1；不设自启 |
| 版本管理 | Git（本地仓库优先，远程用私有仓） | 本阶段不推送 |
| 测试 | pytest（后端）+ vite build（前端）+ /healthz | Phase 0 只做健康检查级验证 |
| AI 模型 | 预留可配置 `MODEL_API_BASE/KEY/NAME` | **不锁定供应商** |

## 二、关键对比决策

### 1. Web：Vite vs Next.js → 选 Vite
| 维度 | Vite（SPA） | Next.js（SSR） |
|---|---|---|
| 复杂度 | 低，纯静态构建 | 高，需 Node 服务端 |
| 开发/构建速度 | 快 | 较慢 |
| SEO（可分享的能力名片） | 需额外预渲染处理 | SSR 原生友好 |
| 资源占用 | 低 | 高 |
| 与 FastAPI 后端的关系 | 前后端分离，清晰 | 双服务端（Next+FastAPI），运维面翻倍 |

**决策理由**：Phase 0/V0.1 阶段团队小、求快，Vite 的简单与低运维成本压倒一切；
分享卡片的 SEO 可用预渲染/OG 静态页过渡。若公开展示页的搜索流量成为瓶颈，
V0.2 再评估 Next.js 或独立 SSR 方案。

### 2. API：FastAPI vs TypeScript（Express/NestJS）→ 选 FastAPI
| 维度 | FastAPI（Python 3.12） | TypeScript API |
|---|---|---|
| AI/文档生态 | Docling、MCP Python SDK、embeddings 全是 Python 原生，**零跨语言成本** | 需跨语言调用 Python 组件，多一层复杂度 |
| 接口文档 | 自动 OpenAPI/Swagger | 需手写或额外工具 |
| 与前端语言一致性 | 不一致 | 一致（TS 全栈） |
| 性能 | async 足够应对 V0.1 量级 | 相当 |

**决策理由**：HHBA 的核心差异化（简历解析、向量检索、MCP 接入）全在 Python 生态，
选 FastAPI 是跟随依赖走，不是语言偏好。TS 全栈的一致性收益抵不过跨语言调用成本。

### 3. 搜索：pgvector 先行，Meilisearch CE 延后
- pgvector：向量相似度是强项；与业务数据同库，ACID/备份/JOIN 现成；V0.1 的
  "自然语言搜人才"可用向量检索＋PG 全文（tsvector）覆盖。
- Meilisearch CE：拼写纠错、即时搜索、分面过滤是强项，但它是独立服务，多一套运维面。
- **决策**：Phase 0 只准备 pgvector；等企业端搜索体验成为瓶颈时再引入
  Meilisearch CE（MIT 部分商用无碍）。**永远不用 EE（BUSL-1.1）**。

## 三、专项：基于 Reactive Resume 二次开发 vs 仅借鉴 → 仅借鉴

核查事实：Reactive Resume 当前为 **v6.0.2**（2026-10-09），MIT 许可；
要求 **Node 24.x**，官方 compose 自带 postgres＋redis＋seaweedfs＋应用本体 4 服务；
是"单体应用＋外部数据服务"形态，非微服务。

| 对比维度 | 基于 v6 二次开发（fork） | 仅借鉴设计 |
|---|---|---|
| 1. 开发复杂度 | 高：继承整套 infra（Node24/PG/Redis/SeaweedFS＋pnpm/turbo monorepo） | 低：只参考数据结构与编辑器交互 |
| 2. 现有功能复用率 | 低（约 20–30%）：v6 是"简历制作/打印"产品，HHBA 要的是能力搜索/名片分享/企业端/MCP，用户系统与模板打印与 HHBA 无关 | 按需取用，无负担 |
| 3. 二次开发难度 | 高：v6 刚发布 4 天仍在快速迭代，fork 后跟进上游成本高；其前后端同容器与 HHBA 的 FastAPI 架构冲突 | 无 |
| 4. 数据库与接口扩展 | 难：v6 的 Prisma schema 为简历产品设计，改造成"能力档案＋可见性控制＋企业搜索"需大改 | 自建模型，按 JSON Resume 扩展，干净 |
| 5. 对电脑配置要求 | 高：本地开发要起 4 个服务 | 低：最小栈只需 1 个 PG 容器 |
| 6. 长期维护成本 | 高：背上游更新＋安全补丁责任 | 零 |

**决策**：**不 fork、不做底座**。借鉴点限定为：简历数据结构、编辑器 UX、
JSON Resume 兼容思路。参考版本锁定 v6.0.2（tag）。

## 四、目录结构（已按本决策落地）

```
apps/web/        # Vite + React + TS（Phase 0：最小骨架，可构建）
apps/api/        # FastAPI（Phase 0：/healthz 健康检查）
packages/shared/ # 预留：JSON Resume 扩展 schema（V0.1 定义）
infra/           # docker-compose.yml（pgvector/pg16＋可选 meilisearch CE）
docs/ scripts/ tests/ references/
```

## 五、 deliberately 不引入的组件

Kubernetes、微服务拆分、Redis（v6 的队列在 HHBA V0.1 用不上）、
SeaweedFS/S3（附件存储 V0.1 用本地盘即可）、复杂 Agent 编排框架。
