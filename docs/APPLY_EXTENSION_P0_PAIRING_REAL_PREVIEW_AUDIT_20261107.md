# HHBA Edge P0：配对与一次性简历同步联调验收（2026-11-07）

## 本次已验证

### 1. 应用层完整业务路由（CI）

`apps/web/scripts/apply-pairing-real-flow.contract.test.mjs` 从网站候选人 Bearer 认证出发，完整驱动实际 Cloudflare Pages `onRequest` 路由，实现：

- 用户端创建 12 位五分钟一次性连接码
- Edge 扩展 origin 校验、错误连接码拒绝、成功兑换受限 12 小时短期设备凭证、连接码重放拒绝
- 浏览器扩展经受限凭证查询只读次数账户，不接触网站登录密码、Cookie 或完整简历原件
- 用户端选择本人已有的私有简历 ID，明确同意后创建 AES-256-GCM 加密资料传输任务
- 对同一账号已连接的扩展领回经核对字段、第二次领取失败、后续撤销所有连接令牌后失效
- 配对撤销一并删除尚未领取的暂存密文；无活跃连接的账号不得再创建同步任务
- 严格校验 `Origin`、本人资料归属；同步路径不写入订单或扣次

测试仅使用合成账号和内存模拟 D1，但调用的是实际业务处理器，而不是断言代码中的字符串。已集成 GitHub 工作流，长期防止回归。

### 2. Preview D1 的实际 SQL 验证（真实隔离数据库）

在 Cloudflare Pages 的 **Preview PNVS D1**（与 Production PNVS D1 的 ID 不同）中，以完全虚构的测试用户和 DOC 元数据，实际执行最小化的 SQL 测试：

| 核验项 | 结果 |
| --- | --- |
| 关联的候选人、私有简历、插件会话外键插入 | PASS |
| 只识别有效的当前用户配对设备 | PASS |
| 密文暂存记录插入 | PASS |
| `UPDATE ... WHERE claimed_at IS NULL AND expires_at>? RETURNING` 一次性原子领取 | PASS |
| 同一记录重复领取失败 | PASS |
| 使用不属于本人的手机号查询简历 | PASS（拒绝） |
| 用户撤销/清除记录后无法再查询 | PASS |
| 删除所有合成记录后复核 | PASS（用户、简历、设备、密文均 0 条残留） |

**仅操作 Preview D1**，没有接触生产用户数据、生产数据库、生产 R2 或任何生产 Secret。测试的假密文只用于检查 SQL 的原子性和清理行为，不是对加密密钥正确性或真实 Edge 浏览器交互的证明。

### 3. 尚未通过的条件

- Cloudflare Pages 最新 Preview 构建仍需达到 success，才能通过网络测试实际部署的 API。
- Preview 环境缺少安全配对所需的**稳定内测 Edge 扩展 ID**、`HHBA_APPLY_PAIRING_PEPPER`、`HHBA_APPLY_PROFILE_TRANSFER_KEY` 和启用开关；绝不能往源码添加真实密钥，不能覆盖现有 Pages Preview 其他机密。
- 尚未运行真实 Edge（Windows/macOS）对 Cloudflare Preview 的登录、连接码兑换、资料领取、前端交互和断线重连的现场验收。
- 独立过期密文 Cron Worker 的代码已在前置 PR #275 中，但 Trigger 未部署，因此不得保证物理清理绝对时间。
- Microsoft Edge Add-ons Partner Center 账号、正式商店 ID、真实截图/支持渠道及隐私法务审核未完成。

## 开发与上线纪律

先验收 **#272 → #273 → #274 → #275 → #276** 的依赖，再进行受控合并和正式站上线。PR #271 的 AI 字段匹配仍单独核查；不在本 PR 提前启用收费或模型调用。当前 Preview 测试专用资料不应出现在生产统计/融资数据中。

此次文件提交用于触发仅本开发分支的 Cloudflare Pages Preview，不改变 `main` 生产分支。
