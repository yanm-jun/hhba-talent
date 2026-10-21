# 演示账户隔离 —— 合并复核说明（不改行为，只验隔离）

目标文件: `apps/web/src/pages/DemoAuthPage.tsx`、`apps/web/src/services/demoAccount.ts`
结论先行: **这两个文件不需要改代码**。原件审计已证演示账户是纯前端 localStorage 模拟
（demoAccount.ts 自述 "Frontend-only prototype. Never pass demo identity to authenticated API calls"），
与新账户系统天然隔离。合并阶段要做的是按下表逐项复核，防止接线时无意打通。

## 隔离不变量（合并后逐项 grep 验证）

| # | 不变量 | 验证命令（apps/web/src 下） | 期望 |
|---|---|---|---|
| 1 | 演示模块不调用账户接口 | `grep -rn "smsAuth" pages/DemoAuthPage.tsx services/demoAccount.ts` | 无匹配 |
| 2 | 账户接口不读演示身份 | `grep -rn "demoAccount\|hhba.demo" services/smsAuth.ts pages/AuthPage.tsx` | 无匹配 |
| 3 | 演示数据不进注册统计 | 后端 users 段 scope 写死 `REGISTERED_ACCOUNTS_ONLY`（admin-growth-contract.ts），且 users 表只有 register/admin 两条建号路径 | 人工核对 + 后台对账 |
| 4 | 演示态不能访问账户收藏 | PersonalCenterPage 账户模式只由 `smsUser`（smsAuth.me() 的结果）驱动，demo 对象不参与 accountMode 判断 | 见 PersonalCenterPage.saved-section.md 第 1 步 |
| 5 | 演示入口与正式入口不混排 | 正式路径 `/candidate/login`、`/candidate/register` 渲染新 AuthPage；DemoAuthPage 仅在明确的演示入口保留，且页面保留「这是演示」标注 | 路由表人工核对 |

## 合并时的具体动作

1. **路由**: App.tsx 中把 `/candidate/login`、`/candidate/register`（及 recruiter 对应路径）
   从 DemoAuthPage 切到新 AuthPage（patches/frontend/AuthPage.tsx），props 按新签名传
   `user/onUser`（SmsUser）。DemoAuthPage 若保留，移到独立路径（如 `/demo`）并在页面顶部
   保留原件已有的演示声明，不得再占用 login/register 路径。
2. **登录态来源唯一化**: App 的当前用户状态只由 `smsAuth.me()` 恢复（Cookie 会话），
   不再用 demo 对象冒充已登录用户；`useDemoAccount()` 只允许出现在演示页与个人中心的
   「清除本地演示资料」区（原件已有该区，保持）。
3. **开关关系**: 后端 `HHBA_AUTH_ENABLED=0` 时新 AuthPage 的接口整体 404，页面会显示
   「账户服务暂不可用」——上线切换顺序必须是先开后端开关并完成短信联调，再切前端路由，
   不许先切路由让用户撞上不可用的注册页。
4. **统计口径复述**（防回归）: 演示账户的「注册/登录」动作不产生任何服务端记录；
   若未来发现演示动作出现在 sms_send_log 或 users 表中，即视为隔离被破坏，按缺陷处理。
