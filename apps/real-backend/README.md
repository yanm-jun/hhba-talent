# HHBA 测试真实认证后端（real-backend）

本目录是阿里云测试站真实登录接线的源码级回填，不是正式后端。正式后端在 `apps/api`，本次回填未改动它。

## 来源与定位

- 来源：ECS 测试站的测试包后端（`/srv/hhba-test-login/real-backend/`，与 Docker 卷现行代码经 diff 一致），此前不在本仓库中。
- 本目录不是测试包原始文件的逐字节副本：原始文件为紧凑长行，本目录是按已核对契约重写的可读实现，接口、校验与错误码与测试包一致，见下文“与测试包的差异”。
- 原始文件仍保留在测试站；不要把测试站的 `test.db`（可能含用户数据）提交进仓库。

## 文件

- `server.mjs`：`/api/real-auth/*` 的 HTTP 服务（Node 22+，`node:http`、`node:crypto`、`node:sqlite`，无外部依赖）。
- `pnvs.mjs`：阿里云 PNVS 短信验证码客户端（发码与验码）。
- `README.md`：本说明。

## 测试部署映射

测试站 Caddy 配置（`/srv/hhba-test-favorites/test-Caddyfile`，现 338 字节）为：

- `/api/real-auth/*` 反向代理到 `test-real-auth:4000`（即本服务）；
- `/auth`、`/candidate/login`、`/candidate/register` 等页面不再由后端静态页接管，改由前端 SPA（`try_files` 回退）处理；前端路由已覆盖这些路径。
- 前端真实认证分支只在构建时开启 `VITE_HHBA_REAL_AUTH_ENABLED='1'` 时激活，且只用于求职者；测试站构建产物本身无条件调用 `/api/real-auth/*`，这是有意差异，见前端 `realAuth.ts` 的注释。

## 运行

```sh
node server.mjs
```

- 端口默认 `4000`，可用 `HHBA_REAL_PORT` 覆盖。
- 数据库默认 `./test.db`，可用 `HHBA_REAL_DB` 覆盖；不要硬编码测试站的 `/app-real/test.db`。
- 语法检查：`node --check server.mjs`、`node --check pnvs.mjs`。
- 健康检查：`GET /api/real-auth/health`。

## 接口

除健康接口外，所有接口均以 `/api/real-auth` 开头；需要登录的接口用 `Authorization: Bearer <token>`。

| 方法与路径 | 说明 |
| --- | --- |
| `GET /health` | 健康与 PNVS 凭证可用性，见下文 |
| `POST /register/send-code`、`POST /login/send-code`、`POST /password/reset/send-code` | 发码，用途分别为 `register`、`login`、`reset` |
| `POST /register` | 短信注册，请求体 `{phone, username, password, password_confirm, code}`，角色固定为 `candidate` |
| `POST /login` | 短信登录，请求体 `{phone, code}`；无账号不自动建号 |
| `POST /login/password` | 密码登录，请求体 `{username, password}`（仅称呼，不含手机号） |
| `POST /set-credentials` | 已登录用户首次设置称呼与密码 |
| `POST /password/reset` | 密码重置，请求体 `{phone, code, new_password, new_password_confirm}` |
| `GET /me` | 当前会话用户信息 |
| `POST /logout` | 登出，令牌取请求体 `token` 或 `Authorization` |
| `GET /sessions`、`POST /sessions/revoke`、`POST /sessions/revoke-all` | 会话列表、撤销单个会话、撤销全部会话 |
| `GET /favorites`、`POST /favorites` | 收藏查询与新增，请求体 `{job_id, title?, company?}` |

## 校验与错误码

- 手机号：`1[3-9]` 开头 11 位，否则 `INVALID_PHONE`。
- 称呼：先 `trim`，2-20 位，首字符字母或中文，其余字母、数字、下划线或中文，否则 `INVALID_USERNAME`；被占用为 `USERNAME_TAKEN`。
- 密码：8-64 位，且同时含字母与数字，否则 `WEAK_PASSWORD`；两次不一致为 `PASSWORD_MISMATCH`。
- 验证码：无记录、已使用、已过期或 PNVS 校验失败均为 `CODE_INVALID_OR_EXPIRED`。
- 注册时手机号已存在为 `USER_EXISTS`；短信登录无账号为 `USER_NOT_REGISTERED`；密码错误为 `BAD_CREDENTIALS`；会话无效为 `SESSION_INVALID`。
- 密码登录 5 次失败锁定 15 分钟；无用户时也用哑哈希校验一次，避免通过耗时区分账号是否存在。
- 密码以 `scrypt` 存储，格式为 `scrypt$盐$摘要`；会话令牌为随机 32 字节十六进制，库中只存其 SHA-256 值，有效期 24 小时。
- 验证码由 PNVS 生成，后端不生成、不存储验证码原文；发码记录只保存过期时间与发送状态。

## 健康与 PNVS 凭证

`GET /api/real-auth/health` 返回：

```json
{
  "ok": true,
  "service": "hhba-test-real",
  "pnvs_configured": true,
  "pnvs_credential_source": "instance-role",
  "pnvs_credential_role": "<角色名>",
  "pnvs_credential_expires_at": 1793202498000,
  "sms_provider": "pnvs",
  "sms_sign_name": "恒创联众",
  "sms_template": "100001",
  "sms_status": "pnvs_gift_sign_template_only_register_login_reset",
  "demo_login": "disabled_in_test_caddy"
}
```

- `pnvs_configured` 按凭证可用性报告，不是只看环境变量是否存在。
- 凭证优先级：ECS 实例元数据临时凭证优先（`http://100.100.100.200/latest/meta-data/ram/security-credentials/`，2000 毫秒超时，过期前 300000 毫秒缓存失效），失败回退环境变量 `ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET`（可选 `ALIBABA_CLOUD_SECURITY_TOKEN`）。
- 健康接口只返回凭证来源、角色与过期时间，不返回凭证本身。
- 发码失败时返回 503，`sms_codes` 会写一条 `sms_status` 为 `blocked_no_pnvs_credentials`（无凭证）或 `pnvs_send_failed` 的记录。

## 与测试包的差异（有意为之）

- 本目录是可读重写，不是逐字节副本；原始紧凑长行文件仍在测试站。
- 数据库路径：测试站为 `/app-real/test.db`，本目录默认 `./test.db`（`HHBA_REAL_DB` 可覆盖）。
- 前端门控：测试站构建产物无条件调用 `/api/real-auth/*`；本仓库前端仍保持正式静态预览的门控行为，需 `VITE_HHBA_REAL_AUTH_ENABLED='1'` 才走真实认证分支。
- 收藏与会话的最小实现：会话列表只返回 `created_at`、`expires_at`、`revoked`；收藏只实现查询与新增（重复新增按 `phone + job_id` 更新标题与公司）。

## 未回填 / 未确认项

- 收藏的 `PUT` / `DELETE` 语义、会话列表的完整返回字段、登出语句的完整 `WHERE` 写法、密码锁定更新语句的完整字段顺序、`checkCode` 的原始内部顺序、重置发码的全部细节，在核对时未完整确认，本目录按已核对契约实现最小可用版本，未凭推测写入原始细节。
- 测试站 Caddyfile 本身属于部署配置，不作为前端源码提交；其路由语义见上文“测试部署映射”。
- 测试前端构建产物（`index-*.js`）不提交进源码目录；前端回填只提交源码（`realAuth.ts` 与 `PhoneAuthPage.tsx`）。
- 应用级会话恢复未改动 `apps/web/src/main.tsx`（该文件 `App` 为单行长行且绑定正式会话恢复，改动风险大）；真实认证的会话恢复只在 `PhoneAuthPage` 内做一次 `/me` 恢复。
