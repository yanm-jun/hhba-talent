# HHBA Phase 3A 实施记录

状态：**READY**（仅 Phase 3A；未实现 Phase 3B 搜索界面、自然语言条件整理、联系申请或 MCP）。

## 实际变更

- 新增 `CandidateSearchProjection`：已确认、已授予 `enterprise_search` 的档案最小检索投影。
- 新增 `TalentSearchUsage`：按组织成员、组织和 UTC 日期持久化搜索计数，限制成员每日 30 次、组织每日 100 次。
- 新增 `POST /api/v1/organizations/{oid}/talent-search`，服务端执行企业审核、有效成员、授权、限流、字段白名单和审计。
- 档案确认时建立投影；编辑/解析草稿时删除投影；关闭 `enterprise_search` 时立即删除投影。查询时仍直接连接 `profiles` 与最新授权，避免异步清理延迟泄露。
- 新增管理员投影重建及一致性只读接口，供受控运维使用。

## 未做的内容

没有引入 Meilisearch、Redis、外部模型、向量 embedding 或完整 HR 页面。`public_share`、`search_engine_index` 不参与企业检索资格判断。

## 运行状态

本机 API 已加载本分支路由并监听 `127.0.0.1:8003`；PostgreSQL 和 Docling Worker 都只在 HHBA 本地 Compose 环境内运行。
