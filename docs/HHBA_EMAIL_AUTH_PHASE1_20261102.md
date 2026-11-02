# HHBA 第一阶段：邮箱登录验收与生产上线门槛

## 范围
- 以 `yanm-jun/hhba-talent` 最新 main 的招聘市场修复提交 `f5588049d3baef9a1740f1176052adb72659db74` 为基础。
- 独立分支 `feature/cloudflare-email-auth-phase1-20261102`，仅提交邮箱注册登录、邮箱验证、密码重置、双角色会话功能。
- 保留截图已确认的白色卡片、HHBA Logo、身份切换栏、绿色按钮；求职者和招聘方使用邮箱密码，不开放手机短信。
- **本阶段明确不包含 /join、投递简历、岗位发布、企业认证功能。**

## 服务端设计
- Cloudflare Pages Functions 在 `/api/v1/auth/*` 提供注册、登录、退出、会话查询、验证码验证/重发与找回密码。
- 独立 D1 测试库 `hhba-email-auth-phase1-preview-20261102`：仅 `auth_users`、`auth_roles`、`auth_sessions`、`auth_rate_limits`、`auth_email_challenges`。
- 邮箱地址不按 QQ、163、126、Gmail、Outlook 或企业域名设置限制；正常邮箱注册**必须先证明邮箱控制权**。
- 密码采用 Cloudflare Workers 支持的 PBKDF2-HMAC-SHA256 100,000 次上限；生产端必须叠加服务器私有的 HMAC-SHA256 密钥（pepper），且不得丢失或放入 Git/前端。会话使用 HttpOnly、Secure、SameSite=Lax Cookie，数据库只存令牌哈希；退出要求 CSRF 校验。
- 验证码 HMAC-SHA256 哈希、10 分钟过期、最多 5 次错误尝试、单次使用；密码重置撤销旧会话。
- 虚拟测试域名必须同时满足 `HHBA_AUTH_ROLLOUT=preview` 及 `HHBA_AUTH_ALLOW_TEST_EMAIL=1` 才允许跳过真实收件验证；正式环境拒绝该类地址。
- `GET /api/v1/auth/status` 安全返回邮件配置状态；缺发信服务时浏览器禁用真实邮箱注册，后端也返回 503，不收取注册密码。

## 预览配置
- Cloudflare Pages Preview 必须绑定 `HHBA_AUTH_DB` 指向独立 D1 测试库。
- `HHBA_AUTH_ROLLOUT=preview`、`HHBA_AUTH_ALLOW_TEST_EMAIL=1`、`VITE_API_BASE=/api/v1`、`VITE_HHBA_ACCOUNT_AUTH_ENABLED=1`。
- `VITE_HHBA_ACCOUNT_API_ENABLED=0`、`VITE_HHBA_PHONE_AUTH_ENABLED=0`、`VITE_HHBA_VERIFIED_SNAPSHOT=1` 保持其他后台关闭并保留招聘市场数据模式。
- 正式网站不得绑定预览数据库，不得设置 `HHBA_AUTH_ROLLOUT=production`，也不得启用真实邮箱注册标记。生产还必须有 `HHBA_AUTH_PASSWORD_PEPPER` 长度至少 32 的独立 Secret，预览 DB 不迁移至生产。

## 真实邮箱激活还需要用户授权
1. 一个可管理 DNS 的发件域名（如用户已经拥有的域名）。不是用户接收申请的 Gmail 地址，不要提供 Gmail 密码。
2. 在 Cloudflare Email Sending（符合套餐要求）或 Resend 上验证发件域名及 SPF/DKIM；获取发送绑定或专用 API key。
3. 仅在 Cloudflare 的服务器端配置 `HHBA_MAIL_FROM`、`HHBA_AUTH_CODE_PEPPER`（至少 32 字符、独立随机 secret）、`HHBA_AUTH_PASSWORD_PEPPER`（另一份独立至少 32 字符的 secret，须安全备份）、`RESEND_API_KEY`（secret）或 `EMAIL` binding。
4. 真正发送一封测试验证码至 QQ、163 和 Gmail，并逐项验收注册、收信、验证、登录、角色隔离、退出、密码重置、旧会话失效和邮件退信处理。
5. 开放生产前还要完成机器人滥用保护（如 Cloudflare Turnstile 服务端验证）、日志敏感数据审计、独立正式 D1 备份与合规隐私说明。

## 当前结论
- 代码与自动化模拟邮件功能可以先测试；真实 Cloudflare D1 接口测出过 PBKDF2 310,000 次超出 Workers 100,000 的兼容性限制，已将单次迭代修为 100,000 并增加生产强制 pepper，需复测真实服务。
- 未配置发信域名及提供商凭证前，**不能声称 QQ、163 或 Gmail 已实际收到邮件，也不能开放正式用户注册**。
- 只有用户验收 PR 和 Cloudflare 预览后，才有资格合并 main；正式认证开关需要再次独立确认。
