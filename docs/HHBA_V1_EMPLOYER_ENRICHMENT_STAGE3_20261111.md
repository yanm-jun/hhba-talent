# HHBA V1 · S3 企业官网资料自动补全与多维分类（内部能力）

**开发分支**：`feature/hhba-v1-employer-enrichment-stage3-20261111`，父分支为 S2，S2 又依赖 S1。当前不得直合 `main`。
**目标**：DeepSeek 为现有职位搜索找到公司后，后台顺路记录企业；下一步基于公开企业介绍自动提出主营行业和其他业务标签。普通求职者不可看到或编辑此分类引擎。

## 当前已实现

1. S2 `knowledgeCaptureCallbacks` 保存岗位匹配的候选企业后，只有当 Preview 专用开关被显式打开才继续 S3，且仍使用原有 Cloudflare `waitUntil`。不会把用户简历送进 S3。
2. `employer-enrichment-v1.js`：根据公开的候选企业显示名向 DeepSeek `/v1/tools/search` 搜索企业官网介绍，审查 HTTPS/网址类型；Fetch 最多两条候选页面（逐条尝试），要求页面正文出现该企业名称与公开业务描述。
3. DeepSeek Responses 使用已提取的公开企业资料，输出严格 JSON，主营行业、其他行业、具体业务线、业务场景与技术领域分别分类。**所有标签均要通过 S1 既有分类字典检查和正文连续引文检查**；不接受 AI 自创标签或无原文证据的臆测。
4. `0022_employer_enrichment_v1.sql`：只新增内部队列表、企业证据表、多维标签建议表、UTC 日预算表；企业所有权、招聘来源与岗位在招状态不升级。标签始终 `PROPOSED`，证据始终 `SOURCE_CANDIDATE`。
5. 去重：候选企业以“名称+实际搜索来源主机”保持独立；证据以企业观察+公开页面 URL 去重；标签以企业观察+证据+维度+标签去重。审核者修正的行不被自动采集覆盖。
6. **成本和滥用边界**：只在 Preview 中 `HHBA_EMPLOYER_ENRICHMENT_ENABLED=1` 且原有 `HHBA_KNOWLEDGE_CAPTURE_ENABLED=1`、DeepSeek key 和 D1 均齐备时启动。每天最多预留 8 个新的企业补全运行，每次用户请求最多触发一个、至多 1 Search + 2 Fetch + 1 模型；超时、失败做最多 3 次退避；默认全部关闭。
7. 不存在可供普通用户调用的 S3 API，不新增用户页面；不存储简历正文、账号信息、原始完整企业网页、模型完整回复或 API 密钥。

## 状态机

```text
DeepSeek 找到的公开岗位候选
 -> S2 企业观察（PENDING，非验证主体）
 -> S3 队列（PENDING）
 -> 已预留预算 + 已租约领取（PROCESSING）
 -> DeepSeek Search 官方介绍候选 -> Fetch 公开企业正文
 -> 模型标签建议 + 本地字典与原文引用交叉验证
 -> 公开企业页面证据 SOURCE_CANDIDATE + 标签 PROPOSED + 队列 DONE
 -> [下一阶段独立审核] 主体/官网/ATS 归属验证后才进入可信来源库
```

**区分三层**：
- `PRIMARY_INDUSTRY`：企业主营方向建议，不能用某个招聘岗位职能代替。
- `ADDITIONAL_INDUSTRY`, `BUSINESS_LINE`, `BUSINESS_SEGMENT`, `TECHNOLOGY`：次要行业、具体业务、应用场景、技术方向，可多标签。
- 岗位职责、技能、专业仍独立存入 S2 的职位观察；用户画像依然属于用户私有授权数据，不混进这套企业表。

## 代码与安全验收

- Node 22 离线合约测试包含 S1/S2/S3；使用模拟 DeepSeek 提供者和模拟 D1，无真实 API Key、费用和简历。
- 上线 Preview 数据库需先核验 `0021_knowledge_capture_v1.sql`，再执行 `0022_employer_enrichment_v1.sql`；不要自动运行到 Production。
- `HHBA_AUTH_ROLLOUT=preview` 是 S3 实际运行的强制条件；仅设置 `HHBA_EMPLOYER_ENRICHMENT_ENABLED=1` 而没有 Preview 标记也不得工作。
- 两个开关默认为 off，不能仅凭代码已提交就宣称已经积累真实企业。
- 成本账本记录“尝试预留”而不是提供商实际账单；失败/超时后可能已产生费用，不假定免费。
- 证据页 URL 只是从 DeepSeek 搜索得到的候选，不等于已经由企业官网确认；人工审核或机器可复验的官网所有权链接需另做。
- DeepSeek 搜索/Fetch 可能访问不到动态 JS 官网或返回不完整内容，遇到这种情况应保留待审核而不是猜标签。

## 当前验收清单

- [x] 分支独立，基础 SQL、补全器、私有标签审查链、离线测试与 CI 文件已提交。
- [ ] GitHub Actions S1+S2+S3 专项测试全部通过。
- [ ] 隔离 Preview D1 迁移、合成企业试写、回滚测试。
- [ ] Preview 分支真实构建成功后开启开关，测试真正 DeepSeek 搜索→D1 候选写入→企业资料补全的最小闭环（不使用个人简历）。
- [ ] 核查其它既有 CI 的报错是否来自主线，不能宣称全仓通过。
- [ ] 确认真实官网归属审核和标签准入后的下一阶段，才考虑合并主线。

**最终原则**：S3 在分支验收前，不合并 `main`、不部署 `hhba.work`、不运行生产 D1 迁移，也不为达到标签数量而编造任何企业业务。
