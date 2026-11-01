# HHBA Cloudflare D1 双端登录：隔离测试版

## 部署范围
- 分支：`feature/cloudflare-d1-dual-role-auth-20261101`，未验收前不合并 `main`。
- Cloudflare Pages 项目：`hhba-talent`；D1 测试库 `hhba-auth-preview-20261101`。
- D1 binding：仅 **preview** 配置 `HHBA_AUTH_DB`，生产不绑定。
- Preview 环境变量：`HHBA_AUTH_ROLLOUT=preview`、`VITE_HHBA_ACCOUNT_AUTH_ENABLED=1`、`VITE_API_BASE=/api/v1`。
- 生产环境 `VITE_HHBA_ACCOUNT_API_ENABLED=0`，尚无真实登录，不得宣称线上开放。
- 当前测试只允许 `@example.test`、`@example.invalid` 邮箱（明确非真实邮箱，不做邮件所有权认证）；**禁止真实用户输入个人信息或复用真实密码**。

## 已有能力
1. 求职者与招聘方默认在 `/candidate/login` 和 `/recruiter/login` 显示截图统一样式的邮箱密码页面，各自在数据库中持有 `candidate`、`recruiter` 角色。
2. 身份数据库核验和隔离；求职者账号不能作为招聘方登录，反之亦然。
3. PBKDF2-SHA256（每用户随机盐，310000 次）、D1 凭证持久化。
4. 密码不会放在前端存储；Cookie 为 HttpOnly、Secure、SameSite=Lax，服务端只存令牌 SHA-256，期限 7 天；敏感改动需 Origin、CSRF。
5. 基于 IP 与邮箱哈希的限流；账号注册登录、恢复会话、退出登录。
6. 预览登录接口开放 `/api/v1/auth/register`、`/api/v1/auth/session`、`/api/v1/auth/me`；其他未实现接口继续返回受控错误。

## 未开发，不得当成已上线
- 邮件验证、找回密码、真实手机号 / 阿里云短信。
- 企业工商主体真实性、经办人资格、企业认证审核、招聘职位发布及实际求职投递。
- 文件/简历存储、审核与恢复、正式隐私合规流程。
- 跨身份角色升级与管理员角色审批。
- 安全生产上线前需要安全测试、验证码/反机器人保护、邮箱所有权校验、监控与审计日志、D1 备份策略、异常限流与账号恢复。

## 测试步骤
1. Cloudflare Pages 分支预览构建成功，确认 Functions 打包成功，`HHBA_AUTH_DB` 绑定至预览 D1。
2. 从 `/auth` 进入求职者或招聘方的 `/candidate/login` 或 `/recruiter/login`，直接呈现邮箱密码输入框；切换身份、Logo、绿色按钮及卡片尺寸与原手机登录页一致。
3. 使用 `candidate01@example.test` 或 `recruiter01@example.test` 等测试邮箱，设置 **仅用于测试** 的随机密码。
4. 注册并登录，刷新页面应恢复同一会话，退出后 `/api/v1/auth/me` 应变为 401。
5. 将求职者账号切换招聘方登录，必须返回 403；相反方向同样检查。
6. 不允许 `@gmail.com` 等真实邮箱进行预览注册（返回 403）。
7. 所有测试账号只是开发沙盒，不用于生产、不进行实际招聘运营。
8. D1 数据不会自动转移到未来生产库；生产启用必须在另一个独立数据库与真实邮箱验证、阿里云短信完成后批准。

## API 合约
`POST /api/v1/auth/register` body: `{email, password, display_name, account_type}`；
`POST /api/v1/auth/session` body: `{email, password, account_type}`；
`GET /api/v1/auth/me` 返回用户角色与 csrf_token；
`DELETE /api/v1/auth/session` 需携带请求头 `X-CSRF-Token`。

Cloudflare Pages Functions 根据 `apps/web/functions/api/v1/[[path]].js` 处理路径；生产部署继续使用静态站构建命令，但生产账户开关不变，不能直接将此 PR 作为“上线真实登录”的授权。
