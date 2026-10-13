# HHBA 开源依赖复核 — 原始调研结果

- 查询时间：2026-10-13（北京时间）
- 查询方式：GitHub REST API（api.github.com，未认证，`repos/{owner}/{repo}` 基本信息 + `releases/latest` + `tags` + LICENSE 文件原文），辅以公开网页检索补充资源需求信息
- 说明：未 clone 任何仓库、未下载大文件、未输出任何密钥。凡写"未确认"即当时未能查证，绝不编造。

---

## 1. reactive-resume / reactive-resume

- 仓库：https://github.com/reactive-resume/reactive-resume
- 默认分支：`main`
- 最新稳定 release：**v6.0.2**（发布于 2026-10-09）——当前大版本是 **v6**，不是 v5
- 许可证：**MIT**（SPDX: MIT，全称 MIT License，非 copyleft/无传染性）
- 最近一次 commit：2026-10-12（push 时间 2026-10-12T11:06:07Z）
- 维护活跃度：极高。stars 约 44,220；release 刚发布 4 天（v6.0.2），仍在快速迭代
- 技术架构（v6，来自仓库根目录与 compose.yml 实测）：
  - monorepo：pnpm workspace + turbo；`apps/server` + `apps/web` 两个应用
  - **Node.js 版本要求：24.x**（`.nvmrc` = `24`，package.json `engines.node = 24.x`，packageManager pnpm@12.11.2）
  - compose.yml 自带 4 个服务：`postgres`（数据库）、`redis`（缓存/队列，备注"包含 agent stream 数据"）、`seaweedfs`（S3 兼容对象存储，用于简历附件）、`reactive_resume`（应用本体，端口 3000，health check 打 `/api/health`）
  - 是"单体应用 + 外部数据服务"形态（前后端同仓、构建为一个容器），不是微服务集群
- 结论：**仅供参考** —— v6 是一套完整产品（用户系统/模板/打印/S3 存储/redis 队列全耦合），fork 二次开发等于继承它整套 infra 负担（Node 24 + postgres + redis + seaweedfs）；HHBA Phase 0 只做环境准备，v6 的简历数据结构与编辑器交互设计值得借鉴，但不应直接作为 HHBA 底座。
- 商业化限制：MIT，无限制；商用闭源分发只需保留版权声明。

## 2. docling-project / docling

- 仓库：https://github.com/docling-project/docling
- 默认分支：`main`
- 最新稳定 release：**v2.138.0**（发布于 2026-10-12）
- 许可证：**MIT**（SPDX: MIT，全称 MIT License，非 copyleft/无传染性）
- 最近一次 commit：2026-10-13（push 时间 2026-10-13T08:43:24Z，当天）
- 维护活跃度：极高。stars 约 68,798；版本号已到 v2.138，几乎每天都有更新
- Python 版本要求：`requires-python = >=3.10,<4.0`（pyproject.toml 实测）——**支持 Python 3.12** ✓
- 运行资源需求（第三方社区实测，非官方口径，来源见下）：
  - 模型：Layout-Heron 约 500MB + TableFormer 约 300MB，合计约 800MB，首次运行自动从 HuggingFace 下载并本地缓存
  - 内存：CPU 推理最低约 2GB 空闲 RAM，社区普遍建议 8GB+（来源：hwdsl2/docker-docling README；bhuvve/docling_pdf README）
  - 磁盘：依赖 + 模型约 3~10GB（来源同上）
  - GPU 可选（CUDA/MPS 加速，无 GPU 也可跑 CPU 模式，只是慢）
- 结论：**直接使用** —— MIT 许可、与 Python 3.12 兼容、社区生态成熟；作为 HHBA 简历/文档解析组件合适，但模型首次下载需预留磁盘与带宽，Phase 0 可先延迟安装（Docling 允许延迟接入）。
- 商业化限制：MIT，无限制。

## 3. pgvector / pgvector

- 仓库：https://github.com/pgvector/pgvector
- 默认分支：`master`
- 最新版本：**tag v0.8.7**（该仓库不用 GitHub Releases，用 git tag；tags API 取到的最新 5 个为 v0.8.3~v0.8.7）
- 许可证：**PostgreSQL License**（LICENSE 文件原文实测：基于 UC  Regents 许可文本的宽松许可；SPDX: PostgreSQL，**非 copyleft/无传染性**。注：GitHub API 的 license 字段返回 NOASSERTION/Other，需读 LICENSE 原文才能确认）
- 最近一次 commit：2026-10-08（push 时间 2026-10-08T04:39:04Z）
- 维护活跃度：高。stars 约 23,331；近期持续有 tag 发布
- PostgreSQL 版本支持：README 明确 "**supports Postgres 13+**"（Linux/Mac 源码编译安装说明）
- 结论：**直接使用** —— 宽松许可、与 PostgreSQL 同生态、把向量和业务数据放同一库，ACID/备份/JOIN 全是现成的；是 HHBA 人才能力向量检索的首选。
- 商业化限制：PostgreSQL License，商用无限制，只需保留版权声明。

## 4. meilisearch / meilisearch

- 仓库：https://github.com/meilisearch/meilisearch
- 默认分支：`main`
- 最新稳定 release：**v1.55.0**（发布于 2026-10-12）
- 许可证：**双许可 MIT AND BUSL-1.1**（LICENSE 文件原文实测，SPDX 标识即文件内声明）：
  - 社区版（CE，核心全文检索 + AI/混合检索）：**MIT**，宽松许可
  - 企业版（EE：分片/复制、分析、细粒度访问控制、高级可观测性等）：**Business Source License 1.1**，源码可见但**不可免费用于生产**，需商业协议
  - 注：双许可制始于 v1.19（2025 年 8 月）；GitHub API license 字段返回 NOASSERTION/Other，需读 LICENSE 原文
- 最近一次 commit：2026-10-13（push 时间 2026-10-13T08:46:22Z，当天）
- 维护活跃度：极高。stars 约 59,557；版本迭代快
- 资源需求：Rust 单二进制，无重型依赖；单节点运行内存占用小（官方定位轻量）；本地可完全自托管免费使用 CE
- 与 pgvector 全文检索的取舍：
  - pgvector：向量相似度检索是强项；全文检索需配合 `tsvector`/BM25，拼写纠错、分面搜索等能力弱
  - meilisearch CE：拼写纠错、即时搜索体验、分面过滤是强项，且 CE 已包含 AI/混合检索；但它是独立服务，多一套运维面
  - HHBA 建议：Phase 0 先用 **pgvector 一库搞定**（向量+基础全文），等企业端"自然语言搜人才"的搜索体验成为瓶颈时再引入 meilisearch CE（MIT 部分商用无碍）；不要一开始就双搜索引擎
- 结论：**直接使用（社区版）** —— MIT 部分覆盖 HHBA 全部搜索需求；**避开 EE 二进制**（`meilisearch-enterprise` 前缀的包与 `getmeili/meilisearch-enterprise` 镜像），以免触发 BUSL 生产使用限制。
- 商业化限制：CE（MIT）商用无限制；EE（BUSL-1.1）生产使用需购买商业许可。

## 5. jsonresume / jsonresume.org

- 仓库：https://github.com/jsonresume/jsonresume.org（官网+工具链 monorepo；schema 已从独立仓库搬入）
- 默认分支：`master`
- 最新 release：**resume-cli@3.7.3**（发布于 2026-09-09；该仓库用按包 tag 的发布方式）
- 许可证：**MIT**（SPDX: MIT，非 copyleft/无传染性）
- 最近一次 commit：2026-09-09（push 时间 2026-09-09T17:43:35Z）
- schema 现状：原 `jsonresume/resume-schema` 仓库已迁移说明"MOVED to jsonresume/jsonresume.org (packages/schema)"，npm 包 `@jsonresume/schema` 不变；schema 最新 release 为 **v1.2.1（2024-08-06）**——schema 本体两年多未发新版，处于稳定/缓慢演进状态
- 维护活跃度：中低。jsonresume.org 本体 stars 仅约 328（注意：这是官网仓库；生态知名度主要在旧 schema 仓库，约 2,387 stars）
- 结论：**直接使用（数据格式层面）** —— JSON Resume schema 是事实上的简历结构化数据标准，HHBA"个人 AI 能力名片"的数据模型可以直接扩展它（加 `skills`/`aiProfile` 等自定义段），生态工具（resume-cli、主题）可复用；但不要指望 schema 快速跟进 AI 能力描述的新字段，扩展部分 HHBA 自己定义。
- 商业化限制：MIT，无限制。

## 6. modelcontextprotocol / python-sdk

- 仓库：https://github.com/modelcontextprotocol/python-sdk
- 默认分支：`main`
- 最新稳定 release：**v2.3.0**（发布于 2026-10-02）——当前是 **v2**，不是 v1
- 许可证：**MIT**（SPDX: MIT，全称 MIT License，非 copyleft/无传染性）
- 最近一次 commit：2026-10-13（push 时间 2026-10-13T10:21:52Z，当天）
- 维护活跃度：极高。stars 约 24,560；官方维护
- v2 与 v1 的 API 差异要点（来自 v2 README 实测 + 官方文档结构）：
  - v2 统一入口为 **`mcp.server.MCPServer`**（README 的 15 行示例即用 `MCPServer("Demo")` + `@mcp.tool()` / `@mcp.resource("greeting://{name}")` 装饰器）；v1 的 `FastMCP` 已被取代
  - 传输层：stdio、**Streamable HTTP**、SSE（Streamable HTTP 是当前推荐的远程传输，取代 v1 时代的 SSE 主力地位）
  - Python 版本要求：**3.11+**（与 HHBA 选定的 Python 3.12 兼容 ✓）
  - 官方提供 "What's new in v2" 与 **migration guide**（v1→v2 迁移指南），说明存在破坏性变更，**不要再抄 v1 的示例代码**
  - v2 官方示例（来自 README，当前有效）：
    ```python
    from mcp.server import MCPServer

    mcp = MCPServer("Demo")

    @mcp.tool()
    def add(a: int, b: int) -> int:
        """Add two numbers."""
        return a + b

    @mcp.resource("greeting://{name}")
    def greeting(name: str) -> str:
        """Greet someone by name."""
        return f"Hello, {name}!"
    ```
    安装：`pip install "mcp[cli]"`（或 `uv add`）
- 结论：**直接使用** —— HHBA"第三方 Agent 接入端"的官方标准实现，MIT 许可，v2 是当前主线；所有新代码按 v2 API 写。
- 商业化限制：MIT，无限制。

## 7. opencats / OpenCATS

- 仓库：https://github.com/opencats/OpenCATS
- 默认分支：`master`
- 最新稳定 release：**v0.11.1**（发布于 2026-09-03，名为 "OpenCATS v0.11.1"）
- 许可证：**双许可（均为弱 copyleft，文件级）**（LICENSE.md 原文实测，约 43KB；GitHub API license 字段返回 NOASSERTION/Other）：
  - OpenCATS 自有代码：**Mozilla Public License 2.0**（SPDX: MPL-2.0）
  - 2007 年继承自 CATS Project 的原始代码：**CATS Public License Version 1.1a**（修改版 MPL）
  - copyleft 性质：**弱 copyleft / 文件级传染**——修改了 MPL/CPL 覆盖的文件需开源该文件，但与之链接的自有闭源文件可以保持闭源；**不是 GPL 式的强传染**
- 最近一次 commit：2026-10-12（push 时间 2026-10-12T14:37:46Z）
- 维护活跃度：中低。stars 约 760；虽有近期 commit，但 release 停留在 9 月，社区规模小
- 技术栈（languages API 实测）：**PHP 为主 + Smarty 模板**，典型的 2000 年代 legacy ATS（招聘跟踪系统）架构
- 结论：**不采用** —— 三个理由：① 技术栈是 legacy PHP/Smarty，与 HHBA 拟定的 React+TS/Python 栈完全脱节；② 它是"招聘流程管理"（ATS），不是 HHBA 要做的"人类能力搜索/能力名片"，产品方向不对口；③ 双弱-copyleft 许可虽允许商用，但文件级开源义务会给闭源商用带来合规梳理成本，收益为零。
- 商业化限制：MPL-2.0/CPL-1.1a 允许商业闭源使用，但动过的受覆盖文件必须保持开源；**HHBA 不采用，无需处理**。

---

## 汇总表

| 仓库 | 最新版 | 许可证 | copyleft | 结论 | 商业化要点 |
|---|---|---|---|---|---|
| reactive-resume | v6.0.2 (2026-10-09) | MIT | 否 | 仅供参考 | MIT 无限制；但 v6 需 Node 24 + pg + redis + seaweedfs，不宜做底座 |
| docling | v2.138.0 (2026-10-12) | MIT | 否 | 直接使用 | MIT 无限制；模型约 800MB，建议 8GB+ 内存，可延迟安装 |
| pgvector | v0.8.7 (tag) | PostgreSQL License | 否 | 直接使用 | 宽松许可无限制；支持 PG 13+ |
| meilisearch | v1.55.0 (2026-10-12) | MIT AND BUSL-1.1 | 否（CE） | 直接使用（仅社区版） | CE 的 MIT 部分商用无限制；**勿用 EE（BUSL-1.1）** |
| jsonresume.org | resume-cli@3.7.3；schema v1.2.1 (2024-08-06) | MIT | 否 | 直接使用（格式层） | MIT 无限制；schema 扩展字段 HHBA 自行定义 |
| mcp python-sdk | v2.3.0 (2026-10-02) | MIT | 否 | 直接使用 | MIT 无限制；按 v2 API（MCPServer）开发 |
| OpenCATS | v0.11.1 (2026-09-03) | MPL-2.0 + CATS-PL-1.1a | 弱（文件级） | 不采用 | 允许商用但 HHBA 不采用，无需处理 |

## 固定版本建议（供 docs/DEPENDENCY_LICENSES.md 记录）

- reactive-resume：参考设计时锁定 `v6.0.2`（commit 以 tag 为准）；不引入为依赖
- docling：`2.138.0`（Python >=3.10,<4.0，兼容 3.12）
- pgvector：`v0.8.7`（PostgreSQL 13+）
- meilisearch：`v1.55.0` **社区版**（MIT 二进制/镜像，避开 `meilisearch-enterprise`）
- JSON Resume schema：`v1.2.1`（npm `@jsonresume/schema`）
- MCP Python SDK：`v2.3.0`（`mcp` 包，Python 3.11+）
- OpenCATS：不采用，无需锁定

## 许可证合规总评

- 拟直接使用的 5 项（docling、pgvector、meilisearch CE、jsonresume、mcp python-sdk）全部为**宽松许可**（MIT / PostgreSQL License），**无 copyleft 传染**，HHBA 闭源商用只需保留各项目的版权声明与许可证文本。
- 两个"坑"已标出：meilisearch EE（BUSL-1.1 不可免费生产使用）、OpenCATS（弱 copyleft，且不采用）。
- 无 GPL/AGPL 强 copyleft 组件进入选型清单。

## 未确认事项

- docling 官方文档的最低硬件要求数值（本次引用的是社区实测与第三方镜像说明；官方口径未拉取，接入前以官方文档为准）。
- meilisearch BUSL-1.1 的 Change Date（转为开源许可的日期）未查，本次结论"只用 CE"不受影响。
- reactive-resume v6 的生产部署细节（如对象存储是否可用本地盘替代 seaweedfs）未深究，因结论是"仅借鉴"。
