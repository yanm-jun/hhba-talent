# 第三方依赖选型与许可证审计

数据来源：2026-10-13 使用 GitHub 官方 REST API `repos/{owner}/{repo}`、`releases/latest`、`commits/{default_branch}` 与许可证端点读取；未克隆仓库。固定 commit 用于后续复核，实际引入前必须再次确认许可证文件与版本。

| 项目 | 默认分支 / 固定 commit | 最新发布 | 最近推送（UTC） | 许可证 | Phase 0 结论 |
|---|---|---|---|---|---|
| [Reactive Resume](https://github.com/reactive-resume/reactive-resume) | main / `4034b720c794` | v6.0.2 | 2026-10-12 | MIT | 仅参考；不嵌入代码 |
| [Docling](https://github.com/docling-project/docling) | main / `e3842c0cf3e4` | v2.138.0 | 2026-10-13 | MIT | 计划作为可选 Python 依赖；延后安装 |
| [pgvector](https://github.com/pgvector/pgvector) | master / `f37c13f68b57` | 无 latest release | 2026-10-08 | PostgreSQL License（GitHub 未标准识别） | 可用；Compose 固定 image tag `0.8.1-pg17` |
| [Meilisearch](https://github.com/meilisearch/meilisearch) | main / `420ff1362801` | v1.55.0 | 2026-10-13 | MIT AND BUSL-1.1 | 仅评估，不引入；须逐组件核对 EE/BUSL 边界 |
| [JSON Resume](https://github.com/jsonresume/jsonresume.org) | master / `dd0155358c8d` | resume-cli@3.7.3 | 2026-09-09 | MIT | 可作为格式互操作参考；不引入代码 |
| [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) | main / `754254c08fe1` | v2.3.0 | 2026-10-13 | MIT | 未来 Agent 接口采用 v2；不使用 v1 示例 |
| [OpenCATS](https://github.com/opencats/OpenCATS) | master / `ea61251984cb` | v0.11.1 | 2026-10-12 | MPL-2.0 + CATS Public License 1.1a | 仅业务流程参考；禁止复制/混入代码，除非完成逐文件许可审查 |

## 商业化与二次开发结论

MIT 项目通常可商用、修改与再分发，但在分发其代码/实质部分时须保留版权和许可文本。pgvector 需保留其许可证和版权声明。Meilisearch 存在 `MIT AND BUSL-1.1` 双重/分部许可表述，不将其引入以避免误用企业版或受限部分。OpenCATS 的混合许可证不适合直接作为代码基座。

在任何实际引入前，执行：锁定版本、保存原始 LICENSE/NOTICE、在 `references/THIRD_PARTY_SOURCES.md` 更新来源、把相应文本加入发布物的第三方声明。本文不是法律意见；商业发布前应由法务复核。
