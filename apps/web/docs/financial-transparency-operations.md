# HHBA 财务透明中心 · 上线与财务公开操作说明（2026-11-16）

> 此文档记录已完成的基础设施配置与尚未通过的上线验收。**没有真实财务数据、审批与安全配置时，不得启用订阅、自动发布或邮件群发。**

## 1. 系统边界

- 公开页：`/transparency`。只展示已发布报告，首页60/40模块和全站页脚链接到这里。
- 财务管理页：`/transparency/manage`。已由独立 Cloudflare Access 应用保护页面与财务后台 API，后端同时校验签名 JWT；未登录访客无法访问财务草稿。
- 公开 API：`/api/transparency/status`、`/api/transparency/reports`、`/api/transparency/report?period=YYYY-MM`、邮箱验证与退订。敏感后台数据与订阅邮箱不会由公开API返回。
- 财务 API：`/api/transparency/admin/*`。必须带有效签名 Access JWT，并匹配专用财务 aud、指定财务管理员邮箱。**不使用普通网站登录绕过此门槛**。
- 月报定时任务：`.github/workflows/hhba-finance-monthly-dispatch.yml`，北京时间每月21日10:00—23:55分批执行。
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

**Cloudflare Access 已创建** `HHBA Finance Private Workspace`，保护 `hhba.work/transparency/manage` 与 `hhba.work/api/transparency/admin/*`；仅允许指定管理者邮箱与既有身份提供方。公开 `/transparency` 不依赖登录。上线前确认 Pages 自定义域名的 Access JWT audience 与后端变量一致。未通过验证时不应展示任何财务草稿、订阅名单或银行凭据。

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
2. 在 `/transparency/manage` 创建月份草稿，全部填写并附上文字核算口径；仅草稿不公开。
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

GitHub Actions 定时任务按北京时间21日10:00–23:55每5分钟调用一次受令牌保护的 `POST /api/transparency/dispatch`。需设置 GitHub Actions Secret `HHBA_FIN_DISPATCH_SECRET` 且 Pages 端匹配，同时 Pages 启用 `HHBA_FIN_SEND_ENABLED=1`。

每次处理最多30个已验证的收件人，通过 `(月份,邮箱摘要)` 唯一键、发送状态和 Resend Idempotency Key 降低重复发送风险。必须对发送额度、Resend 限速与滞留任务监控；在大用户规模下需要接入 Cloudflare Queues 或专业邮件任务服务，不得承诺无容量限制的当日全量投递。

GitHub Actions 定时任务并非严格时钟：拥堵或 GitHub 中断时可能延迟。应在后台监控成功/失败/待发统计，并保留人工补发方案。

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
