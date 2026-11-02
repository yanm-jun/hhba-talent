# HHBA 真实短信登录后端（Cloudflare Pages + PNVS）——分支说明

分支：`feature/hhba-pnvs-sms-auth-20261102`（本地分支，截至本说明时**未推送、未开 PR、未上线**）。
基线：`main` HEAD `575a2e53`（2026-11-02 合并 PR #189）。
前端：**一律未动**。本分支只新增 Pages Functions 后端、D1 迁移、单测与本文档。

## 1. 契约决策：先实现 `/api/real-auth/*`，正式 `/api/v1` 留待后续

前端现有两套契约（精读源码后结论）：

| 契约 | 前端入口 | 现状 |
|---|---|---|
| 测试 `/api/real-auth/*` | `apps/web/src/services/realAuth.ts`，求职者登录页在 `VITE_HHBA_REAL_AUTH_ENABLED=1` 时走此分支 | 路径、字段、错误码已完整定型；求职者登录/注册/密码登录/找回密码/`/me`/退出全套客户端已存在 |
| 正式 `/api/v1/auth/phone/*` | `apps/web/src/services/api.ts`，需同时开 `VITE_HHBA_ACCOUNT_API_ENABLED=1` + `VITE_API_BASE=/api/v1` + `VITE_HHBA_PHONE_AUTH_ENABLED=1`，且走 CSRF + `credentials:include`，招聘方也走此路 | 后端尚未实现；且正式网关还涉及招聘方身份、企业认证等更大范围，不是一次短信接线能闭合的 |

决策理由：

1. **不开新开关、不改前端即可走通**：实现 `/api/real-auth/*` 后，求职者登录页在沿用已有构建开关 `VITE_HHBA_REAL_AUTH_ENABLED=1` 的预览部署里即可走通；不需要新增任何前端开关或前端代码。注意：这个开关是仓库里已有的，不是本分支新增的；生产构建默认未开，开它属于预览部署决策，不是代码改动。
2. **错误码逐项对齐**：`realAuth.ts` 已把 `INVALID_PHONE / USER_EXISTS / USERNAME_TAKEN / INVALID_USERNAME / WEAK_PASSWORD / PASSWORD_MISMATCH / CODE_INVALID_OR_EXPIRED / USER_NOT_REGISTERED / BAD_CREDENTIALS / SESSION_INVALID / CREDENTIALS_NOT_SET / CREDENTIALS_ALREADY_SET / PNVS_NOT_CONFIGURED / PNVS_SEND_FAILED` 映射成中文提示；本后端返回同样错误码，前端无需改动即可显示正确文案。
3. **正式契约兼容路径**：本分支的短信商适配器、风控、会话逻辑与 D1 表结构与具体路由解耦；后续实现正式 `/api/v1/auth/phone/*` 时，复用同一套适配器与表，只需新增一层按正式字段（`account_type`、`display_name`、CSRF）翻译的 handler，不必重写短信与会话核心。招聘方真实认证同样留待正式契约那一步（当前测试后端与本分支一样只签发 `candidate`）。

不在本分支做：删登录页底部预览提示行（用户已定为后续单独一项，前端一律不动，故保留）；正式 `/api/v1` handler；招聘方短信认证；`main.tsx` 应用级会话恢复改动（realAuth 恢复仍只在登录页内做一次 `/me`，与现状一致）。

## 2. 新增文件一览

| 文件 | 说明 |
|---|---|
| `apps/web/functions/api/real-auth/[[path]].js` | Pages Functions 路由：发码、注册、短信登录、密码登录、首次设称呼密码、找回密码、`/me`、退出、`/health` |
| `apps/web/functions/_lib/real-auth.js` | 纯逻辑 + D1 存取：格式校验、发码风控、验码消费、会话哈希与过期、密码 PBKDF2 哈希 |
| `apps/web/functions/_lib/sms-provider.js` | 短信商适配器：PNVS 实现（SendSmsVerifyCode / CheckSmsVerifyCode，HMAC-SHA1 RPC 签名）与可替换接口 |
| `apps/web/d1/0004_hhba_auth.sql` | D1 迁移：用户表、发码事件表、验码事件表、会话表；**无验证码字段** |
| `apps/web/scripts/real-auth-pnvs.test.mjs` | 纯逻辑单测（node:test），不调短信商 |
| `docs/REAL_AUTH_PNVS_20261102.md` | 本文件 |

## 3. 接口清单（与 realAuth.ts 对应）

- `GET /api/real-auth/health` —— 不需 D1；只报 Secret 是否配齐，**不主动调 PNVS**（避免健康检查产生费用与副作用）。`pnvs_configured` 在 Workers 下指 Pages Secret 是否存在，不代表已实测发码成功。
- `POST /api/real-auth/{login,register}/send-code` `{phone}` —— 注册用途先判已注册（`USER_EXISTS`，与测试后端一致）；登录用途不预判存在性。
- `POST /api/real-auth/password/reset/send-code` `{phone}`
- `POST /api/real-auth/register` `{phone, code, username, password, password_confirm}` —— 唯一建号入口。
- `POST /api/real-auth/login` `{phone, code}` —— 验码通过但无账号时报 `USER_NOT_REGISTERED`（403），**绝不自动建号**。
- `POST /api/real-auth/login/password` `{username, password}` —— 5 次失败锁定 15 分钟。
- `POST /api/real-auth/set-credentials`（Bearer）—— 仅首次设置，已设置报 `CREDENTIALS_ALREADY_SET`。
- `POST /api/real-auth/password/reset` `{phone, code, new_password, new_password_confirm}`
- `GET /api/real-auth/me`（Bearer）—— 刷新保持会话的恢复接口；过期或已撤销报 `SESSION_INVALID`。
- `POST /api/real-auth/logout`（Bearer 或 body `token`）—— 撤销当前 token，之后 `/me` 失效。

风控数值：发码同手机号 60 秒冷却、1 小时 5 次；同 IP（仅存 SHA-256 哈希，不存原始 IP）1 小时 20 次；同手机号同 purpose 1 小时验码尝试超 10 次直接限流（`RATE_LIMITED`，429；前端目前无此码的中文映射，会原样显示码名，属已知待前端后续映射的小缺口，不改前端的前提下先如实返回）。
验码规则：必须先有 5 分钟内未消费的发码记录才调短信商验码；一次成功验码即消费该次发码，同一码不可复用；注册码、登录码、找回密码码 purpose 分开，互不通用。

## 4. D1 与绑定取舍：新增认证库，不复用指标库

**决定：新建 D1 数据库，Pages 绑定名优先 `HHBA_PNVS_AUTH_DB`、回退 `HHBA_AUTH_DB`，把 `0004` 迁移应用到该库。**

跟进说明（2026-11-03）：预览环境的 `HHBA_AUTH_DB` 已绑定 email-auth-phase1 库，不能覆盖，故本分支 handler 改为优先读 `HHBA_PNVS_AUTH_DB`、回退读 `HHBA_AUTH_DB`；新库 `hhba-pnvs-auth-20261103` 以 `HHBA_PNVS_AUTH_DB` 绑定到预览配置，原有三个预览绑定未动。

取舍理由：现有 `HHBA_METRICS_DB` 存的是设备级收藏与流量聚合数据，且其存取函数以 `HHBA_METRICS_SECRET` 门控；把手机号、密码哈希、会话哈希这些认证数据混进同一库，会扩大指标库泄露时的 blast radius，也让“指标数据”与“身份数据”的权限边界不清。单独认证库则：认证 Functions 只绑认证库，指标 Functions 不变；出问题时可单独轮换、单独审计。
代价：部署时需多建一个 D1 并多做一次迁移应用（见第 5 节）；handler 在 `HHBA_AUTH_DB` 缺失时明确报 `AUTH_DB_NOT_CONFIGURED`（503），不静默回退到指标库——静默回退正是会把两类数据混在一起的隐患，故不做。

表结构（`0004`）：

- `hhba_auth_users`：`phone` 主键；`username` 唯一（可空，供先短信登录后设称呼的账户）；`password_hash`（PBKDF2，见下）；`role` 固定 `candidate`；`created_at`、`last_login_at`、`failed_pw_attempts`、`pw_locked_until`。
- `hhba_sms_events`：发码事件，`purpose` ∈ register/login/reset；`status` ∈ sent/failed/blocked；`biz_id`（PNVS 返回）；`ip_hash`；`consumed`/`consumed_at`（成功验码消费标记）。**没有验证码列**。
- `hhba_auth_verify_events`：验码事件，只记成功与否与次数，**没有验证码列**。
- `hhba_auth_sessions`：`token_hash` 唯一（SHA-256）；`phone`；`created_at`、`expires_at`（24 小时）、`last_seen_at`、`revoked`。

## 5. Pages 需配的 Secret 与变量（仅名字，绝无值）

| 名字 | 类型 | 说明 |
|---|---|---|
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | Pages Secret | PNVS 调用凭证（RAM 用户密钥 ID）。**不要在聊天、代码、文档里出现它的值；已有密钥上限与旧密钥去向问题未在本分支解决，配之前须用户定夺。** |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | Pages Secret | 同上，密钥 Secret。Pages Secret 只在控制台配置，不进仓库。 |
| `ALIBABA_CLOUD_SECURITY_TOKEN` | Pages Secret（可选） | 仅当使用临时凭证时才配；长期密钥部署不配。 |
| `HHBA_SMS_PROVIDER` | Pages 变量（可选） | 默认 `pnvs`；设为其他值时本分支会明确拒绝发码（`PNVS_NOT_CONFIGURED`），不静默假发。 |
| `HHBA_AUTH_DB` | D1 绑定 | 新建的认证 D1 数据库绑定名，迁移 `0004` 应用到该库。 |

部署前检查清单（预览环境操作，不在本分支内做）：建 D1 → 应用 `0004` → Pages 项目绑定 `HHBA_AUTH_DB` → 配齐上面两个 Secret → 以 `VITE_HHBA_REAL_AUTH_ENABLED=1` 构建预览部署 → 先调 `/health`（应报 `pnvs_configured:true` 才继续）→ 再做真机发码测试。

本地验证方法（无 Secret、无 D1 时可做）：

```bash
# 纯逻辑单测
node --test apps/web/scripts/real-auth-pnvs.test.mjs
# 前端构建回归（本分支未改前端，构建应与基线一致通过）
cd apps/web && npm run build
```

D1 本地验证（有 wrangler 时，预览环境步骤，不在本分支内执行）：

```bash
npx wrangler d1 create hhba-auth
npx wrangler d1 execute hhba-auth --file=apps/web/d1/0004_hhba_auth.sql
npx wrangler pages dev apps/web --d1 HHBA_AUTH_DB=hhba-auth
```

## 6. 与 10 月 ECS 测试后端的差异（已核对，非疏漏）

- 密码哈希：测试后端用 Node `scrypt`；Workers 无 scrypt，本分支用 PBKDF2-SHA-256（10 万次），格式 `pbkdf2$100000$<salt>$<hash>`。两边用户库不互通，测试站老用户需在新库重新注册，属预期行为。
- 凭证来源：测试后端优先 ECS 实例角色、环境变量备用；Cloudflare 上无实例角色，本分支只读 Pages Secret 环境变量。
- 健康接口：测试后端探测凭证可用性；本分支只判断 Secret 是否存在，不调 PNVS（省费用、零副作用），故 `pnvs_configured:true` ≠ 已实测发码成功。
- 风控：测试后端通读未见发码冷却与验码次数上限；本分支新增（数值见第 3 节），属本次任务明确要求。
- 会话：沿用测试后端 24 小时有效期、token 只存哈希、登出撤销；未采纳“7 天滑动”建议（未经用户确认，不擅自放宽）。
- 收藏：测试后端的账号级收藏（`favorites` 表）未搬运；Pages 现有设备级收藏（`HHBA_METRICS_DB`）不受影响，两者合并属后续事项。

## 7. 已知未完成项与下一步（push + PR 前需用户过目）

1. **未推送、未开 PR**：本分支仅本地 commit；推送与 PR 须用户过目改动摘要与测试结果后才做（仓库既定规则）。
2. **未实测 PNVS 发码/验码**：本地无 Secret、无 D1，真实发码、错码、过期码、重复用码的端到端验证必须在配好 Secret 的预览环境做；本分支不声称“已发码成功”。
3. **未做 D1 实测**：`0004` 未在真实或本地 D1 上执行过；预览部署前须先执行第 5 节的 D1 步骤并确认建表成功。
4. **未配 Secret / 未解决密钥上限**：RAM 用户已有密钥上限与旧密钥去向问题待用户定夺；本分支代码里只有占位名。
5. **前端小缺口**：`RATE_LIMITED`（429）尚无前端中文映射；预览提示行删除、正式 `/api/v1` 适配、招聘方认证、应用级会话恢复（`main.tsx`）均留待后续单独事项。
6. **未做安全渗透测试**：上述安全测试清单（新号真注册、老号登录、错码/过期码/重复用码、短时间重发受限、刷新保持会话、退出失效、越权、库里查到真记录、原模块无回归）须在预览环境逐项执行。
7. **域名未接**：`hhba.work` 绑定与 DNS 切换与本分支无关，Cloudflare 登录 OIDC 问题未解决前保持阻塞，不在本分支内处理。
