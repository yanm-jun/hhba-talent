# HHBA V8 精简版：可信招聘来源缓存

日期：2026-11-09。开发分支：`feature/match-v8-deepseek-dynamic-official-discovery-20261108`，PR #299（Draft），不合并 `main`。

## 目标与用户体感

用户只关心：**真实岗位、工作城市、资格是否符合、官方投递入口**。网页正文、学历经验、工作地点、岗位关闭状态和申请按钮必须逐条从真实页面检查。最费时、最耗搜索/Fetch 的“企业官网是否认可该招聘入口”可以在第一次完成独立核验后，按有限范围、短时效复用。

用户界面不展示复杂 Search/Fetch 阶段，也不显示无意义的后台核验提示；继续使用原来的紧凑 Top10。只有证据合格的岗位可以输出，不足10条则如实返回，不允许编造填充。

## 已开发

- `apps/web/functions/_lib/trusted-employer-source-cache.js`：将已完成企业独立核验的**来源关系**存为72小时缓存，并在读缓存时重新校验雇主名称、岗位主机、证明类型、允许范围、核验时间和过期时间。仅 `VERIFIED` 原始证明允许写入，不允许 Search 摘要、模型宣称、用户输入直接写入。
- 首次通过 `inspectPublicEmployer` 获得真实企业官网证明后保存：`CORPORATE_DOMAIN_AND_BRAND`（仅适用相同招聘主机）、`CORPORATE_EXACT_JOB_LINK`（仅该职位 URL）、`CORPORATE_NAMED_BOARD_LINK`（仅企业官网明确链接的招聘租户路径前缀）。
- 共享 ATS（飞书、热聘及其他跨企业供应商）**不继承整个平台的域名信誉**；不同企业、不同租户、不同职位前缀不会串通。
- 每次推荐仍需**重新 Search 发现并 Fetch 单条岗位详情**。任何关闭、境外/不明城市、缺少任职条件或申请入口的岗位，均不能因来源缓存而进入候选。
- 缓存读取失败、写入失败、已过期、缺少证据或不匹配时，回退到原来的完整官网验证；**不能“相信缓存”放行**。
- 统计仅增加 `trusted_source_cache.hits/misses/writes`，不保存简历、用户身份、搜索短语、招聘网页正文、模型输入或浏览器内容。

## 预览数据库与开关

新增迁移：`apps/web/d1/0021_match_v8_trusted_employer_source_cache.sql`。
已在 Cloudflare Pages **Preview 独立 D1** 创建 `hhba_match_trusted_employer_sources` 表及过期时间索引；Production 数据库未执行。
仅 Preview 设定 `HHBA_MATCH_V8_SOURCE_CACHE_ENABLED=1`，且应用层同时要求 `HHBA_MATCH_V8_DEEPSEEK_AGENT_ENABLED=1`、`HHBA_AUTH_ROLLOUT=preview`；表不存在则在发起本次付费检索前拒绝，以防账目/功能偏差。Production 不启用此功能，正式匹配和站外搜索仍保持关闭。

## 自动化验收与安全负例

- D1 内存模拟回归：第一次匹配 Fresh JD + 企业官网读取，第二次匹配**仍 Fetch 新职位 JD**，但是复用可信企业来源，**企业官网 Fetch 从1次减少为0次**，同源第二次调用总 Fetch 从2次减少到1次。
- 测试 72小时后失效、不同雇主、不同租户、同名近似前缀、假平台首页、过期与境外岗位、D1 读写故障。不会把职位当成永久有效。
- GitHub Actions **196/196 项测试通过**：[运行记录](https://github.com/yanm-jun/hhba-talent/actions/runs/42566324245)，其余代码与构建检查同一提交成功。

## 上线门槛

上一轮 DeepSeek 真正联网验收中，模型4次、Search6次、Fetch9次、浏览器补读1次，虽恢复1条可解析岗位，**最终仍为0条通过企业核验的职位**。本次缓存只减少对**已经核验成功的来源**的重复证明，不能凭空修复首次核验成功率。必须取得真实可信来源的首个正例，再复核真实 D1 缓存命中与完整资格硬门槛，才能考虑解除 PR Draft、合并 main 和向正式站开放收费匹配。

缓存上线不承诺 Top10 一定凑齐，不允许向公众展示未经核实的岗位。 
