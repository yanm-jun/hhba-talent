# HHBA AI 财务管家 V1 运维与审核边界（2026-11-17）

## 唯一入口
- 私有后台：`https://admin.hhba.work/admin-preview/` →「财务成本」→「AI 财务管家」；无第二套登录。
- 原始凭证：`HHBA_LIBRARY_CACHE_KV` 的 `finance:entry:v1:<YYYY-MM>:<UUID>`。人工原始事件和冲销只通过既有私有登记 API 追加，不被 AI Worker 写入或覆盖。
- AI 整理快照：独立 KV 前缀 `finance:ai-review:v1:<YYYY-MM>`，只储存待核对的费用分类、异常列表、脱敏模型建议和来源指纹。其金额并非实际对账核定的营业收入或税务利润。
- 公开月报：原 `HHBA_TRANSPARENCY_DB` 与密码管理员审核/发布工作流不变，AI 永远不自动保存、审核、公开或划款。

## AI 模型与脱敏
- 模型服务 Worker：`hhba-finance-ai-inference`，`AI` binding 使用 `@cf/meta/llama-3.3-70b-instruct-fp8-fast`，并采用独立的 `HHBA_FIN_AI_SERVICE_TOKEN` Worker Secret。
- 原后台 Pages 只通过 `HHBA_FIN_AI_SERVICE` **Service Binding** 调用模型，私钥 `HHBA_FIN_AI_SERVICE_TOKEN` 独立加密配置在 Pages，绝不能在 GitHub、HTTP 响应或日志中输出。
- 模型仅收到年月、凭证/冲销/未归类数量、预定义异常代码和费用大类；**不发送邮箱、手机号、原始发票、付款明细、单笔交易金额、凭证编号或自由文本笔记**。
- 税费、法定可分配利润、40%帮扶池计提不是 AI 推算项目，依法核对并由负责人签署审核；无真实源数据必须显示未知，不能自动填零。
- `HHBA_FIN_AI_ENABLED=1` 才调用模型。KV 规则核算始终为确定性程序，模型不能覆盖数字。

## 每日自动整理
- 独立调度 Worker：`hhba-finance-ai-review-scheduler`；Cron `0 2 * * *` UTC = 北京时间每日10:00。
- 仅带高熵 Bearer Secret `HHBA_FIN_AI_CRON_SECRET` 请求 `POST https://admin.hhba.work/admin-preview/api/finance-ai-cron`。管理员密码中间件仅针对**这一条精确 POST 路由**放行，由路由自身执行强密钥校验。
- `HHBA_FIN_AI_AUTO_ENABLED=1` 才处理每日任务；`0` 时计划触发也会拒绝工作。来源指纹不变则复用先前分析，不再次发起付费 AI 请求。
- 当前安全上线原则：**必须先确认包含全部新路由的 Pages 生产提交成功部署，才开启每日自动运行**。不要因为 Worker 本身已部署就误判端到端完成。

## 现有限制
- 生产应用当前没有部署完整的支付宝支付订单表或已经授权的银行/供应商账单导入接口，因此本版本只能自动整理现有登记簿，**不能宣称全部收入与成本已自动对账**。
- 登记簿每月 50 事件上限、Cloudflare KV 最终一致性仍存在。来源不完整/达到上限必须拒绝生成完整财报，并提示管理员补齐外部证据。
- 自动整理不是独立审计、会计师签字或自动税务申报；正式财务发布与订阅群发依旧要求现有审批与发信开关。

## 上线核对
1. GitHub PR #380、#381、#382 中独立财务 AI 验收 CI 均通过，历史招聘无关 CI 仍有独立失败。
2. 检查 Cloudflare Pages 生产最新 SHA 已部署成功且 `admin.hhba.work` alias 指向新版。
3. 检查 Pages `HHBA_FIN_AI_SERVICE`、两个加密密钥、模型 Worker AI binding 和独立每日 Cron；确认财务 D1 与原 KV 绑定未改变。
4. 用正式管理员登录；查看已经保存的 AI 整理报告或主动分析真实凭证，核实 `model.state=completed`，不存在单笔敏感信息出站。
5. 核对生产公众订阅、月报批量发送、自动财报公开仍然关闭。
