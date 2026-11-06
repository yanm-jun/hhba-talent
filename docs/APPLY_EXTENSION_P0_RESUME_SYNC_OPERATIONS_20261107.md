# HHBA P0 已有简历安全同步 · PR #273 操作与验收（2026-11-07）

## 交付范围与准确描述

前置 PR #272 仍未合并；本分支基于 PR #272 的 HEAD 开发，最终必须按顺序验收，不能把 PR #273 当作独立于 #272 的补丁。

已提交：
1. 用户在 HHBA 个人中心「一键网申」选择 **已有、本人已授权保存到 R2 的 DOCX/PDF** 文件。
2. DOCX 原始字节在 **HHBA 网页当前浏览器内存中** 经格式、大小、ZIP 文件列表、解压长度校验，并从 `word/document.xml` 提取文字；简历文字不传第三方 AI。
3. 仅根据明确标注的字段和章节形成保守建议。姓名、学位、年限等缺乏可靠证据时留空。用户逐项确认并可自行修正。
4. 网站端有「资料真实性核对」和「向已配对插件一次性同步」两个未预勾选的确认。
5. 服务端只接收经确认的结构化字段，校验用户登录、候选人角色、原文件归属、是否有已配对的短期插件会话，再用 Cloudflare **Secret** `HHBA_APPLY_PROFILE_TRANSFER_KEY` AES-256-GCM 加密，并保存到独立 D1 数据表 `hhba_apply_profile_transfers`。
6. 五分钟有效，同一用户专属，扩展端验证已配对的 origin、受限会话与候选人角色；原子一次性领取后立刻删除密文。插件领取前再次主动勾选同意，覆盖旧资料时再提示一次。
7. 网站「撤销」删除待领取资料；用户撤销全部插件会话时附带取消待领取任务（未迁移数据库时原有会话撤销仍可用）。
8. 自动化测试包含 AES 机密性、越权拒绝、原子防重复领取、过期与撤销、DOCX 压缩文件读取、敏感字段缺省、旧网页与 Chromium 表单回归。

**尚未完成 / 不得对外宣称**：
- PDF 自动文字提取。PDF 在此阶段只支持人工填写确认字段后同步；不支持 OCR，也不假装从 PDF 推断资料。
- Cloudflare **生产**数据库迁移、生产密钥、商店稳定 ID、商店上架、真实站点部署、真实跨端用户验收。
- 不自动投递、不自动点击验证码或隐私声明、不将原始 PDF/DOCX 复制给插件或 DeepSeek、不启用付费扣次。
- D1 过期密文的定时物理清理尚未上线：到期不可领取，临时密文可能留存到下一次清理或主动撤销。正式上线前必须添加定期清理调度及披露最长期限。

## 上线前的隔离 Preview 操作

1. 在 Cloudflare Pages `hhba-talent` 中确认 `main` 仍是生产分支，Preview 自定义分支名单保留其他分支；此开发分支仅用于 Preview。
2. 分别核对 `HHBA_PNVS_AUTH_DB` 的 Preview 和 Production 绑定，确认是**不同** D1 数据库。禁止猜测数据库 ID 或使用生产库测试。
3. 对 Preview D1 制作 Time Travel 恢复点，按现有成功安装过的 `0009-0013` 之后，**只对 Preview** 执行 `apps/web/d1/0014_apply_profile_sync.sql`，核查表、主键、索引。
4. 在 **Preview** 环境安全配置随机 32 字节密钥（64 位十六进制字符串）`HHBA_APPLY_PROFILE_TRANSFER_KEY`。必须使用加密 Secret，不可放在源码、仓库、公共日志、环境变量明文截图或对话里；不能复用 DeepSeek/支付宝/配对密钥。
5. 只有已通过审核的稳定扩展 ID 与成对配置的 `HHBA_APPLY_EXTENSION_ID` 才能访问插件专属接口。现有 Preview 同步开关仅在**同时具有有效配对配置和加密密钥**时启用，无配置一律拒绝，网页显示「暂未完成部署配置」。
6. 使用测试候选人和虚构测试 DOCX 在 Preview 完成端到端：保存到隔离的 Preview R2 → 网页读取核对 → 授权 → 插件再次同意 → 领取 → 页面可编辑 → 再次领取失败 → 过期失败 → 不同账号失败 → 撤销失败关闭。不要使用真实用户私人简历进行外部模型联调。
7. 依次验收移动浏览器页面提示和 Chrome/Edge 插件打开流程。准备商店审查版 ZIP、政策、隐私、权限用途和稳定插件 ID；CI 的 ZIP 是测试件，不是已审核的正式安装包。

## 系统安全边界

- HHBA 网站使用候选人 PNVS Bearer；扩展只能使用不同格式的短期配对 Bearer，且必须通过严格的 `chrome-extension://<approved-id>` 来源校验。
- 网站通过 `/api/resumes/{id}/download` 由当前登录用户读取**自己的**私有 R2 文件，仅在本地解析。
- 私人资料要经过网站本人确认后才进入新的结构化同步接口，绝不把 `/api/resumes` 路由直接开放给浏览器扩展。
- 密文最多暂存每位求职者一份新任务，网页可重新创建覆盖旧任务。单次领取成功后从 D1 删除；过期任务不可领取。
- 安全测试不得在代码/日志中使用真实姓名、电话、邮箱、住址或简历文本。

## CI / 提交

- 浏览器插件协议、ZIP 生成与 Chromium 合成表单：`.github/workflows/hhba-apply-credits-product.yml`。
- DOCX 测试：`apps/web/scripts/apply-docx-local.contract.test.mjs`。
- 结构化资料安全测试：`apps/web/scripts/apply-profile-sync.contract.test.mjs`。
- D1 模拟事务：`apps/web/scripts/apply_credits_schema_test.py`。
- 编译：`npm ci && npm run build`（`apps/web`）。

本文件的添加用于触发此独立开发分支的 Cloudflare Pages Preview，不修改主线或正式站。

## 本轮 Preview 迁移核验（2026-11-07）
- 已逐项读取 Cloudflare Pages Preview/Production D1 绑定，并确认是两个不同数据库。
- 已对 Preview D1 取得 Time Travel 当前恢复书签；未将书签、密钥或测试用户个人资料提交至公开仓库。
- 仅对 Preview D1 执行 0014 加法迁移，新建 `hhba_apply_profile_transfers` 与 `idx_hhba_apply_profile_transfers_expiry`，事后通过 `sqlite_master` 验证表和索引存在。**Production D1 未发生改动**。
- 加入机会性过期密文清理：用户准备或领取同步时，服务端清除已过期或已领取的旧密文。**仍需正式定时清理机制**，才可把物理保留期限作为上线承诺。
- Cloudflare Preview 自定义白名单只新增本开发分支，已有的 36 条分支保留，生产分支仍为 `main`。
- Preview 的独立同步加密 Secret 仍未配置，直到能够证明不会覆盖 Preview 已有机密配置才允许安全写入。实际同步端到端功能因此默认禁用；单元与浏览器模拟测试可运行。

