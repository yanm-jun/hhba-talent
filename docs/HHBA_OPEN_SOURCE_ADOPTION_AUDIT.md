# HHBA 开源采用审计

审计日期：2026-10-14；方法：检查 `pyproject.toml`、锁文件、Docker Compose、源码 import/运行调用、Git 受跟踪文件与官方仓库元数据。分类表示**当前代码事实**，不是愿景。

| 项目 | 分类 | 实际状态与版本 | 许可证/版权处理 | 结论 |
|---|---|---|---|---|
| Reactive Resume | DESIGN_REFERENCE | 未安装、无 import、无源码复制；仅参考 v6 的简历编辑/分享流程 | MIT；未分发其代码，无须在 HHBA 代码中附带其版权文本 | 不作为底座；避免引入其数据/部署耦合 |
| Docling | DIRECT_DEPENDENCY | `docling==2.138.0`，Worker 在 `app/docling_worker.py` 实际 import `DocumentConverter` 并完成浏览器合成 PDF 解析 | MIT；包来源与版本在 lock 中 | 必需；本地隔离 Worker 使用 |
| pgvector | DIRECT_DEPENDENCY | Compose image `pgvector/pgvector:0.8.1-pg17`；PostgreSQL 扩展已在环境验证，尚未有 Phase 3 向量列/查询 | PostgreSQL License；镜像版本固定 | 保留；Phase 3 先不激活向量检索 |
| JSON Resume | DESIGN_REFERENCE | 未安装、无 import、无源码复制；仅作互操作字段参考 | MIT | 保持参考，不引入前端模板代码 |
| MCP Python SDK | PLANNED | `mcp==2.3.0` 在 Python 环境和 lock 中；当前没有 MCP server、工具注册或运行时调用 | MIT | 为 Phase 4 预留；当前是未使用依赖 |
| Meilisearch | NOT_USED | 未安装、无容器、无 import；架构文档提到但未启用 | 仓库分部/产品许可需逐项确认 | Phase 3 不引入；PostgreSQL FTS 优先 |
| OpenCATS | DESIGN_REFERENCE | 未安装、无 import、无源码复制；仅参考 ATS 流程 | MPL-2.0 + CATS Public License 1.1a 的混合历史 | 禁止复制/混入代码 |
| Lucide React | DIRECT_DEPENDENCY | `lucide-react@0.468.0`，首页、求职端、企业端实际 import | ISC；npm lock 固定 tarball | 保留；统一 SVG 图标来源 |

官方来源：Reactive Resume、Docling、pgvector、JSON Resume、MCP Python SDK、Meilisearch、OpenCATS、Lucide 各自 GitHub 项目页；既有固定 commit/许可证记录见 `docs/DEPENDENCY_LICENSES.md`。官方 GitHub API 在本轮确认 pgvector、MCP Python SDK、Meilisearch 仍活跃；其余条目以仓库中已记录的来源和许可为准。

## 源码复用与重复实现

- `SOURCE_REUSE`：无。没有 clone、vendored 第三方源码或修改后的第三方文件。
- 简历规则提取是 HHBA 自己的最小实现，不是 Docling 或 JSON Resume 的复制品。
- 无 Meilisearch/OpenCATS/Reactive Resume 功能代码；不得把“文档中提及”表述为已实现。
- `mcp` 目前是未使用的直接安装包；应在 Phase 4 前重新评估，若持续未使用则从运行环境移至 Phase 4 专用依赖组，避免无谓供应链面。

## 依赖与可复现性

1. `requirements.lock` 原含本机绝对路径 editable install（`-e c:\users\...\apps\api`），已在本轮移除；这修复了最明显的跨机失败点。
2. 该文件本质为当前 Windows 虚拟环境的 `pip freeze`，没有哈希、分平台 marker 或生成命令，仍不是严格跨平台 lock；其中 `pywin32`、Docling/PyTorch 传递项和 `httpx2/httpcore2` 等应在不影响 Worker 的后续专门依赖整理中核实。
3. 不在本轮重新生成或删除 Docling/PyTorch 依赖，避免破坏已运行 Worker。推荐后续以干净 Python 3.12 环境、受控 resolver（`uv lock` 或 `pip-tools`）产出带生成说明的锁文件。
4. `package-lock.json` 固定了 Lucide tarball；Web 依赖没有本机绝对路径。`dist`、`node_modules`、`.venv`、私密上传、SQLite 测试库及 Worker 构建日志均未被 Git 跟踪。

## 大型/暂未使用依赖

- Docling 的 PyTorch/transformers 传递依赖体积大，但当前 Worker 真实使用 Docling，不能视为“未使用”。Worker 以离线模式运行 PDF 原生管线；模型缓存不自动下载。
- `mcp==2.3.0` 当前未被运行代码 import，是可延后移出的唯一明确候选；本轮不删除。
- pgvector 镜像是运行数据库依赖而非 Python 包；保留。
