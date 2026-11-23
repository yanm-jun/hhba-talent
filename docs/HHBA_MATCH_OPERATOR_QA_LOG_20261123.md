# HHBA Clean V2：由运营者运行的真实岗位验收与日志

最后更新：2026-11-23。适用项目：`hhba-talent`，仅预览分支。

## 目的

停止要求求职者不断点击同一真实 DeepSeek 合成测试。由 HHBA 运营者通过独立授权的内部预览测试接口执行固定虚构简历的简历理解 → Search → Fetch → 证据提取 → 评分 → 独立 JD 核验，并读取保存的诊断日志后继续修复。不得将模拟 CI 通过视为真实 Search/Fetch 通过。

## 入口和权限

- `POST /api/match-next/operator-run`：仅 Cloudflare Pages 独立预览域 `*.hhba-talent.pages.dev` 且 `HHBA_PREVIEW_AI_DIAG_ENABLED=1`。需要预览 D1 `hhba_match_qa_tokens` 中激活的高强度随机 Token 的 SHA-256 摘要，以及 `X-HHBA-QA-Token` 头、准确同源 `Origin`、`{"consent":true,"scenario":"automotive_operations_v1","mode":"focused","request_id":"UUID"}`。`mode=focused` 只做**最多四个真实网页的 Search→Fetch→JD 原文提取**，不模拟 10 岗位成果；`mode=full` 仍运行完整链路。`request_id` 是幂等编号，超时或重试不产生第二次付费调用。与求职者 session 不同，**没有冒用求职者登录信息**。不接收个人简历、任意 URL、模型指令。
- `GET /api/match-next/operator-log?id=<run_id>`：同样权限，返回单次运行的阶段时间线和聚合指标。
- 正式站不会开放这两个接口；`HHBA_MATCH_CLEAN_V2_ENABLED` 保持关闭，不解锁公开简历匹配。
- 该入口真实调用 DeepSeek，产生实际 API 费用。无每日次数上限，但运营者应按需要串行运行，不能造成无意义的持续重试。

## 隐私安全

- 三张表位于**已确认与生产 D1 不同**的预览 D1：`hhba_match_qa_tokens`（仅 256 位随机 Token 的 SHA-256 摘要），`hhba_match_qa_runs`（运行编号、时间、状态、统计），`hhba_match_qa_events`（阶段、时间、数字计数）。
- 不记录手机号、用户 ID、真实简历、JD 文章原文、搜索关键字、完整链接、供应商密钥或模型输出正文。阶段指标仅保留白名单数字；错误码仅允许受限大写字母、数字和下划线。
- 一次成功开始的付费调用**必须先创建运行日志**，若预览数据库不可用则停止，避免无记录的付费操作。
- 运行日志不与候选人历史记录关联；固定虚构简历不写入私人简历库或匹配历史。

## 判定标准

- 看到 `COMPLETED_ZERO` 不表示成功。先核查 `search_raw_results`、`candidate_links`、`page_reads`、`city_evidence_count`、`extracted_jobs`、`jd_verified` 和错误计数。
- `COMPLETED_PARTIAL` 表示取得部分有原文证据的候选，但不足 10 或完整 JD 核验不充分。
- `COMPLETED_TARGET` 仍需逐条验明岗位工作地点、招聘是否仍开放、官网可投递及可解释评分，不等同正式上线成功。
- 要把真实 Search/Fetch 跑通、证据核验和求职者端到端体验通过后，才考虑开启生产功能。

## 回归测试

- 未经令牌、错误令牌、正式站域名、跨域、未授权 payload 均拒绝且不能造成 DeepSeek 费用。
- 有效独立令牌能够直接在服务器运行固定虚构简历，输出 `run_id` 并保存各阶段计数，不使用或伪造求职者 Session。
- 旧页面点击验收功能保留，方便对照；运营者不再依赖用户截图。
## 首轮真实自测记录

- 已通过云端浏览器主动调用一次 `mode=full`，但浏览器在 120 秒上限时中断，并出现了平台自动重试导致的重复请求。这两条记录已标记 `INTERRUPTED`，不是“DeepSeek 搜索成功”或“10 个岗位通过”的记录。
- 确实记录到 Search 16 次、原始结果 334 条、候选详情链接 70 条，并在首批 Fetch 12 次中成功读取 11 个页面，但此时尚未完成真实 JD 提取及评分。**这里说明搜索召回存在，主要后续瓶颈是 JD 结构化提取与等待时限。**
- 因此增加 `mode=focused` 分段真实自测，以及 `request_id` 幂等防重放；先验证实际职位原文再扩展完整链路，禁止反复无意义地消耗供应商费用。
