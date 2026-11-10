# HHBA 品牌邮件 V1：双向自动回信接入说明（2026-11-10）

## 范围与设计锁定
- 保留用户确认的 V1：蓝橙 Logo、原版三人协作横幅、Slogan「让机会与人才，找到彼此。」。
- 不采用 V2 新图片。正式静态资源放在 apps/web/public/images/email/；HTML 引用 https://hhba.work/images/email/ 的 HTTPS 绝对地址。
- 申请人的称呼和合作方向来自真实表单，服务端对 HTML 进行转义。
- 简历只作为内部通知附件，不转发到申请人确认邮件。
- 不承诺确定的回复时限，不自动发送合作邀请、录用或拒绝邮件。

## 网站合作申请：随 Cloudflare Pages 代码发布自动生效
POST /api/join-apply → 校验/限流 → D1 保存申请 → Resend 发送给负责人 V1 内部通知 → Resend 发送给申请人 V1 收件确认。

- 负责人来自生产环境 JOIN_OWNER_EMAIL；API Key 来自 RESEND_API_KEY；发件地址来自 JOIN_FROM_EMAIL。绝不把真实邮箱或密钥硬编码进代码。
- 内部通知的 reply_to 为申请人邮箱；外部确认信的 reply_to 为负责人 Gmail，确保用户直接回复能联系到负责人。
- 两封邮件分别用基于申请记录编号的 Idempotency-Key，避免同一网络重试重复发送。
- HTML + 纯文本版本同时发送；确认信不含简历内容或其他隐私字段。
- 如果内部通知失败，保持原错误提示；外部确认邮件失败时，保留已成功接收申请的状态并返回 confirmation_sent:false 供排查。
- 测试：node --test apps/web/scripts/hhba-email-templates.test.mjs。
- 生产验收：验证图片 URL 200 → 填写明确标注的测试申请 → 核实负责人 Gmail、申请人邮箱及 Resend 记录 → 清理测试数据，不碰真实申请记录。

## 直接发送到 Gmail 的来信（需邮箱所有者授权）
脚本路径：integrations/gmail/hhba-v1-autoack.gs。

注意：Gmail 脚本不会因 GitHub PR 合并而自动安装。需要在 https://script.google.com/home/projects/create 创建项目，粘贴脚本内容并保存，选择 hhbaInstallAutoAcknowledgement 函数运行并通过 Google 授权；请确认登录的是接收 HHBA 来信的那个 Gmail 账号。

脚本会记录启用时间并且只处理此后的新邮件；添加「HHBA/已自动回执」标签；以每 5 分钟一次的定时触发器扫描；跳过自动回复、邮件列表、退信、验证码、垃圾邮件、自己发出的消息以及已经处理的会话；仅回应含 HHBA、汇方、合作等业务关键词的直接来信，避免自动回复私人 Gmail 中的无关邮件；同一会话最多确认一次，每次最多十封，每天最多二十五封。

停止方式：运行 hhbaStopAutoAcknowledgement 或删除定时触发器。

脚本在 Gmail 自身权限和限额内运行，不能作为实时毫秒推送。**在邮箱所有者明确授权并实际测试前，不要声称 Gmail 直接来信自动回复功能已经启用。**

## 人工决定的后续回复
V1 另外保留初次确认、邀请进一步交流和暂不合作三类模板。只有收件确认是自动发送；邀请与拒绝必须先由负责人审阅决定。发送时沿用 V1 的 Logo、照片、品牌名称、Slogan 和兼容邮件客户端的 600px 桌面/手机自适应 HTML 布局。

## 安全
- 不向 GitHub 写入任何真实申请简历、个人 Gmail API Token 或 Resend API Key。
- 公开图片不含私密个人资料，邮件正文仍能在禁图模式阅读。
- 邮件投递提交成功不能保证对方邮箱一定在主收件箱展示。
