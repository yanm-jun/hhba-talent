# HHBA V0.1 系统架构

状态：规划待审查。采用模块化单体；所有端口共享同一个 API、策略执行点与 PostgreSQL 数据库。

## 架构原则

1. **服务端为唯一策略执行点**：UI、REST 与 MCP 均不能绕过访问控制。
2. **最小数据返回**：查询结果先选候选，再按主体、组织、委托和资源策略过滤、裁剪。
3. **异步解析，人工确认发布**：上传不等于公开，解析不等于档案更新。
4. **可替换 AI**：以 Provider Adapter 处理模型，默认关闭外部传输。

```mermaid
flowchart LR
  P[个人端 React/Vite] --> API[FastAPI 模块化单体]
  E[企业端 React/Vite] --> API
  A[MCP Client / Agent] --> MCP[MCP v2 适配层]
  MCP --> API
  ADM[最小管理界面] --> API

  API --> AUTH[认证与主体解析]
  API --> POLICY[授权与字段裁剪]
  API --> PROFILE[档案/联系领域服务]
  API --> SEARCH[PostgreSQL FTS + pgvector]
  API --> JOBS[解析任务 Worker]
  PROFILE --> DB[(PostgreSQL + pgvector)]
  POLICY --> DB
  SEARCH --> DB
  JOBS --> DB
  JOBS --> OBJ[本地/未来对象存储]
  JOBS -.仅经批准.-> AI[AI Provider Adapter]
  API --> AUDIT[审计事件]
  AUDIT --> DB
```

## 模块依赖

```mermaid
flowchart TD
  Identity[identity: 用户、组织、会话] --> Policy[policy: 可见性、授权、委托]
  Profile[profile: 简历、经历、技能、能力档案] --> Policy
  Search[search: 候选检索与排序] --> Policy
  Contact[contact: 联系申请] --> Policy
  MCP[mcp: 工具适配] --> Identity
  MCP --> Search
  MCP --> Contact
  Parsing[parsing: 上传、Docling、AI 草稿] --> Profile
  Audit[audit: 事件写入/查询] --> Identity
  Audit --> Policy
  Admin[admin: 删除/举报/风控队列] --> Audit
```

禁止反向依赖：领域模块不得直接调用前端；MCP 不得直连数据库；Worker 不得绕过 Profile/Policy 发布档案。

## 关键流程

### 简历到可检索档案

```mermaid
sequenceDiagram
  participant U as 个人用户
  participant API as API
  participant W as 解析 Worker
  participant D as Docling/AI Adapter
  participant DB as PostgreSQL
  U->>API: 上传/导入简历
  API->>DB: 文件元数据、解析任务(pending)
  W->>D: 提取结构化草稿（批准后才可外传）
  D-->>W: 草稿及来源片段
  W->>DB: draft, task=review_required
  U->>API: 审核、编辑、确认
  API->>DB: 创建 profile_version + visibility/consent
  API->>DB: 更新可检索投影（仅已授权字段）
```

### 搜索与联系申请

```mermaid
sequenceDiagram
  participant C as 企业/Agent
  participant API as API/MCP
  participant P as Policy
  participant S as Search
  participant O as 个人用户
  C->>API: 查询或 MCP tool call
  API->>P: 主体、组织、委托、scope 校验
  P->>S: 仅可见候选条件
  S-->>API: 策略裁剪后的卡片
  C->>API: 发起联系申请
  API->>P: 创建权限与限流校验
  API-->>O: 站内通知
  O->>API: 批准/拒绝/撤回
  API-->>C: 仅状态变化；批准后按授权范围提供渠道
```

## 可直接复用与仅参考

| 组件 | V0.1 决策 |
|---|---|
| FastAPI、PostgreSQL、pgvector、Docker Compose、Docling、MCP Python SDK v2 | 直接使用已安装/已验证组件 |
| JSON Resume | 作为导入/导出结构参考；扩展置于 `hhba` 命名空间 |
| Reactive Resume v6 | 仅参考交互与数据建模，不嵌入代码或作为基座 |
| Meilisearch、OpenCATS | 不引入；前者在有检索性能证据后评估，后者仅业务流程参考 |

许可证与固定版本见 [DEPENDENCY_LICENSES.md](DEPENDENCY_LICENSES.md)。
