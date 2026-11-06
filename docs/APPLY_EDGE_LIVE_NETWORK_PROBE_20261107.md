# HHBA Edge P0 — 一次性真实 HTTPS 联调探测（2026-11-07）

## 本轮交付

- 已新建 GitHub Draft PR #279（本分支基于 #278），新代码 `apps/web/workers/apply-edge-lab-live-network-probe.js`，配套静态安全测试与 GitHub Actions 门禁。
- 已将源码作为一个**独立、无公开触发入口**的 Cloudflare Worker `hhba-edge-p0-lab-once-probe` 上传并验证 deployment。此 Worker 只绑定 Preview PNVS D1 `8916eebc-c730-4597-8a6b-abe16cec1e40`；通过绑定对比确认它不同于生产 PNVS D1。原 HHBA Pages 和 hhba.work 均未改动。
- Cloudflare 此 Worker 的 `HHBA_EDGE_LAB_NETWORK_PROBE_ENABLED=1`，在任务内才生成一次性随机令牌；公网不提供创建账号、读取连接码或读取测试凭证的入口。Worker 的 `fetch()` 始终返回 404。
- 新建独立 Cron `* * * * *` 用于触发一次性探测。任务在 D1 `hhba_apply_lab_e2e_runs` 使用固定 run ID 的 `INSERT OR IGNORE` 保护，**无论 Cron 触发多少次都只执行一次完整探测**。完成真实观察后应移除本 Worker 的 Cron 列表 `[]`，不能长期保持每分钟调度。
- Cloudflare 官方说明新增 Cron 触发器可能最多约 15 分钟才传播到全球网络，因此**Cron 配置成功不等于首次任务执行已完成**。未观察到 D1 的最终审计行之前，不得宣称端到端联调通过。

## 探测过程

只通过独立实验域名 `https://hhba-edge-p0-lab.pages.dev` 的真实 HTTPS Pages Functions 请求进行：

1. 核验独立环境配对/资料同步启用，且支付宝付款、付费任务均关闭。
2. 在 Preview D1 内创建新的合成候选人、随机网站会话 SHA-256 哈希和**仅简历元数据**（没有真实 R2 文件）。
3. 验证匿名请求不能生成连接码；带测试网站 Bearer 的同源 POST 才能创建一次性连接码。
4. 使用错误扩展 Origin 拒绝兑换；正确内测 Edge Origin 才能兑换单独的设备 Token；第二次兑换同一连接码必须拒绝。
5. 受限设备 Token 可以查询零消费钱包；未授权用户无法准备结构化资料。
6. 网站明确授权后，D1 必须只保存 AES-256-GCM 密文，不能存放明文简历字段。
7. 错误设备令牌拒绝；正确设备令牌仅领取一次；确认密文被删除并拒绝再次领取。
8. 用户再次授权暂存后，撤销设备必须使令牌失效并删除未领取的密文。
9. 通过 `finally` 清理精确合成账号的登录会话、文件元数据、连接码、设备记录和密文；再核验合成用户已不存在。

## 安全边界

- 网站 Bearer、扩展 Bearer、一次性连接码均在 Worker 内部随机生成，**不得出现在仓库源码、CI、公开文档或 Worker 日志**。
- 专用 D1 审计表只保留固定 run ID、静态阶段枚举、通过/失败、步骤数量、错误码和清理标记；不包含真实用户名、手机号、邮箱、令牌或完整响应体。
- 不向 DeepSeek、支付宝、邮箱/短信供应商发送请求；不上传 R2 实体简历、不对真实求职者操作。
- Workers `fetch` 不是 Microsoft Edge 实际浏览器：这次验证的只是**真实公网安全 API 协议**。Windows/macOS Edge 原生浏览器安装及 UI 现场操作仍为单独验收项。
- 为避免合成手机号碰撞误删，先检查数据库中不存在该号码，成功 INSERT **以后**才把它标记为可清理所有者。
- 如果 Worker 真实执行后报告 `failed`，应根据 `last_step` 和 `error_code` 修复，再以新的固定 run ID 重试；不能改写已有审计记录伪造成功。

## 现场核验命令（Cloudflare D1，只读）

```sql
SELECT run_id,status,last_step,checks,error_code,cleanup_verified,started_at,finished_at
FROM hhba_apply_lab_e2e_runs
WHERE run_id='p0-20261107-real-network-v1';
```

只有 `status='passed'` **且** `cleanup_verified=1` 才可认为本次真实 HTTPS 协议与合成数据清理均通过。读取完成后，**必须撤销探测 Worker 的 Cron Trigger**，不要修改实验室现有独立过期密文清理 Worker 的 15 分钟计划。

## 依赖关系

代码仍由 #272 → #273 → #274 → #275 → #276 → #277 → #278 → #279 顺序待验收；本轮未修改 `main`、hhba.work 或 Microsoft Partner Center 发布状态。
