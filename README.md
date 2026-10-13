# HHBA — AI 时代的人类能力搜索与连接平台

> 当前阶段：**Phase 0 — 开发环境审计、基础设施准备与项目初始化**（2026-10）
> 本阶段只做准备工作，不开发正式业务功能。

## 产品定义

1. **个人端**：用户注册、上传简历，AI 解析经历与技能，生成可分享、可搜索、可控制公开范围的个人 AI 能力名片。
2. **企业端**：企业用自然语言描述人才需求，搜索符合要求的人才，在获得授权后发起联系。
3. **第三方 Agent 接入端**：标准化 API 与 MCP Server，授权的外部 Agent 可搜索人类能力档案、读取允许公开的信息、发起联系申请。

三个端口共享同一套人才能力数据模型、身份认证、访问控制和搜索服务。

## 目录结构

```
HHBA/
  apps/web/          前端（React + TypeScript + Vite，Phase 0 仅做最小骨架）
  apps/api/          后端 API（FastAPI，Phase 0 仅健康检查）
  packages/shared/   共享数据模型（JSON Resume 扩展结构）
  infra/             基础设施（Docker Compose：PostgreSQL + pgvector）
  docs/              文档（审计 / 选型 / 指南 / 风险 / 就绪状态）
  scripts/           脚本（含可移植的环境审计脚本 audit.sh）
  tests/             测试
  references/        第三方资料与许可证记录
```

## 文档索引

- `docs/ENVIRONMENT_AUDIT.md` — 环境体检结果
- `docs/TECH_STACK_DECISION.md` — 技术选型决策
- `docs/DEPENDENCY_LICENSES.md` — 开源依赖与许可证审计
- `docs/SETUP_GUIDE.md` — 从零启动指南
- `docs/PROJECT_READINESS.md` — 项目就绪状态报告（供审阅）
- `docs/INITIAL_RISKS.md` — 初始风险清单

## 本阶段终止条件

完成环境审计、开源项目核查、技术选型建议、工作区创建、必要环境配置和基础验证后，
输出 `docs/PROJECT_READINESS.md` 供审阅。V0.1 的产品目标与里程碑另行制定。

## 说明

- 本工作区为 2026-10 新立的 Phase 0 独立工作区（本地 Git 仓库，未推送远程）。
  历史 HHBA 代码仓库（yanm-jun/HHBA，"AI 当包工头"方向）未做任何改动。
- 真实密钥一律不进仓库：`.env` 已加入 `.gitignore`，仅保留 `.env.example` 占位符。
