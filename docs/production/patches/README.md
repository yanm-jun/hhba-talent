# 合并补丁包 —— 注册/登录双入口 + 前端接线 + 后台替换

本目录是**补丁与套用说明**，不是仓库文件：不要整目录拷进仓库，按下面顺序逐项套用，
每项都注明了目标文件、锚点和验证方式。补丁基于原件副本（hhba-prod-audit/raw，
对应基准分支 `feat/admin-phase31-private-growth-20261021` HEAD 323be6d）编写；
套用时若目标文件已有漂移，先 diff 再套，不要整段盲覆盖。

## 套用顺序

| 步 | 内容 | 文件 |
|---|---|---|
| 1 | 后端认证模块（双入口版）整文件更新：`auth/sms-code.ts`、`auth/auth-service.ts`、`auth/auth-routes.ts`、`auth/auth-store-pg.ts`、`auth/auth.test.ts`（均在 hhba-prod-work 根目录对应路径，直接覆盖同路径旧版） | — |
| 2 | 数据库 schema 更新：`apps/api/db/001_auth_schema.sql`（sms_codes.purpose 放开 register/login 且去默认；users 加 registered_from） | — |
| 3 | 主服务装配：`railway-function-20261018.ts` 分发链加 auth handler（auth-routes.ts 文件头有装配代码）；`Dockerfile.hhba` 补 COPY 行（auth/ 全部文件、admin-jobs-local.ts、admin-growth-contract.ts，逐项见各补丁文末清单） | backend/*.md |
| 4 | 后台 /api/admin/jobs 改本地统计 | backend/admin-jobs.replacement.md |
| 5 | 后台 /api/admin/growth 增加 users 段 | backend/admin-growth-users.replacement.md |
| 6 | 后台 dashboard.js 渲染 users 段 + jobs 新形状适配 | backend/dashboard-users.snippet.md、backend/admin-jobs.replacement.md 第 4 节 |
| 7 | 前端新增 `apps/web/src/services/smsAuth.ts`（整文件落位） | frontend/smsAuth.ts |
| 8 | 前端 `apps/web/src/pages/AuthPage.tsx` 整文件替换（双入口版） + App 路由接线说明 | frontend/AuthPage.tsx |
| 9 | 个人中心收藏区改读账户级收藏 | frontend/PersonalCenterPage.saved-section.md |
| 10 | 演示账户隔离复核（只检查、不改行为） | frontend/DemoAuthPage.isolation.md |
| 11 | 环境开关：`HHBA_AUTH_ENABLED=1` 后才启用 auth 路由；短信 provider 按环境选 mock/aliyun，生产禁 mock 不变 | ops/production/.env.production.example |

## 全局纪律（套用时不得放松）

- 注册/登录双入口语义以后端 auth-service.ts 为准，前端只做呈现：未注册不能登录、已注册不能重复注册、
  验证码不跨用途。前端文案映射表在 frontend/smsAuth.ts 的 AUTH_ERROR_MESSAGES，与后端同名表一致。
- 后台指标真实性纪律不变：无数据源显示「未接入/null」，真实 0 显示 0，禁止任何估算填充。
- 演示账户（demoAccount）永不调用账户接口、永不计入注册统计。
