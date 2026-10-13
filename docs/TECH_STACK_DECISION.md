# HHBA 最小技术环境决策

## 决策

采用**模块化单体**，而非微服务：React + TypeScript + Vite 前端，Python 3.12 + FastAPI API，PostgreSQL 17 + pgvector，Docker Compose 仅提供本地数据库。简历规范采用 JSON Resume 为输入/导出互操作层，HHBA 能力模型为受版本控制的扩展 Schema。Agent 接口在授权模型稳定后使用官方 MCP Python SDK v2。模型供应商仅通过配置接口接入。

不在 Phase 0 启动 Meilisearch、Docling 或 MCP 服务；它们是有明确触发条件的可选组件，而非基础依赖。

## 选型理由

| 领域 | 选择 | 原因 |
|---|---|---|
| Web | React + TypeScript + Vite | 人才端、企业端共用组件和类型；启动/构建简单，适合独立 API 后端 |
| Next.js | 暂不采用 | SSR、BFF 和复杂路由尚无已验证需求；会与 FastAPI 形成两套服务端边界 |
| API | FastAPI | 与 Docling、MCP Python SDK 和 AI 解析同语言；类型/OpenAPI/健康检查成本低 |
| Python | 3.12 | 项目锁定版本，兼顾当前生态与依赖兼容性 |
| 数据库 | PostgreSQL 17 + pgvector 0.8.1 | 关系数据、授权边界与向量检索可先集中维护 |
| 搜索 | 先 PostgreSQL（含 pgvector） | Phase 0/V0.1 不预先增加 Meilisearch 的同步、权限过滤与运维面；未来由负载证据决定 |
| 解析 | Docling（延后安装） | 用于受控简历文件解析；先用小样本基准确认资源、质量与许可证风险 |
| 数据格式 | JSON Resume 扩展 | 保留互操作性；能力、授权、可见范围应为 `hhba` 命名空间扩展而非污染核心字段 |
| Agent | MCP Python SDK v2 | 官方 SDK 目前发布 v2.3.0；只采用 v2 文档与示例，不沿用 v1 API |
| 容器 | Docker Compose | 本地单机隔离，数据库端口绑定 `127.0.0.1`，无自动重启 |

## Reactive Resume：借鉴而非基座

当前上游为 v6.0.2，Node `24.x`、pnpm `12.11.2`，MIT。建议仅借鉴其简历编辑交互、模板思路和结构化简历处理经验，不将其仓库作为 HHBA 产品基座。

| 维度 | 基于 Reactive Resume 二开 | 独立最小模块化单体（建议） |
|---|---|---|
| 开发复杂度 | 初期编辑器较快，但需理解大型既有系统 | 初期需搭编辑器，但边界清晰 |
| 功能复用 | 简历编辑/模板可复用 | 仅复用开放标准与设计经验 |
| 二开难度 | 高：升级节奏、Node/pnpm 固定要求和既有模型约束 | 中：只维护实际需要模块 |
| 数据库/API 扩展 | 高风险：能力图谱、授权、企业搜索、Agent 入口需横切改造 | 低至中：从领域模型和 API 契约开始设计 |
| 本机要求 | Node 24 + pnpm 12 和完整上游栈 | Node 24 + Python 3.12 + 单一数据库 |
| 长期维护 | 上游兼容、合并与安全更新成本较高 | 组件少、升级面小 |

## 延后项与触发条件

* Meilisearch：当 PostgreSQL 全文/向量搜索经真实匿名样本证明无法满足响应和召回目标时。
* Docling：Python 3.12 就绪后，创建隔离 venv，并以非真实简历小样本测试磁盘、内存与解析质量。
* MCP Server：授权模型、审计日志、速率限制和联系申请工作流完成设计后。
* Kubernetes、微服务、云资源、复杂 Agent 编排：当前不需要。
