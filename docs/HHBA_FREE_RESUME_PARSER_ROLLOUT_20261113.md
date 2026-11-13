# HHBA Cloudflare Workers AI 免费简历解析：一次解析，多次复用（2026-11-13）

## 目标与边界

- 目标：**已登录且授权的求职者**选用「我的简历」中存储的同一份 R2 PDF/DOCX 时，首次使用 Cloudflare Workers AI 提取一次结构化简历资料；以后选择同一份继续匹配岗位直接读取 D1 私有缓存，不再调用基础解析模型，也无需下载 R2。
- 未保存的新文件与用户主动修改的文字预览：出于既有“未授权不持久存储”的约束，临时解析**不缓存**；建议用户在「我的简历」里明确勾选私有存储授权并保存后复用。
- DeepSeek Search + 匹配原因生成仍会消耗 API 搜索/推理费用。此次改造只降低**基础简历解析成本**，不是整个推荐流程免费化。
- 中国大陆岗位、真实岗位入口核验、用户登录、授权、原本的工作资格门槛不变；不夸大录用概率。

## 已编写的改动

1. `functions/_lib/free-resume-profile.js`：`@cf/zai-org/glm-4.7-flash`，设置 `chat_template_kwargs:{enable_thinking:false}` 避免浪费 reasoning tokens。输入脱敏、最多 1 万字；只缓存学历、可证实的工作年数、技能、职业方向和证据片段。
2. `d1/0026_free_resume_profile_cache.sql`：简历 ID、所有者、原文件 SHA256、解析版本、单飞锁、JSON 结果；原始 PDF/DOCX 仍在私有 R2；删除简历时 D1 外键级联删除缓存。
3. `api/match-native/[[path]].js`：先验证真实账户与文档所有权，再读取缓存；无缓存才要求本地提取文字。已有缓存即使每日新解析上限已满也可复用。
4. `src/services/resumeMatch.ts`、`src/pages/CandidateMatchPage.tsx`：保存简历二次使用优先走无正文网络请求；未命中时按 428 状态回退首次解析，不绕过显式授权。
5. `scripts/free-resume-profile-cache.contract.test.mjs`：测试首次/再次、并发、编辑分流、每日限额、绑定缺失时拒绝回退付费解析。
6. 当功能开关不存在时，**原页面保持此前调用路径**，不会自动启用。

## Cloudflare 环境状态

- Cloudflare Pages 项目 `hhba-talent` 正式分支 `main`。
- 预览和正式 D1 / R2 绑定不同。
- **仅预览 D1** `HHBA_PNVS_AUTH_DB`（`8916eebc-c730-4597-8a6b-abe16cec1e40`）于 2026-11-13 创建两张缓存表；此前记录的 D1 时间旅行 bookmark 为 `00000372-00000000-00005122-668b5e91ddb1b5aba6d408053c45fbe4`。未迁移正式 D1。
- 预览/正式 Pages Settings 里尚未存在 Workers AI `AI` binding。勿误以为代码已自动生效。
- **仅预览环境**：前往 Cloudflare Pages → `hhba-talent` → Settings → Functions/Bindings → Preview environment → Add → Workers AI → variable name `AI`；另设置预览环境普通变量 `HHBA_FREE_RESUME_PARSE_ENABLED=1`，之后必须重新部署预览分支使绑定生效。**不要修改 production bindings 或环境变量**。
- Cloudflare 的 Pages 项目 API `ai_bindings` 当前仍被描述为需 `project_id` 的旧 Constellation 绑定，不要猜造项目 ID 或覆盖整份 Pages 配置；推荐使用 Pages 控制面板正确添加 Workers AI 绑定。

## 上线验收

- [x] 新增 SQL 仅预览 D1，且迁移成功
- [x] Cloudflare Workers AI GLM-4.7-Flash 真实 API 使用**合成文字**做 JSON Mode 及关闭 thinking 的连通验证
- [x] 6 项新缓存协议测试通过（GitHub Actions）
- [x] 独立 CI 的 Node 语法、专项测试和 TypeScript/Vite build 已通过
- [ ] Cloudflare Pages 预览 AI binding + 预览环境 flag 生效
- [ ] 预览站真实候选人授权流程：文本版 PDF / DOCX 首次解析，重复调用 `resume_profile_source==='CACHED'`，确认 Workers AI 调用次数不增加
- [ ] 同步双击、换设备、编辑预览文字、删除简历再上传、500/429、最大限额及跨账号访问安全测试
- [ ] Cloudflare Workers AI Neurons 监控与峰值成本审计，必要时调小 `DAILY_PARSER_CALL_CAP`
- [ ] 生产 D1 备份 + SQL；人工验收后方可合并并开启正式环境开关

## 预算防线

- Workers AI 当前公开免费额度每天 10,000 Neurons（整个账户共享，UTC 00:00 刷新）；不同模型、简历长度会导致可解析份数变化，不能直接承诺每日 342 份。
- 本功能安全上限：每日新模型调用数 120，计算在 D1 单次条件 INSERT 中，针对本功能防止并发冲爆额度。**它不是对整个 Cloudflare 账户 Neurons 的严格账单上限**，其他 Workers AI 调用共享免费额度。
- 免费套餐额度用尽可能返回失败；付费套餐可能计费。上线前应确认计划类型、额度告警或账户级收费控制，防止意外账单。
- 正式环境的 DeepSeek 岗位检索和匹配预算控制为**单独议题**，不能把“简历解析免费”等同“每次岗位匹配免费”。

## 数据删除与用户说明

- 已保存的结构化缓存绑定账号 + immutable resume id + 文件 SHA256 + schema_version，不放入 localStorage；只有求职者本人持授权会话才能取回。
- 简历删除依赖私有 D1 `ON DELETE CASCADE`，上线验收必须确认外键启用。
- 不缓存从没有存储授权的临时简历；如需支持临时简历跨会话复用，必须另行设计用户同意与数据清除机制。
- 页面与隐私说明应明确 Cloudflare 和 DeepSeek 分工、何时处理资料、数据保存和删除规则。

## 独立验收 CI

`.github/workflows/hhba-free-resume-profile.yml`；生产功能**默认关闭**。另有历史综合 CI 断言部分基线文案不一致，未因本次改造而一并更改，不应因此在未经验收前强行合并到 main。
