# HHBA 岗位定向简历优化｜生产上线闸门与回滚说明

状态：**Draft / 禁止直接合并正式站**。本文件描述生产部署的必要步骤，不是授权执行生产数据库修改或开启新收费功能。

## 实际验收证据

- DeepSeek + Cloudflare Workers 固定合成简历真实生成已成功：GitHub Actions `44526612212`，`SYNTHETIC_AI_GENERATION_OK`、1 条建议。
- 独立 Chromium 测试完整操作链：`44531653966`，包括同意 AI 分享、逐条核实、编辑、版本保存/载入/删除、390px 无横向溢出；单页 A4 为 1 页，长文档 A4 为 4 页，末段完整。
- Preview 实际 HTTP 安全验收：`44534583498`。三个状态 API 为 HTTP 200 且已启用；四个匿名 POST 均返回 `401 SESSION_INVALID`；已移除临时 AI 诊断 API（未知路径由 SPA 提供 HTML 回退）。HTTP 测试不触发付费模型。
- Preview D1 真实账户隔离：合成简历版本的拥有者可查询；不同账户查询 0 条、尝试删除影响 0 条；全部测试数据已清理。
- **重要边界**：上述是分层验证，尚未用真实用户全程走通「文件解析 → 真正的岗位匹配 → DeepSeek 优化 → 当前账号 D1 保存 → PDF」同一会话；不声称此项已通过。

## 必须核对的环境隔离

- Cloudflare Pages 项目 `hhba-talent`：`main` 才是生产分支，功能分支在 Preview。
- Preview 的 `HHBA_PNVS_AUTH_DB` 必须与 Production 的 D1 数据库 ID 不同。
- Preview 需包含独立用户认证与五个迁移文件产生的表；诊断开关 `HHBA_PREVIEW_AI_DIAG_ENABLED` 必须为 `0`。
- 生产身份功能使用 `VITE_HHBA_REAL_AUTH_ENABLED=1`，但这与新功能开关独立；不应为了开启新模块改动认证路径。

## 生产 D1 迁移清单：仅 HHBA_PNVS_AUTH_DB

**严禁按数字前缀全量执行 `0020*.sql` 或 `0021*.sql`：仓库内财务透明系统存在同编号迁移，但绑定的是独立的 `HHBA_TRANSPARENCY_DB`。**

在已经确认 D1 备份与迁移授权后，按下列**精确文件名**依次执行一次，并执行 `sqlite_master` 验证：

1. `apps/web/d1/0020_resume_optimization_usage.sql` → `hhba_resume_optimization_requests`
2. `apps/web/d1/0021_targeted_resume_versions.sql` → `hhba_targeted_resume_versions`
3. `apps/web/d1/0022_resume_reassessment_usage.sql` → `hhba_resume_reassess_requests`
4. `apps/web/d1/0023_official_job_evidence.sql` → `hhba_official_job_evidence` 和 `hhba_official_verify_requests`
5. `apps/web/d1/0024_resume_optimization_attempts.sql` → `hhba_resume_optimization_attempts`

该检查在 2026-11-19 的 Production 数据库发现上述**六个新表全部缺失**；因此即使代码合并，也不能将模块视为已上线。**不要在迁移前打开功能开关。**

## 功能开关与人工发布顺序

先合并审查通过的代码并确认 Pages Production 构建完成，随后逐项开启且留意状态接口：

- `HHBA_RESUME_VERSION_STORAGE_ENABLED=1`：登录用户主动保存个人版本；上线前抽查账户所有权删除规则。
- `HHBA_RESUME_OPTIMIZATION_ENABLED=1`：第三方 AI 润色，需要服务器密钥和 `HHBA_MATCH_LIMIT_PEPPER`，测试个人确认与限额。可复用已有服务端 DeepSeek 凭证，禁止把 Key 写入 `VITE_` 或前端。
- `HHBA_RESUME_REASSESS_ENABLED=1`：仅对可信 ATS/官方核验岗位评分，不使用模型生成虚假的录用概率。
- `HHBA_OFFICIAL_JOB_VERIFY_ENABLED=1`：仅白名单官网详情页、无任意网址访问和无自动转发简历。

以上每一步均应先核对 API GET 状态、功能授权与告警，再开放下一个开关。正式环境不会沿用 Preview 的测试账号或数据。

## 生产测试闸门

- [ ] PR 不再有未通过 CI；用户体验与隐私政策由负责人复核。
- [ ] 最终不可变 Preview 部署 SHA 成功，原版与新版分别在桌面端/手机端验收。
- [ ] D1 按**精确文件名**迁移完毕，生产五个功能所需的六个表全部存在。
- [ ] 登录用户端到端：授权 AI → 查看建议 → 逐条核实 → 编辑原段 → 保存并重新打开 → 删除 → A4 PDF。
- [ ] 未登录与不同账号不能查询/修改其他人的版本；跨站 POST 被拒绝。
- [ ] 费用上限真实有效：用户每天最多 3 次有效润色、6 次尝试，全站分别 50 与 120；空建议和上游失败不扣成功生成额度。
- [ ] 仅展示真实职位/官方来源，复评文字表达不等于任职资质提升或录用概率。
- [ ] 日志不包含用户原文、手机号、Token、第三方 AI Key。
- [ ] 费用、服务范围、数据保存/删除政策在用户可见页面告知。

## 回滚操作

1. 若 AI 返回异常、成本上限失效或隐私风险出现，**先关闭四个新模块开关**；可独立关闭最受影响模块。
2. 若页面存在阻断，回滚 `main` 所对应的 Pages 构建/提交；切勿把 Preview 绑定改为 Production D1。
3. **不要通过 DROP TABLE 回滚。** 所有迁移均为添加表/索引，可能已含用户真实已保存简历；删除表将造成数据丢失。
4. 回滚后核对旧认证、岗位搜索和私有简历库功能未受影响；检查审计记录与错误告警。
5. 如发生用户数据错误或外发风险，保留审计证据，按照隐私和安全应急制度处理。

## 当前决策

功能继续保留在 Draft PR #405。通过当前的自动化和分层测试**并不意味着生产级整链路已验收**。未获得生产迁移与上线指令，不自动修改 `main`、Production D1、生产环境开关或 DNS。
