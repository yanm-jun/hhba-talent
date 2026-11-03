# HHBA 私有简历库部署与隐私门槛（2026-11-03）

分支：`feature/private-resume-r2-phase2-20261103`，PR #202。此时**尚未合并 main**。
原个人工作台位置：`/candidate/account/resume`。

## 本轮已完成代码

- 仅当前真实 PNVS 求职者可查看、上传、下载、删除自己的简历。客户端不能指定其它手机号。
- PDF / DOCX 基础结构与格式校验、3 MiB 上限、同账户最多 3 份、近 24 小时上传 15 次上限、SHA-256 防重复。
- 后端直接向私有 R2 写入原始文件，仅将元数据、独立存储授权版本和授权时间写入 D1（`0007_private_resumes.sql`）。
- 客户端必须单独勾选本次私有保存授权；**不因上传而调用 DeepSeek、发送企业或公开到 CDN**。
- 下载强制 `Content-Disposition: attachment`、`application/octet-stream`、`nosniff` 和不缓存；未获授权返回 401/403/404。
- 删除先移除 R2 私有对象，后删除当前账户的 D1 元数据；操作失败不会回退到公开目录或设备模拟存储。
- **R2 未接通即全部失败关闭（503）**；UI 显示存储不可用，隐藏上传动作，已有真实手机号账户不受影响。
- 上传文件没有进行企业分享、自动 AI 分析，也没有宣称已通过病毒扫描。本阶段不支持在线预览不可信文档。

## 实际 Cloudflare 基础设施审计

2026-11-03，账户 R2 API 返回 HTTP 403 / code 10042：`Please enable R2 through the Cloudflare Dashboard.`。此前 Pages 的 production / preview R2 bindings 均为空。

**账户所有者必须先做的一步**：登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，选择当前 HHBA 账户，进入 **R2 Object Storage**，按页面提示启用 R2（如要求配置账单/支付方式，由所有者自行操作）。不要在聊天中发送密码、密钥、支付信息。随后可继续通过已有 Cloudflare 连接完成以下配置。

## 解锁后需要的资源（尚未创建）

1. 创建 `hhba-private-resumes-prod` 和 `hhba-private-resumes-preview` 两个**独立的私有 R2 bucket**，不打开 r2.dev 开发 URL、不配置公开自定义域名。
2. Pages 项目 `hhba-talent` 的 `deployment_configs.production.r2_buckets.HHBA_PRIVATE_RESUMES` 绑定生产桶；`preview` 绑定独立测试桶。不允许混用。
3. **预览 D1** `HHBA_PNVS_AUTH_DB` 已完成独立 `0007` 迁移（原有预览用户数 0→0）。生产 D1 **尚未执行 `0007`**；在生产用户数据备份/检查点后才执行增量迁移，不删除已有账号、会话和短信记录。
4. 验证 PR 自动化测试、Pages 预览构建、匿名 401、A/B 账户不可交叉读取、真实上传/下载/删除、R2 存储 Key 只能在服务器端使用。
5. 验收后合并 `main`、等待生产 Pages 部署 success，并从 `hhba.work/candidate/account/resume` 实际验证。

## 隐私与运营边界

- **仅授权私有保存**，不等于对外展示、AI 分析或企业自动投递的授权，后续需单独同意。
- 用户可以在已登录的工作台删除当前私有文件及数据库记录。D1/R2 的历史备份、法定留存、账号注销/完整数据删除流程仍需运营主体确定正式保留期与申诉渠道，不能声称瞬间清除所有历史备份。
- 文档基础结构验证不代表文件杀毒；在开放雇主下载/第三方分享之前必须增加扫描与明确的分享授权，避免把未扫描简历转给其他主体。
- 这里不是正式隐私政策法律文本。平台运营主体、联系渠道、存储区域、跨境传输、注销及备份清理制度仍需核实后发布。

## 自动化测试

`apps/web/scripts/private-resumes.security.test.mjs`：匿名与伪造 token 拒绝、隔离 A/B 账户、明确保存授权、恶意来源、格式伪装、PDF/DOCX 校验、非法 DOCX 宏/目录穿越、重复文件、容量限制、每日上传上限、附件下载及物理删除。另执行已有 PNVS/真实账户回归和 Vite build。

**严禁在 R2 尚未启用时将本次功能标记为正式上线成功。**
