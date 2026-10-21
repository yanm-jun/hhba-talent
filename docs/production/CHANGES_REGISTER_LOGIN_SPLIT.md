# CHANGES —— 认证改「注册/登录双入口严格分开」

- 决策依据: 用户 2026-10-21 23:34 拍板「注册、登录是两个入口，没注册的号不能直接登录」，
  并于 23:29 强调「先注册后登录，这个逻辑一定不要错误」。
- 关系: 本地 `hhba-prod-work` 新版 **supersede** 已推送分支 `feat/production-aliyun-auth-admin-20261021`
  提交 `f878e1b` 中的同名 auth 文件（旧版为「验码即注册登录」统一入口）。本轮改动只落本地，
  未 push、未碰服务器/Railway、未用真实密钥；等主会话验收后另行推送。

## 1. 改了哪些文件

| 文件 | 改动 |
|---|---|
| `ops/legacy-marketplace/auth/sms-code.ts` | 新增 `SmsPurpose='register'\|'login'` 强类型与 `isSmsPurpose`；`createCodeRecord` 的 purpose 改必填（删除 `'login'` 默认值）；`hashCode` 非法 purpose 抛 `SMS_PURPOSE_INVALID`；`SmsCodeRecord.purpose` 收窄为 SmsPurpose；`verifyCode` 新增 `expectedPurpose` 断言与 `purpose_mismatch` 结果 |
| `ops/legacy-marketplace/auth/auth-service.ts` | 结构重写（见第 2 节语义表）；新增 `AUTH_ERROR_MESSAGES` 错误码→中文文案表；logSmsSend 条目加 purpose 字段 |
| `ops/legacy-marketplace/auth/auth-routes.ts` | 发码必填 purpose；新增 `POST /api/v1/auth/register`（201）与 `POST /api/v1/auth/login`（200）两条独立路径；`/sms/verify` 降为兼容端点（必须带 purpose 按用途分发，缺失 400）；成功响应 user 增加 `registered_from` |
| `ops/legacy-marketplace/auth/auth-store-pg.ts` | 建号方法 `createUser` 改名 `insertNewUserForRegister`，SQL 写 `registered_from='register'`；toUser 补 registeredFrom；logSmsSend 的 purpose 落 detail jsonb；latestOpenSmsCode 返回 purpose 做类型收窄 |
| `apps/api/db/001_auth_schema.sql` | `sms_codes.purpose` CHECK 放开为 `('register','login')` 并去掉 DEFAULT；code_hash 注释修正为 `phone\|purpose\|code`；users 新增 `registered_from` 列（`'register'\|'admin'`，默认 'register'）及设计说明 |
| `ops/legacy-marketplace/auth/auth.test.ts` | 旧「AuthService 闭环」5 个统一入口用例整体改写为双入口用例组，auth 用例 23 → 38（清单见第 3 节）；MemoryStore 按 purpose 过滤取码 + 建号计数器 insertCalls |
| `MANIFEST.md` | 顶部加 SUPERSEDE 标注；auth 各行更新为双入口版说明与新用例数 |
| `patches/`（新增目录） | 前端接线与后台替换补丁，见第 4 节 |

未改: `sms-provider.ts`、`rate-limit.ts`、admin 两个文件、ops/production 全部文件（语义与本轮无关）。

## 2. 语义对照表

| 场景 | 旧版（f878e1b，统一入口） | 新版（双入口严格分开） |
|---|---|---|
| 发码接口 | `sendCode(phone, ip)`，码用途写死 login | `sendCode(phone, purpose, ip)`；purpose 缺失/非法 → 400 `SMS_PURPOSE_INVALID` |
| 未注册号发 login 码 | 照常发码 | **400 `PHONE_NOT_REGISTERED`「该手机号尚未注册，请先注册」**；不发短信、不落码、不占限流额度，只写一条 rejected 发送日志 |
| 已注册号发 register 码 | 照常发码 | **409 `PHONE_ALREADY_REGISTERED`「该手机号已注册，请直接登录」**；同样不发不落 |
| 验码建号 | `loginWithCode` 查无用户即 `createUser`（验码即注册） | 建号只发生在 `registerWithCode` → 私有 `#createAccountViaRegister` → `store.insertNewUserForRegister`；`loginWithCode` 无任何建号调用（计数型 store 测试断言） |
| 验码前状态复核 | 无 | 两个验码入口都先再查一次注册状态（双保险）：login 未注册直接拒且**不消耗验证码**；register 已注册直接拒 |
| 验码成功后 | 查或建用户 → 更新 last_login → 发会话 | register: 建号（created_at=注册时间、registered_from='register'）→ 发会话；login: 更新 last_login_at → 发会话（同一账户，不新建） |
| 验证码用途 | purpose 恒为 'login' | 码绑定 purpose：哈希含 purpose、取码按 (phone,purpose) 过滤、verifyCode 再断言 expectedPurpose——三层任一层都能挡住跨用途 |
| 跨用途用码 | 不适用（只有一种码） | register 码去 login: 未注册时被登录状态门拒且不消耗该码（随后注册仍可完成）；已注册残留 register 码去 login: 按用途取码查无此码 `CODE_NOT_FOUND_OR_EXPIRED` 且不消耗；login 码去 register: 被注册状态门拒 |
| HTTP 端点 | `/sms/send`、`/sms/verify`（验码即进入） | `/sms/send`{phone,purpose}、`/auth/register`、`/auth/login` 独立两路；`/sms/verify` 仅兼容且必须带 purpose |
| 错误文案 | 只有错误码 | `AUTH_ERROR_MESSAGES`（后端 auth-service.ts 与前端 smsAuth.ts 同名同表）：PHONE_NOT_REGISTERED→「该手机号尚未注册，请先注册」；PHONE_ALREADY_REGISTERED→「该手机号已注册，请直接登录」；其余码（限流/过期/错次/用途不符等）一并落表 |
| 保留不变的规则 | — | 6 位码、5 分钟有效、60 秒重发间隔、手机号 24h≤10 / IP 1h≤20 限频、错 5 次作废、成功即失效、只存 HMAC 哈希、mock 网关生产防线（production 构造即抛错、无万能码） |

## 3. 测试清单与输出摘要

命令: `bun test ops/legacy-marketplace/auth/auth.test.ts ops/legacy-marketplace/admin-local.test.ts`
结果: **44 pass / 0 fail，356 个 expect**（auth 38 + admin-local 6，admin 部分与上一版一致未受影响）。

双入口新增/改写用例（逐条对应任务书语义）:
- 用途绑定纯逻辑 ×4: purpose 必填（缺失/非法抛错）、同码两用途哈希不同、register 码在 login 校验用途断言失败且不消耗/不作废、不传断言时哈希层也挡住。
- 注册入口 ×4: 全流程建号（断言 registeredFrom='register'、createdAt、落库码 purpose='register'、库无明文）；已注册发码被拒（断言网关未调用、无新码落库）；已注册绕过发码直接验码被再拒（用户数/insertCalls 不变）；错码不建号 + 60 秒重发限流。
- 登录入口 ×4: 未注册发码被拒（断言没发短信、没落码、用户数 0、insertCalls 0、rejected 日志存在）；未注册绕过发码直接验码被再拒（用户数与会话数不变）；注册后 login 成功（同一 user id、insertCalls 仍为 1、last_login_at 更新）；login 错码不建号不发会话。
- 跨用途 ×3: register 码→login 被状态门拒且不消耗、随后注册可完成；残留 register 码→login 按用途取码失败且 attempts 不变；login 码→register 被状态门拒。
- HTTP 路由 ×3: send 缺 purpose 400；send login 未注册 400 且不建号；全链路 register 201（Set-Cookie）→ login 200 → 重复 register 409。

其他验证（同轮执行）:
- `tsc --strict`（独立 tsconfig + bun-types/@types/node，含 auth 全部文件与 admin 两文件）: **0 错误**
  （过程中修掉 auth-store-pg.ts 一处 purpose 类型收窄，复跑全绿）。
- schema 用 sqlglot（postgres 方言）解析: **19 条语句通过**。
- 前端补丁 smsAuth.ts / AuthPage.tsx 用 Bun Transpiler 做语法透传校验: 均 OK
  （仅语法级；完整类型检查需在 apps/web 工程内合并后跑，见未完成项）。

## 4. 补丁清单（patches/，均未推送）

| 补丁 | 内容 | 套用要点 |
|---|---|---|
| `patches/README.md` | 全包套用顺序（11 步）与全局纪律 | 先读它 |
| `patches/frontend/smsAuth.ts` | 新增 `apps/web/src/services/smsAuth.ts` 整文件: sendSmsCode(phone,purpose)/registerBySms/loginBySms/me/logout/账户收藏 + AUTH_ERROR_MESSAGES + SmsAuthError | 独立于旧 api.ts 的 employerApiReady 开关；api.ts 可一行 re-export |
| `patches/frontend/AuthPage.tsx` | `apps/web/src/pages/AuthPage.tsx` 整文件替换: 注册/登录两个页签（mode 即 purpose）、60 秒倒计时、切换页签清码 | 与原件 diff 要点写在文件头（删邮箱密码字段、注册只收手机号、props 改 SmsUser、App 装配需同步） |
| `patches/frontend/PersonalCenterPage.saved-section.md` | 收藏区改读账户级: props 增 smsUser、读取 useEffect 替换、取消收藏分流、设备→账户一次性迁移（显式 confirm、逐条 PUT、禁止自动并入）、文案降级 | 含合并后手测 4 条（跨设备可见、双用户隔离、迁移显式性、后台对账） |
| `patches/frontend/DemoAuthPage.isolation.md` | 演示账户隔离复核表（5 条不变量 + grep 验证命令）+ 路由切换动作 | DemoAuthPage/demoAccount.ts 不改代码；正式 login/register 路径切给新 AuthPage，演示移独立入口 |
| `patches/backend/admin-jobs.replacement.md` | admin-console.ts 删除拉 GitHub Pages 快照整段 → 装配 admin-jobs-local.ts 的完整替换代码段 + Dockerfile 补 COPY + dashboard.js 旧形状字段适配 | 验收含 total 与 /api/jobs/page 对账、断网验证不回退快照 |
| `patches/backend/admin-growth-users.replacement.md` | privateGrowth 增 users 段: queryAdminUsersSection（PG 三类查询 + 跨日 distinct）与 privateGrowthWithUsers 组装层 + 路由行替换 + 装配参考 | PG 未接入/异常自动降级 unavailable，老字段与 dau/mau=null 不动 |
| `patches/backend/dashboard-users.snippet.md` | index.html 增 5 张用户指标卡 + dashboard.js renderUsersSection + updateGrowth 挂接点 + exportCSV 动态行 | 复用既有 displayMetric 保证「未接入显示 —、真实 0 显示 0」 |

## 5. 未完成项

1. **未推送**: 本地新版 auth + patches 待主会话验收后再推分支（将以新提交覆盖 f878e1b 的同名文件）。
2. **未真实建库执行**: schema 只过 sqlglot 解析，无本地 PG 实例；`registered_from` 列与 purpose CHECK 的
   实际建库、PgAuthStore 的事务行锁落地仍按原计划在 ECS 测试环境补验。
3. **前端补丁未在 apps/web 工程内编译**: AuthPage/smsAuth 只做了语法透传校验；合并时需在 web 工程跑
   `tsc -b && vite build`，并处理 App.tsx 的登录态装配（user 类型 SmsUser 化、守卫改 smsAuth.me()）。
4. **`/api/v1/saved` 返回形状**: 当前只回 jobId 列表，个人中心 savedAt 显示降级为「账户收藏」；
   若要显示收藏日期，需后端把 saved_jobs_account.created_at 一并返回（补丁文档已标注改法，非阻塞项）。
5. **真实短信未联调**: 双入口语义在 mock 网关下验证；阿里云签名/模板审核与账号欠费问题未解决前，
   不得声称真实短信可发送（沿用 RISKS_AND_MANUAL 的人工事项清单）。
