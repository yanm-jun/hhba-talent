# HHBA 财务透明中心 · 上线与财务公开操作说明（2026-11-16）

> 此文档记录已完成的基础设施配置与尚未通过的上线验收。**没有真实财务数据、审批与安全配置时，不得启用订阅、自动发布或邮件群发。**

## 1. 系统边界

- 公开页：`/transparency`。只展示已发布报告，首页60/40模块和全站页脚链接到这里。
- **唯一财务管理入口**：`https://admin.hhba.work/admin-preview/` 的「财务成本」工作区（管理员密码会话＋财务邮箱白名单）。`hhba.work/transparency/manage` 退役后返回 307，跳转到唯一后台，原重复管理代码与 API 不再部署。
- 公开 API：`/api/transparency/status`、`/api/transparency/reports`、`/api/transparency/report?period=YYYY-MM`、邮箱验证与退订。敏感后台数据与订阅邮箱不会由公开API返回。
- **唯一财务后台 API**：`https://admin.hhba.work/admin-preview/api/financial/*`，先验证原后台 HttpOnly 密码登录会话，再验证财务管理员邮箱白名单，连接同一独立财务 D1。公开主站不提供财务草稿写入接口。
- 月报主调度：Cloudflare Worker `hhba-finance-dispatch-scheduler`（北京时间每月21日10:00—23:55，每5分钟检查）；GitHub Actions 仅保留手动应急，不作为第二套自动调度。
- **当前生产仍安全关闭订阅和群发**：独立数据库与财务 Access 已建立，Turnstile/退订密钥已配置，但启用邮件收集、人工发布和群发仍需要后续验收；正式报告继续由真实账目产生。

## 2. 独立 D1（避免耗尽岗位及简历数据库额度）

已创建正式 D1：`hhba-finance-production-20261116`；隔离预览 D1：`hhba-finance-staging-20261116`。两者分别以 **`HHBA_TRANSPARENCY_DB`** 绑定至 Pages 生产/预览配置，不共享招聘、简历或账号表。

已先在预览库、后在正式库执行 `apps/web/d1/0020_financial_transparency.sql`（各15个语句成功），并核对了5张财务表及4个不可更改历史记录的触发器。正式库初始报告数为0。

核心表：
- `hhba_fin_reports`：月份唯一的草稿、审核快照、公开快照。
- `hhba_fin_publication_revisions`：已发布的所有历史版本，触发器禁止更改或删除。
- `hhba_fin_audit`：录入、审核、发布、更正操作日志，触发器禁止修改或删除。
- `hhba_fin_subscribers`：邮件与验证状态，仅限私有数据库；未验证邮箱在有效期后短期内清理。
- `hhba_fin_deliveries`：邮件发送状态、重试次数与幂等标记，不存邮件正文。

## 3. Cloudflare Pages 机密与管理员身份

配置（名称区分大小写）：

| 名称 | 类型 | 含义 |
| --- | --- | --- |
| `HHBA_TRANSPARENCY_DB` | D1 binding | 专用财务数据库 |
| `HHBA_ACCESS_TEAM_DOMAIN` | Secret | 已经使用的 Cloudflare Access team domain |
| `HHBA_FINANCE_ACCESS_AUD` | Secret | **财务应用专用** Access JWT Audience，不复用公开访客身份 |
| `HHBA_FINANCE_ADMIN_EMAIL` | Secret | 唯一经授权的财务管理员邮箱 |
| `RESEND_API_KEY` | Secret | 邮件 API，沿用经授权的 Resend 配置 |
| `HHBA_FIN_FROM_EMAIL` | Secret | 已验证域名的财务发件地址，不可使用免费测试域名 |
| `HHBA_FIN_TURNSTILE_SITE_KEY` | Variable | 订阅人机验证公钥 |
| `HHBA_FIN_TURNSTILE_SECRET` | Secret | Turnstile 服务端秘钥 |
| `HHBA_FIN_UNSUBSCRIBE_SECRET` | Secret | >=32 字符随机高熵值；不应任意轮换（现有退订链接依赖它） |
| `HHBA_FIN_DISPATCH_SECRET` | Secret | >=40 字符随机高熵令牌，必须与 GitHub Actions 同名 secret 一致 |
| `HHBA_FIN_PUBLIC_BASE_URL` | Variable | 如 `https://hhba.work`，仅允许 HHBA 官方域名 |
| `HHBA_FIN_SUBSCRIPTIONS_ENABLED` | Variable | `1` 才允许收订阅邮箱，前提是配置全部有效 |
| `HHBA_FIN_SEND_ENABLED` | Variable | `1` 才允许月度群发，前提是已批准报告与审阅流程就绪 |
| `HHBA_FIN_AUTO_PUBLISH_ENABLED` | Variable | 默认关闭，审核本身不等于公开；单独明确授权才能自动公开 |

**单后台迁移**：正式私有财务界面已迁入 `admin.hhba.work` 的「财务成本」。使用原后台密码会话和财务邮箱白名单；独立 Cloudflare Access 财务应用是旧入口的历史配置，移除旧路由并验证新入口后应将其停用。公开 `/transparency` 不依赖登录。

**安全原则**：绝不将 Secret 写入 GitHub 源码、浏览器前端、Markdown 报告正文、邮件模板或普通运行日志。

## 4. 财务数据口径

所有金额必须来自真实、已经核对的账本，并以元为单位在管理员表单输入；后台转整数分存储，不得用浮点数推算最终款项。

- 营业收入、退款冲减、AI 成本、基础设施、人员、运营、税费、其他费用、调整项 → 汇总本期经营结果；该结果允许为负。
- **依法核算可分配利润** 是另外一个经过合法程序确认的口径，**不得把本月经营结果直接当成可分配利润**。涉及弥补亏损、法定公积金及公司治理安排等，应有财务/法律专业审阅。
- 该基数为零时，60/40的实际新增计提应为零；正数时按40%向下取整到分、剩余归60%企业部分（避免累计多出一分钱）。
- 帮扶池分清：期初余额、**本期计提**（制度口径）、**实际入池**（资金流动）、本期实际帮扶支出、期末余额；期末必须等于期初+实入-实支。
- 帮扶事例只能披露汇总类别与数量，不披露职工姓名、身份证、工资流水、律师沟通和案件隐私。
- 没有真实外部独立审计证据和核验模块时，报告必须明确标为**未经独立审计**，不允许管理员手动勾选“已审计”。

## 5. 发布流程

1. 运营人员整理真实账簿与银行/支付平台凭证；不得使用示例账目。
2. 在 `admin.hhba.work` 的「财务成本 → 月报审核与劳动者帮扶池」创建月份草稿；可以先读取同月手工凭证登记簿，再主动将已登记的 AI、基础设施及运营费用作为**未核对参考**填入空白科目。最终仍须核对并明确保存，不能凭空补零。
3. 确认每月经营利润与依法确认的利润分配基础的不同；核验退款、支出及帮扶池结余计算。
4. 逐项检查隐私、商业秘密及法规要求，填写具体审核理由与依据。
5. 完成“审核但不公开”操作，系统保存审核快照与审核时间。
6. **原则上21日（北京时间）公开上一自然月**。默认必须由管理员显式点击「确认正式公开」。只有另行明确设置 `HHBA_FIN_AUTO_PUBLISH_ENABLED=1` 才会允许定时任务将已审核的报告自动发布；当前未启用。
7. 同月同一报告需要修订时，不直接覆盖历史；重新保存更正草稿，填写至少20字公开更正原因，复核后发布新版本，保留上一版供查询。

**如果21日尚未审核完成：不发布、不发送，也不生成任何示例数字。** 后续补发需要负责人明确同意和单独安排，不伪称按时发布。

## 6. 订阅与退订

- 邮箱订阅免费、自愿，与会员付费和招聘营销分离。
- 打开开关前必须完成 Turnstile、DNS/Resend 发件域名验证、实际邮箱验证回执测试、退订测试及隐私政策更新。
- 用户填写邮箱并勾选专门的财务报告订阅同意；只有通过验证邮件点击确认链接，才列入正式发送名单。
- 邮件里附完整报告链接及退订链接；链接GET只展示确认页，不会因邮件客户端自动检查链接而误退订。支持 RFC 8058 的 URL 签名 token + 一键 POST 退订。
- 退订后立即从发件名单中取消，数据库清除邮箱明文，保留必要的不可逆凭据供安全记录。保留期须在隐私政策中披露。
- **不要未经计划更换 `HHBA_FIN_UNSUBSCRIBE_SECRET`**：旧邮件里的令牌会失效。更换时应建立过渡校验机制，或向用户提供不依赖旧令牌的等效退订渠道。

## 7. 每月21日群发

Cloudflare Cron Worker 在北京时间每月21日10:00–23:55每5分钟调用一次受令牌保护的 `POST /api/transparency/dispatch`。Worker 与 Pages 密钥已加密配置。只有负责人完成实际月报、双重订阅验证和真实发信验收，并显式设置 `HHBA_FIN_SEND_ENABLED=1` 后才允许群发。

每次处理最多30个已验证的收件人，通过 `(月份,邮箱摘要)` 唯一键、发送状态和 Resend Idempotency Key 降低重复发送风险。必须对发送额度、Resend 限速与滞留任务监控；在大用户规模下需要接入 Cloudflare Queues 或专业邮件任务服务，不得承诺无容量限制的当日全量投递。

Cloudflare Cron 也不是精确定时承诺，发生平台延迟应监控成功、失败、待发统计；GitHub Actions 仅保留手动应急，避免双重自动调度。

## 8. 验收清单

- [ ] 不接数据库时公开页面正常显示「报告尚未发布」，不生成零值报表。
- [ ] 订单/收入台账未核实的草稿绝不出现在公开接口。
- [ ] 只有有效财务Access JWT可读写草稿与审核。
- [ ] 亏损月份可用负数如实发布；分配利润为零时帮扶池计提为零。
- [ ] 60/40计算尾数处理、余额公式、异常数据阻断生效。
- [ ] 真实更正创建新版本，历史版本不可覆盖。
- [ ] 发件邮箱、Turnstile不配置时订阅表单关闭。
- [ ] 验证邮件未经点击不能接收群发。
- [ ] 退订后后续群发不会选中此人。
- [ ] 当日没有已审核上月报告时不发送。
- [ ] 连续调用调度接口不会对同一用户重复发送。
- [ ] 公开报告打印可保存为PDF，页面不含用户私有姓名等信息。
- [ ] 业务负责人、律师/税务与隐私责任人审核报表及宣传口径。

**注意：** 开发与测试通过不等于数据库、邮件域名、财务权限已成功上线；未实际完成以上勾选的事项一律保持关闭。

## 9. 已完成的基础设施状态（2026-11-16）

- [x] 独立生产/预览财务 D1 创建并绑定，迁移与初始结构核验完成。
- [x] 财务专用 Cloudflare Access 应用与管理员身份白名单配置。
- [x] Resend `notify.hhba.work` 域名已验证；已设置财务专用发件地址。
- [x] 生产/预览 Turnstile 组件及服务端密钥、退订 HMAC 秘钥分别安全配置。
- [x] `HHBA_FIN_SUBSCRIPTIONS_ENABLED=0` 和 `HHBA_FIN_SEND_ENABLED=0`，安全默认关闭。
- [ ] 管理员亲自登录完整验收、人工真实账目审核发布；尚无可发布的真实报告。
- [ ] 真实 Turnstile + Resend 收件验证、一次性退订和邮件发送投递验收。
- [ ] 配置 GitHub Actions 和 Pages 两端的匹配 `HHBA_FIN_DISPATCH_SECRET`，并通过小规模实发测试。
- [ ] 以上完成后，经负责人明确授权逐项启用订阅和群发。

## 10. Cloudflare Cron 主调度（2026-11-17）

- 主调度 Worker：`hhba-finance-dispatch-scheduler`，源码 `apps/web/ops/finance-cron-worker.mjs`。
- 触发时间：`*/5 2-15 21 * *` UTC，即北京时间每月21日 10:00—23:55 每五分钟一次。Cloudflare 的定时触发可能出现平台级延迟。
- 不接受公众 HTTP 触发，HTTP 请求统一返回 404。
- 每次仅用私密 `HHBA_FIN_DISPATCH_SECRET` 请求正式站 `POST /api/transparency/dispatch`，不自行读财务表、不缓存订阅邮箱、不绕过真实报告审核。
- Pages 与 Worker 必须配置同一个随机强密钥，均标记为加密 Secret；公开代码、构建日志、前端环境变量和文档均不应包含此值。
- 生产发送开关 `HHBA_FIN_SEND_ENABLED=0` 期间，调度即使触发也不会真正发信；`HHBA_FIN_AUTO_PUBLISH_ENABLED=0` 时只审核未发布的报告不能自动公开。
- GitHub Actions `.github/workflows/hhba-finance-monthly-dispatch.yml` 已取消自动定时，仅保留手动应急路径，避免两套定时任务同时运行。
- 必须通过管理员邮件内测、真实报表人工发布、真实订阅闭环与退订实测后，由负责人明确决定是否开启公众邮件。


## 11. Cloudflare Pages 部署恢复记录（2026-11-17）

- 受影响项目：`hhba-talent`，生产分支 `main`。
- 提交 `27d2d143` 的 Pages 构建报告 Cloudflare 内部平台错误；提交 `2c2d2f94` 在部署队列中长时间等待，尚未出现代码构建失败日志。
- 通过 Pages 重试与手动 Git 部署请求均得到 HTTP 304；为触发一次新的可追踪构建，本次仅更新运维说明文档，**不修改财务代码、数据、权限或三个发信开关**。
- 新构建成功前必须以 Cloudflare 标注 `success` 且绑定 `hhba.work` 的部署版本为线上事实，不凭 Git 合并状态宣称上线。
- 新构建完成后核查独立 D1、财务 Access、公开状态 API、管理员测试邮件入口和 `HHBA_FIN_SUBSCRIPTIONS_ENABLED=0`、`HHBA_FIN_SEND_ENABLED=0`、`HHBA_FIN_AUTO_PUBLISH_ENABLED=0`。

## 12. 单一管理后台收口（2026-11-17）

- 原后台 `hhba-admin-console` 使用独立 Pages 项目、独立发布分支 `feat/admin-password-console-20261112`，原有「财务成本」KV 凭证登记与 D1「月报审核与劳动者帮扶池」共用**一个页面与密码会话**。
- 数据层：原凭证 KV 保持原位；月报继续使用独立 `HHBA_TRANSPARENCY_DB` 正式 D1；公众 D1 报告 API 和订阅验证/退订/调度不变。
- 只有当前月份已读取、通过字段检查、已冲销条目排除的登记簿可以由管理员**自愿带入同月月报空白费用字段**。费用是待核对参考，不直接存库或公开，不替代独立的税务/利润核算。
- 旧主站私有界面 `hhba.work/transparency/manage` 退役后使用 307 跳转；主站删除冗余的 React 编辑组件与私有写入 API。公共 `hhba.work/transparency` 保留。
- 安全发布顺序：**先确认 `admin.hhba.work` 新版本生产部署成功且密码登录有效，再合并主站旧入口退役 PR**；不能让管理者失去唯一可用后台。
- 生产订阅、群发、自动公开开关继续均为 `0`；禁止在完成真实人工验收前开启。
