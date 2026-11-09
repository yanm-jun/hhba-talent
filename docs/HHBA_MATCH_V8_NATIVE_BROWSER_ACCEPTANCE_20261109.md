# HHBA V8 · Cloudflare 原生 Browser Run 与站外岗位核验报告

日期：2026-11-09。分支：`feature/match-v8-deepseek-dynamic-official-discovery-20261108`，PR #299（Draft）。

## 1. 已落地的 Cloudflare 预览资源

1. 在**独立 Preview D1** 的 `HHBA_PNVS_AUTH_DB` 新建 `hhba_match_browser_render_accounting` 和 `idx_hhba_v8_browser_day`；已核验不同于 Production D1。仅记录匿名 request ID、天、hash、render 尝试/恢复/失败次数，浏览器费用未知标志固定 0。
2. 在 **Pages Preview** 配置 `BROWSER` 原生 Browser Run 绑定；Production 未增加绑定，现有环境变量/D1 绑定未被覆盖。预览兼容日期 `2026-11-01`，满足原生 `quickAction` 的最低要求。
3. `cf-job-browser-preview.js` 已从 REST API Token 调用切换为 `env.BROWSER.quickAction('snapshot',...)`。不再需要 `HHBA_BROWSER_RENDER_TOKEN` 或 `HHBA_BROWSER_ACCOUNT_ID`。仅 `HHBA_AUTH_ROLLOUT=preview` 且 `HHBA_MATCH_V8_BROWSER_FALLBACK_ENABLED=1`，并且实际存在 `BROWSER` 绑定时才启用。**当前普通 Preview 开关仍关闭**。Production AI/站外搜索开关均关闭。
4. 旧 `0020_match_v8_browser_render_accounting.sql` 已在 Preview 执行，没有对正式数据库执行。

## 2. 真正的原生绑定与 DeepSeek 联网试验

执行：[GitHub Actions #42558779552](https://github.com/yanm-jun/hhba-talent/actions/runs/42558779552)。

采用一次性 GitHub OIDC 令牌，严格限定 repo/branch/workflow/audience，D1 使用两种独立全局一次性标记；测试只传递模拟职业“内容运营”，不发送用户简历。

### 浏览器单站点真实抽查

- 浏览器原生绑定的 **1 次真实 Snapshot** 已执行，D1 `render_attempts=1, render_recovered=0, render_failures=0`。
- 具体公开单岗：`https://careers.tencent.com/jobdesc.html?postId=2094968965272092672`；被拒原因 `MISSING_EXPLICIT_WORKPLACE`。**这是解析未通过，不是浏览器服务失败**。
- 随后重新抽取该页公开 Markdown，发现导航包含 `[社会招聘](<javascript:void(0)>)`，旧 `markdownLines` 解包只处理首个内层右括号，残留 `>)`，导致“社会招聘>)”错误成为职位标题，而真正 `在研UE5策略竞技游戏-内容运营经理 上海` 无法与位置匹配。
- 已在解析器中提前清理嵌套的 JS 导航链接，并在 `match-v8-workplace-evidence.contract.test.mjs` 中用真实结构构造正反例。**新修复已通过模拟回归，尚未做第二次付费原生浏览器实测**。

### 完整 DeepSeek Search/Fetch 真实调用

- 4 次模型、6 次公开 Search、5 次 Fetch；搜索发现 12 个候选链接，仍为 **0 条可信官方岗位**。
- `status=COMPLETE` 表示工具调用完成，不代表有真实岗位；`quality_status=NO_VERIFIED_JOBS`。
- `browser_render.attempts=0`，`recovered=0`，即完整链路未触发浏览器补读（当时的官方 ATS 主机不满足旧优先条件）。
- DeepSeek 输入 5359 Token（缓存 4480）、输出 432 Token；**DeepSeek 费用估算 ¥0.06546**（真实账单以服务商为准），`accounting.complete=true` 仅说明该轮 DeepSeek 用量完整。
- 独立 Preview D1 对账已核对 `4/6/5, ¥0.06546`；本轮 browser usage D1 另记 `0/0/0`。
- 公开示例中出现 `https://anker-in.jobs.feishu.cn/index/position/7418141743487945014/detail`（飞书招聘租户），旧版本没有触发 browser rescue。

## 3. 基于真实结果新增的防误检和召回规则

- `feishu.cn` 和 `hotjob.cn` 是**共享 ATS 域名**：它们的专属招聘详情页可作为发现线索，但其网站首页**不能当作雇主独立官方网站**。
- 针对 `*.jobs.feishu.cn/index/position/{数字}/detail` 的公开单岗，在原始 Fetch 缺关键证据时允许进入最多两次的浏览器补读配额；没有放宽公司核验规则。
- 若岗位位于共享 ATS 域名，只有从**独立雇主官网**取到与该特定岗位 URL 或企业专属招聘板相符的招聘反链，才可能进入正式候选；不接受“同一 ATS 域名”“搜索摘要”“品牌字符串”作为官方公司身份认证。
- 使用 mock Search/Fetch/Browser，新增飞书专属租户与合法企业反链的正例、无反链或共享平台伪官网的负例。
- 最新 [GitHub Actions #42560350595](https://github.com/yanm-jun/hhba-talent/actions/runs/42560350595)：**188/188 测试成功**，源码语法检查、构建、匿名访问拒绝等同步通过；其余 CI 同 SHA 需另行确认。

## 4. 费用、隔离、发布门槛

- 4 / 8 / 20 的模型/Search/Fetch 上限未改变；额外浏览器上限仍为 2，单独计费，只有 D1 审计表存在才能在普通预览业务里实际启用。
- 本次真实浏览器操作确实发生了 1 次，当前未掌握 Cloudflare 单次实际收费金额，不把其合并为 DeepSeek 人民币估算。
- 一次性 OIDC 测试路由与工作流已经从最新开发分支**删除**；历史部署不可假定同步删除，但单次 D1 保留已执行标记防止重复付费。
- 所有企业资格、学历、经验、技能与中国大陆工作地点硬门槛继续保留。
- **最终结论：基础设施/调用与成本审计通过；新规则代码回归通过；可核验真实岗位数仍为 0，不能合并 PR #299，也不能开启 hhba.work 的正式 AI 推荐或收费服务。**
