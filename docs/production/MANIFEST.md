# MANIFEST —— HHBA 生产化 Phase 1–3 本地代码包

- 基准：`feat/admin-phase31-private-growth-20261021` HEAD `323be6d1e507b9639cc8e8a6a93a69ab2e773d14`（Phase 0 审计，见 `~/workspace/hhba-prod-audit/AUDIT_PHASE0.md`）
- 目标分支：`feat/production-aliyun-auth-admin-20261021`（已建，未动）
- 状态声明：**本包全部文件只在本地编写与测试，未 push GitHub、未部署到任何服务器、未接触 Railway/阿里云生产、未使用任何真实密钥。**
- ⚠️ SUPERSEDE（2026-10-21 23:34 用户拍板后修订）：本包 auth 模块第一版曾以「验码即注册登录」统一入口
  推送到目标分支提交 `f878e1b`。用户随后改令【注册/登录双入口严格分开】，本地已按新语义重写
  `auth/sms-code.ts`、`auth/auth-service.ts`、`auth/auth-routes.ts`、`auth/auth-store-pg.ts`、`auth/auth.test.ts`
  与 `apps/api/db/001_auth_schema.sql`——**本地版本 supersede f878e1b 的对应文件**，合并时以本地为准整文件覆盖，
  不要 cherry-pick 旧版的 loginWithCode 自动建号逻辑。变更档案见 `CHANGES_REGISTER_LOGIN_SPLIT.md`，
  前端接线与后台替换补丁在 `patches/`。本地新版尚未推送，等主会话验收后另行提交。
- 目录组织：路径即仓库相对路径，合并时按「落点」整文件拷入或按「改哪个现有文件」做定点替换。

## 文件清单

### Phase 1 —— 部署包（新增目录 `ops/production/`）

| 本包文件 | 落点 | 改哪个现有文件 | 为什么 |
|---|---|---|---|
| `ops/production/docker-compose.yml` | 同路径新增 | 不改业务文件；构建引用仓库根 `Dockerfile.hhba` | 把 Railway 运行环境等价搬到 ECS：同镜像构建 + postgres:17 + Caddy 反代，含健康检查、unless-stopped 自动重启、日志轮转、命名卷持久化 |
| `ops/production/Caddyfile` | 同路径新增 | 无 | HTTPS 自动证书与转发头。选 Caddy 不选 Nginx：ACME 自动续期免运维、reverse_proxy 默认转发头正合现有 validOrigin/Origin 校验（理由详见 compose 头注释） |
| `ops/production/.env.production.example` | 同路径新增 | 替代把开关写死在 `Dockerfile.hhba` 的做法（构建参数改为 compose args 注入） | 全部生产变量模板：HHBA_ADMIN_PASSWORD、DATABASE_URL、SESSION_SECRET/SMS_CODE_PEPPER、阿里云短信一组、APP_ORIGIN/TRUSTED_PROXY 等，仅占位符 |
| `ops/production/backup-sqlite.sh` | 同路径新增 | 无 | Railway `/sync-state` 一致性备份：sqlite3 `.backup` 在线备份（禁直接 cp WAL 中的库）+ integrity_check + 行数/sha256 清单 + public-index 打包；覆盖 engagement/saved/overseas-jd/translations 四库 |
| `ops/production/restore-sqlite.sh` | 同路径新增 | 无 | 恢复：先验完整性、旧库改名 `.pre-restore-<时间>` 保留不删除、残留 -wal/-shm 一并保留 |
| `ops/production/README.md` | 同路径新增 | 无 | 部署包说明、Railway→ECS 数据对应表、本地校验与迁移日演练顺序 |

### Phase 2 —— 真实账户系统（新增，不动现有模拟登录代码）

技术选型说明：与现有 Bun 主服务同进程同部署。主服务 `railway-function-20261018.ts` 的 handler 串联惯例
（返回 null 表示不处理）直接复用；`apps/api/main.py` 只是 Phase 0 健康检查骨架（审计已证从未生产部署），
不另起 Python 进程。账户库用 PostgreSQL 17（compose 已含），现有 SQLite 业务数据原样不动。

| 本包文件 | 落点 | 改哪个现有文件 | 为什么 |
|---|---|---|---|
| `apps/api/db/001_auth_schema.sql` | 同路径新增 | 无（`apps/api/` 现仅 main.py 骨架） | 10 张表：users（手机号唯一+格式 CHECK、角色、管理员受控授予 CHECK）、user_profiles、auth_sessions（只存 token 哈希）、sms_codes（只存 HMAC 哈希）、sms_send_log、saved_jobs_account（账户收藏，与设备收藏隔离）、employers、employer_verifications、job_reviews、admin_audit_log |
| `ops/legacy-marketplace/auth/sms-code.ts` | 同路径新增（本地新版 supersede f878e1b） | 无 | 验证码核心规则纯逻辑：6 位/5 分钟/成功即失效/最多 5 次错误/HMAC 哈希（phone\|purpose\|code）不存明文/时序安全比对；**purpose 强类型必填、无默认值，跨用途三层失败** |
| `ops/legacy-marketplace/auth/rate-limit.ts` | 同路径新增 | 无 | 发送限流：60 秒重发间隔、同号 24h≤10、同 IP 1h≤20 |
| `ops/legacy-marketplace/auth/sms-provider.ts` | 同路径新增 | 无 | 短信适配器接口 + 阿里云 Dysmsapi 形状实现（错误码映射、配置 fail-fast）+ mock 网关；生产防线：production 或未显式 `HHBA_ALLOW_MOCK_SMS=1` 时 mock 构造即抛错，无万能码 |
| `ops/legacy-marketplace/auth/auth-service.ts` | 同路径新增（本地新版 supersede f878e1b） | 无 | 编排（双入口版）：sendCode(phone,purpose,ip) 双道注册状态门；registerWithCode 为唯一建号路径（#createAccountViaRegister→store.insertNewUserForRegister）；loginWithCode 无任何建号调用；会话签发/校验/撤销、账户级收藏隔离；AUTH_ERROR_MESSAGES 错误码→中文文案表 |
| `ops/legacy-marketplace/auth/auth-store-pg.ts` | 同路径新增（本地新版 supersede f878e1b） | 无 | AuthStore 的 PG 实现骨架（参数化 SQL 与 schema 对应，含验证码行锁防并发绕过的落地注释）；建号方法改名 insertNewUserForRegister 并写 registered_from='register' |
| `ops/legacy-marketplace/auth/auth-routes.ts` | 同路径新增（本地新版 supersede f878e1b） | 合并时改 `railway-function-20261018.ts`：启动装配一行 + fetch 分发链加一行（`HHBA_AUTH_ENABLED=1` 才启用） | `/api/v1/auth/sms/send`（purpose 必填）、`/api/v1/auth/register`、`/api/v1/auth/login`、`/sms/verify`（兼容端点，必须带 purpose 分发）、`/logout`、`/me`、`/api/v1/saved*`；Origin+CSRF 双校验；关闭开关时路由不存在，现网行为不受影响 |
| `ops/legacy-marketplace/auth/auth.test.ts` | 同路径新增（本地新版 supersede f878e1b） | 无 | 38 个用例：哈希/过期/错误次数/限流/mock 生产防线/阿里云参数形状 + 双入口语义（未注册拒登录且用户数不变、已注册拒注册、register→login 全链路、跨 purpose 三场景、HTTP 路由层） |

前端待改（本包只给契约、未改前端代码，合并阶段处理）：
- `apps/web/src/pages/AuthPage.tsx` / `services/api.ts`：正式登录入口改调 `/api/v1/auth/sms/*`（手机号+验证码），
  不再依赖 `VITE_HHBA_ACCOUNT_API_ENABLED` 的旧邮箱路径；
- `apps/web/src/pages/DemoAuthPage.tsx` / `services/demoAccount.ts`：保留但明确隔离——演示数据不调账户接口、
  不进统计（后端 users 段 scope 已写死 REGISTERED_ACCOUNTS_ONLY）；
- `apps/web/src/pages/PersonalCenterPage.tsx`：收藏区登录后改读 `/api/v1/saved`（账户级）；
  设备收藏合并须前端显式征得用户同意后逐条 PUT，禁止自动并入（任务书 5.5）。

### Phase 3 —— 管理后台真实数据（改造草案，定点替换）

| 本包文件 | 落点 | 改哪个现有文件 | 为什么 |
|---|---|---|---|
| `ops/legacy-marketplace/admin-jobs-local.ts` | 同路径新增（纯函数 + 装配注释） | 合并时改 `admin-console.ts`：删除 `/api/admin/jobs` 拉 GitHub Pages `overview.json` 透传的整段，换为注释中的装配代码（readNativeIndex 读 `/sync-state/public-index/jobs.json` + jd-sync-store coverage/失败聚合 → computeAdminJobsLocal） | 后台岗位指标改用本服务数据：总量/displayable/国内海外/校招社招实习/企业数/最近同步/同步失败。真实性：不输出「已确认在招」数字（索引起始无此事实），待核验单列；关闭数仅取同步库 REMOVED，无库为 null；索引不可读整体 unavailable，禁止回退外部快照 |
| `ops/legacy-marketplace/admin-growth-contract.ts` | 同路径新增（契约 + 纯函数） | 合并时改 `admin-console.ts` 的 `privateGrowth()` 返回组装处（增量加 `users` 段并同步 `unavailable.registeredUsers`，老字段不动）；前端 `admin-ui/dashboard.js` 相应渲染 users 段（合并阶段） | 注册用户真实查询契约：PG 未接入时继续 `null + quality:'unavailable'`；接入后 total/今日/7d/30d/登录活跃（跨日 distinct 单独查，防每日相加冒充）均为真实查询，真实 0 显示 0 |
| `ops/legacy-marketplace/admin-local.test.ts` | 同路径新增 | 无 | 6 个用例：本地岗位统计口径、unavailable/partial 语义、users 段未接入形态与真实 0 区分、活跃口径防错 |

### 顶层文档

| 文件 | 内容 |
|---|---|
| `MANIFEST.md` | 本文件 |
| `RISKS_AND_MANUAL.md` | 账号所有者人工事项：短信签名/模板审核（含历史欠费先清）、AccessKey 创建（含 ECS 已绑 RAM 角色 OpenNestSmsAuthEcsRole 的免密替代待核）、Railway 卷导出授权、ECS 选型与清机窗口（2026-10-21 改令）、ICP 备案、域名解析切换（含 hhba.cn 异常跳转待查），每项含入口与卡点 |

## 本地验证（已执行）

```bash
bun test ops/legacy-marketplace/auth/auth.test.ts ops/legacy-marketplace/admin-local.test.ts
# → 29 pass / 0 fail（291 个 expect）
bash -n ops/production/backup-sqlite.sh && bash -n ops/production/restore-sqlite.sh   # 语法通过
ops/production/backup-sqlite.sh / restore-sqlite.sh                                   # 已用 fixture 库全流程演练（含二次恢复保留 pre-restore 副本）
tsc --strict（独立 tsconfig + @types/node + bun-types）                                # 全部新 TS 文件零错误
python3 yaml.safe_load(docker-compose.yml)                                            # YAML 结构校验通过（本机无 Docker，未跑 compose config）
sqlglot postgres 方言解析 001_auth_schema.sql                                          # 19 条语句解析通过（无本地 PostgreSQL 实例，未做真实建库执行）
```

## 未完成项（合并/上线阶段，不属本包范围或被外部事项阻塞）

1. 代码合并回目标分支并 push：按既定规矩须所有者看过改动摘要后点头，本包未推送。
2. PG 存储的真实建库执行与 AuthStore 事务行锁落地：需本地/测试 PG 实例（沙箱无 Docker 运行环境），合并后在测试环境验证。
3. 前端三处改造（AuthPage/PersonalCenterPage/dashboard.js users 段渲染）：已给契约与改法，未动前端文件。
4. 真实短信发送、真实注册、阿里云部署、域名切换：分别被 RISKS_AND_MANUAL 第 1/2/4/5/6 项阻塞，未执行、未声称完成。
