# HHBA 开源依赖选型与许可证审计（Phase 0 · 阶段 B）

> 核查时间：2026-10-13｜方式：GitHub REST API（未认证）+ LICENSE 原文查验
> 原始调研记录：`references/dependency-review-raw.md`
> 原则：未 clone 整仓、未下载大体积资源；凡"未确认"如实标注，不编造版本。

## 结论总览

| 仓库 | 最新稳定版 | 许可证 | 结论 | 商业化要点 |
|---|---|---|---|---|
| docling-project/docling | v2.138.0（2026-10-12） | MIT | ✅ 直接使用 | 无限制；模型约 800MB，内存建议 8GB+，可延迟安装 |
| pgvector/pgvector | v0.8.7（tag，2026-10） | PostgreSQL License | ✅ 直接使用 | 宽松许可无限制；支持 PG 13+ |
| meilisearch/meilisearch | v1.55.0（2026-10-12） | MIT **AND** BUSL-1.1（双许可） | ✅ 直接使用（**仅社区版 CE**） | CE 的 MIT 部分商用无限制；**严禁使用 EE（BUSL-1.1 不可免费生产使用）** |
| jsonresume/jsonresume.org | schema v1.2.1（2024-08-06） | MIT | ✅ 直接使用（格式层） | 无限制；schema 演进慢，扩展字段 HHBA 自行定义 |
| modelcontextprotocol/python-sdk | v2.3.0（2026-10-02） | MIT | ✅ 直接使用 | 无限制；**必须用 v2 API（`mcp.server.MCPServer`），禁用 v1 示例** |
| reactive-resume/reactive-resume | v6.0.2（2026-10-09） | MIT | ⚠️ 仅供参考 | MIT 无限制；但 v6 需 Node 24 + PG + Redis + SeaweedFS，**不做 HHBA 底座** |
| opencats/OpenCATS | v0.11.1（2026-09-03） | MPL-2.0 + CATS-PL-1.1a（弱 copyleft，文件级） | ❌ 不采用 | legacy PHP/Smarty，产品方向不对口；不引入，无需合规处理 |

**合规总评**：拟直接使用的 5 项全部为宽松许可（MIT / PostgreSQL License），
无 GPL/AGPL 强 copyleft 组件。HHBA 闭源商用只需保留各项目的版权声明与许可证文本。
两个"坑"已标出并规避：Meilisearch EE（BUSL-1.1）、OpenCATS（弱 copyleft 且不采用）。

## 专项核查结论

### 1. Reactive Resume v6 —— 不做底座，仅借鉴
- 当前大版本确为 **v6**（v6.0.2，2026-10-09 发布，4 天前），不是 v5。
- v6 架构：pnpm + turbo monorepo，`apps/server` + `apps/web`；**Node.js 要求 24.x**
 （`.nvmrc`=24，`engines.node`=24.x）；官方 compose 自带 4 服务：
  postgres、redis、seaweedfs（S3 兼容对象存储）、应用本体（:3000）。
- 是"单体应用 + 外部数据服务"形态，非微服务。
- 判定"仅供参考"的理由：v6 是一套完整产品（用户系统/模板/打印/S3/队列全耦合），
  fork 等于继承整套 infra 负担；且 v6 刚发布仍在快速迭代，fork 后跟进上游成本高。
  借鉴点：简历数据结构、编辑器交互设计、JSON Resume 兼容思路。

### 2. MCP Python SDK v2 —— 必须用 v2 API
- 当前主线为 **v2**（v2.3.0，2026-10-02），官方提供 v1→v2 迁移指南（有破坏性变更）。
- v2 要点：统一入口 `mcp.server.MCPServer`（v1 的 `FastMCP` 已被取代）；
  传输层推荐 **Streamable HTTP**（取代 v1 的 SSE 主力地位），另支持 stdio/SSE；
  Python 要求 3.11+（与 HHBA 的 Python 3.12 兼容）。
- 安装：`pip install "mcp[cli]"`。所有新代码按 v2 示例写，禁止复制 v1 旧示例。

### 3. 许可证风险点
- **Meilisearch 双许可**：自 v1.19（2025-08）起为 MIT AND BUSL-1.1。
  社区版 CE（核心全文检索 + AI/混合检索）是 MIT，可商用；
  企业版 EE（分片/复制/细粒度访问控制等）为 BUSL-1.1，生产使用需商业协议。
  **规避措施**：只用 `getmeili/meilisearch` CE 镜像，绝不拉 `meilisearch-enterprise`。
- **OpenCATS**：MPL-2.0 + CATS-PL-1.1a，弱 copyleft（文件级），允许商业闭源使用
  但修改过的受覆盖文件须开源。**HHBA 不采用，不产生合规义务**。
- GitHub API 对 pgvector / meilisearch / OpenCATS 的 license 字段返回
  NOASSERTION/Other，本次均以 LICENSE 原文为准确认。

## 固定版本记录（V0.1 依赖锁定依据）

| 组件 | 锁定版本 | 来源地址 | 许可证文本位置 |
|---|---|---|---|
| docling | 2.138.0 | https://github.com/docling-project/docling | 仓库根 LICENSE（MIT） |
| pgvector | v0.8.7（tag） | https://github.com/pgvector/pgvector | 仓库根 LICENSE（PostgreSQL License） |
| meilisearch（CE） | v1.55.0 | https://github.com/meilisearch/meilisearch | 仓库根 LICENSE（MIT AND BUSL-1.1） |
| JSON Resume schema | v1.2.1（npm `@jsonresume/schema`） | https://github.com/jsonresume/jsonresume.org | 仓库根 LICENSE（MIT） |
| mcp（Python SDK） | v2.3.0 | https://github.com/modelcontextprotocol/python-sdk | 仓库根 LICENSE（MIT） |
| reactive-resume（参考） | v6.0.2（tag，仅设计参考，不引入依赖） | https://github.com/reactive-resume/reactive-resume | 仓库根 LICENSE（MIT） |
| OpenCATS | 不采用 | https://github.com/opencats/OpenCATS | — |

> 注：以上为 2026-10-13 核查时的最新稳定版。V0.1 立项时若已发布新版，
> 按"锁定版本优先、有安全补丁则评估升级"处理，并更新本表。
