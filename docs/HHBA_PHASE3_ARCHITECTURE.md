# Phase 3 架构：授权过滤优先的模块化单体

```text
React 企业端
  → FastAPI Search/Contact API
      → 身份 + 企业审核 + Policy 服务
      → Query Planner（规则条件整理）
      → PostgreSQL FTS / later pgvector
      → Candidate Search Projection（仅可检索字段）
      → Contact Request 状态机
      → Audit 事件
PostgreSQL 是唯一事实源；Worker 仅处理简历，不能授予检索权限。
```

## 关键约束

1. API 是唯一授权执行点。前端、规则整理器、未来 Agent 和数据库客户端均不能绕开 Policy 服务。
2. 搜索投影与主档案分离：投影只含 confirmed 内容及可被企业查看的字段；不复制原始简历、会话、私密联系方式。
3. 查询在 SQL 层先执行企业准入和授权筛选，再进行文本/向量排序；绝不“先检索全部再在前端隐藏”。
4. Phase 3A 采用 PostgreSQL FTS + 结构化过滤。只有离线质量评估证明词法检索不足时，才启用 pgvector。
5. MCP 仍未接入；未来 MCP 只能调用相同 API/Policy 层，不能取得数据库连接。

## 事件与同步

档案确认、编辑、撤销企业检索授权、删除档案会写入 outbox/projection 更新事件。事务内先取消可检索资格；异步工作仅重建 FTS/embedding，延迟不能造成已撤销资料继续返回。
