# HHBA 实际邮箱注册与 /join 负责人邮件投递（2026-11-01）

## 交付现状
- 开发分支：`feature/hhba-real-email-and-join-20261101`。
- 本 PR 基于 PR #183（Cloudflare D1 双身份邮箱登录）进行叠加；必须先验收 #183，再合并本 PR，**未经明确同意不合并 main**。
- 实际收件箱固定为：**mingjunyan94@gmail.com**，从服务器发送通知，`Reply-To` 可指向申请人自愿填写的邮箱。
- 可接受的注册邮箱包括：`qq.com`、`163.com`、`126.com`、`gmail.com`、`outlook.com`、`foxmail.com`、`sina.com`、`sohu.com` 及其他有效企业邮箱。**不是邮箱厂商名单白名单**。
- 没有邮件服务时，`@example.test`/`@example.invalid` 仍仅用于隔离测试；真实注册拒绝并显示原因，不虚报验证邮件已发送。

## 邮箱注册、密码恢复
- D1 数据库增加 `auth_email_challenges` 表，六位随机验证码、HMAC-SHA256 服务端密钥哈希、10 分钟过期、最多五次尝试、成功后单次使用。
- 注册真实邮箱时要有发送服务，先创建未验证账号、发送验证码。只有完成验证才可登录，不自动赋予招聘方企业认证权限。
- 支持重新发送注册验证码；密码找回邮件不暴露账户是否存在，成功后使已有所有会话失效。
- 邮件凭证及验证码签名 Pepper 只作为 Cloudflare 服务器环境 Secret 存储，不能写入公开代码和 `VITE_*` 浏览器变量。
- 预览中测试虚拟邮箱无需真实邮件投递，绝不能用测试账户作为邮件所有权证明。

## /join 合作/团队申请
- 保持现有三步页面和岗位信息，不改首页整体布局。
- 申请人主动选择方向、填写经历、联系方式、作品 URL、投入时长及合作意向。
- 必须勾选创业阶段确认和独立的个人信息使用同意。
- `GET /api/v1/join/applications` 返回服务器配置就绪与否，不返回密钥；未配置发件服务时前端不允许正式提交。
- `POST /api/v1/join/applications`：同源校验、有效字段校验、内容长度上限、针对 IP 哈希的小时限流、D1 插入申请编号、通过服务端向指定邮箱发送通知。成功仅指邮件提供商接受发送请求，不保证邮件最终到达收件箱。
- provider 拒绝时数据库状态标记为 `failed` 并返回 HTTP 503，不显示“成功投递”。已记录申请的管理员邮件重试需要后续专用受控接口或定时任务，**当前未自动实现重试和管理员后台**。
- 当前暂不支持简历附件上传：只接受可选公开 HTTPS 作品链接，避免把隐私文件直接当邮件附件。
- 申请数据库 `join_applications`、`join_rate_limits`；生产隐私保留期限、查看/删除权限、管理员鉴权以及可靠递送/重试必须在真实收件开放前验收。

## 还需用户提供/授权（不要提供 Gmail 密码）
1. 选择用于发送邮件的**自己控制的域名**，例如自己的企业域名（不是 `gmail.com` 或 `pages.dev`）。
2. 推荐使用 Resend 或其他可验证域名的发件商。按服务商提示在 DNS 配置 SPF/DKIM 等记录并验证。此 Cloudflare 账户目前没有托管 Zone，原生 Email Domain API 暂不可用；不能把 `pages.dev` 冒充已验证发件域名。
3. 将 Cloudflare Pages **Preview** 环境配置以下服务端变量：
   - `HHBA_MAIL_FROM`：已验证的发件地址（如 `notifications@yourdomain.example`）。
   - `RESEND_API_KEY`：只在 Secret 中设置；如果使用 Cloudflare 原生邮件则改用 `EMAIL` send binding。
   - `HHBA_AUTH_CODE_PEPPER`：至少 32 字符的独立随机 Secret，只在服务端设置。
   - `HHBA_JOIN_INTAKE_ENABLED=1`：前几项都实际验证通过后启用。
   - `VITE_HHBA_JOIN_API_ENABLED=1`：仅预览版开放 /join 的就绪检查，真实申请按钮仍受服务端就绪状态保护。
4. 检查收件 Gmail 的垃圾邮件/规则，完成管理员人工验收：接收申请、邮件 Reply-To、申请编号与数据库状态一致。
5. 审核隐私说明及申请资料删除/保留策略；另外设计生产数据库和权限，不能把测试数据库当正式数据库。

## 验证
- CI：`node --test scripts/auth-api.contract.test.mjs scripts/email-join.contract.test.mjs scripts/real-email-auth.contract.test.mjs`
- 前端：`npm run build`
- Cloudflare Preview 静态构建与 Functions 绑定检查。
- 真实 Gmail 投递的端到端确认**需要真实发信域名、provider 凭证和用户核对收件箱**，当前未完成，不得宣称已寄达。
