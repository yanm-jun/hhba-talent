# 加入我们邮箱接入（2026-11-03，待配发信密钥与收件邮箱后才可真发）

## 表单规格（用户 2026-11-03 定）
- 第 1 步必填：称呼、邮箱（类别只有邮箱）、合作方向（7 方向 + 自荐）。
- 第 2 步必填：相关技能和项目经历至少 10 字；选填：想解决的问题、简历 PDF/Word（不超过 10MB）。
- 第 3 步必填：每周投入、合作方式、勾选已理解筹备阶段说明。
- 预览后点“提交合作意向”才真正提交；提交成功显示“已收到”。

## 链路
前端 JoinUsPage（multipart FormData，含简历文件）
  -> Pages Function POST /api/join-apply（apps/web/functions/api/join-apply.js）
  -> 校验（邮箱格式、方向/每周/方式白名单、长度、简历类型与大小、勾选）
  -> 限流（同 IP 每小时最多 5 次）
  -> D1 hhba_join_applications 存申请记录（迁移 d1/0005_hhba_join.sql，简历文件本身不入库）
  -> Resend API 发邮件给负责人，回复地址 = 申请人邮箱，简历随邮件发附件

## 上线前必须由负责人做的两步（代码里绝不写邮箱与密钥）
1. 在 Resend 建账号并建 API 密钥；如需用 hhba.work 发件，先在 Resend 做域名验证（加 DNS 记录），否则先用默认发件人 onboarding@resend.dev 测试。
2. 在 Cloudflare Pages 项目里配环境变量（生产与预览分开配，密钥用 secret_text）：
   - JOIN_OWNER_EMAIL：负责人收件邮箱
   - RESEND_API_KEY：Resend 密钥
   - JOIN_FROM_EMAIL（可选）：发件人，默认 onboarding@resend.dev
   并在已绑定的 D1（生产 HHBA_PNVS_AUTH_DB，复用该库）上跑 0005 迁移建表。
   未配齐时接口返回 EMAIL_NOT_CONFIGURED，前端显示“申请通道尚未完成邮箱配置”，不会假装成功。
