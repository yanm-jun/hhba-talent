# HHBA V1 企业与人才双向智能分类引擎 — Stage 1 审计与架构方案

审计日期：2026-11-11（仓库 GitHub connector 只读审计）
仓库：`yanm-jun/hhba-talent`
审计基线：`main@f7325265e08f1b24a59f9d7e71aac05bf7d521ac`
独立分支：`feature/hhba-v1-dual-classification-stage1-20261111`
生产域名：`hhba.work`（**本阶段严禁部署**）
阶段范围：可复用代码审计 + 多标签与身份候选纯函数 + 合成测试 + 工程设计；不调用实际 DeepSeek、不建生产表、不启动后台任务、不更改现有页面。

## A. 当前 main 的复用审计（源码证据）

| 领域 | 当前代码/数据 | 结论及 V1 接入 |
| --- | --- | --- |
| 官网岗位发现 | `functions/_lib/deepseek-search-match.js`, `domestic-search-fetch.js`, `match-employer-source.js`, `api/match/discover.js` | 复用 Search/Fetch、企业招聘系统候选判别和安全过滤；**页面/域名形态不是企业所有权证明**。现有独立 Discover 使用明确授权、同源及配额。 |
| 职位相关性 | `functions/_lib/match-ranking.js`, `domestic-match-fusion.js`, `match-job-quality.js` | 保持已有 100 分解释性排序、国内地点与资格门槛；先扩大核验候选召回，不另起第二套推荐器。 |
| 简历理解 | `functions/_lib/resume-match-core.js`, `resume-role-evidence.js`, `src/services/resumeMatching.ts` | 已有学历、技能、工作经验和职业方向的证据约束，V1 只处理已验证的结构化字段；专业与项目新字段须独立证据核验。 |
| 私有简历 | `functions/api/resumes/[[path]].js`, `d1/0007_private_resumes.sql`, `src/services/privateResumes.ts` | 保留当前登录后 R2 私有简历管理及 D1 元数据，独立授权不可合并。 |
| 匹配历史 | `functions/_lib/match-history.js`, `functions/api/match-history/[[path]].js`, `d1/0019_ai_match_history.sql` | 保存真实推荐快照和新链接比较；不是“已经投递”的证明；后续反馈表另行设计。 |
| 企业目录/内容 | `src/services/domesticCompanySearch.ts`, `companyDirectory.ts`, `employerProfiles.ts`, `src/data/employerProfiles/*.json`, `domesticRecruitmentRegistry.json`, `domesticRecruitment200Registry.json` | 复用企业名称、法人名称、别名、业务、行业、官网招聘入口、出处及审核时间；绝不能把母子公司或共用 ATS 自动合并。 |
| 岗位索引 | `ops/jobs-indexer`, `src/services/officialSearchIndex.ts`, `src/services/liveRecruitment.ts` | 复用已有索引与新鲜度信息；需测试实际线上接口、陈旧岗位回退和索引服务当前部署状态。 |
| 后台 | `apps/admin-preview`, `functions/admin-preview`, `functions/_lib/admin-access.js` | 沿用现有管理员访问控制，添加企业审核队列/来源证据/更新失败数据；不用另建 admin。 |
| CI | `apps/web/scripts/*.contract.test.mjs`, `.github/workflows/*.yml` | 采用原有 Node contract-test 风格，增加隔离 Stage 1 工作流。 |

**基线安全问题**：GitHub API 的 `branches/main` 报告 `protected: false`。在负责人建立保护规则前，合并流程需要严格人工控制（优先补上 PR 必经审查/检查）。本阶段仅改新分支。

## B. 未合并 PR 的继承/冲突清单（2026-11-11）

- **#319** `feature/home-personalized-recommendations-v1`：首页个性化 + 授权协同过滤 + 后台，另有候选 D1 `0020_home_recommendations.sql`；与 V1 用户画像、反馈、后台有概念交叉，**不得复制/重复建表**。保持草稿，先比较 schema / 事件边界。
- **#298** 基于 **#297** 的 V7：技能条件组、地点三态、跨城市去重、离线 Precision/NDCG/Recall；V1 推荐资格模块应在验收之后优先复用，避免把 V6/V7 代码又写一遍。
- **#297** V6：职业意向和实际经历分离、`ELIGIBLE / NEEDS_INFORMATION / INELIGIBLE`；V1 人才标签必须保留该语义。
- **#287** 全国动态官网搜索 + ATS 初步核验 + D1 缓存；该 PR 还新增 `0019_external_search_public_cache.sql`，与 **main 已使用的 0019_ai_match_history.sql** 存在编号碰撞风险。后续迁移需重新编号，先制定独立 schema 与迁移台账。
- **#63** 旧版多服务 AI 企业检索 POC 含独立 Python 项目/大量静态资产，**只借鉴安全边界，不整体合并**，避免恢复旧页面与重复开发。
- **#82/#96** 历史企业整合分支与现有静态档案重叠较大，不作为当前开发基线；新逻辑以 main 实际文件为准。

上述状态来自 GitHub PR metadata 与变更文件清单；**PR 的测试通过/预览部署状态未在本阶段证明**。

## C. V1 目标架构

```text
现有公开企业档案 + DeepSeek Search/Fetch 的公开候选
                      |
         [企业实体解析/疑似重复预警]
                      |
         [行业 + 业务多标签分类]
                      |
     [官方域名/ATS 归属证据审核门槛]
                      |
         已审核企业 -> 已审核来源 -> 有证据的具体岗位
                      |                |
                      +---- 共享岗位索引与版本/时效 ----+
                                                   |
用户本地解析 / 已验证简历字段 -> [个人职业画像] ----+
                    |                              |
             用户可修改职业意愿                 候选检索/硬门槛
                                                   |
                                        现有 match-ranking + Top 10
                                                   |
                                       匹配历史 / 自愿反馈 / 7天回探
```

**安全状态机：**
1. `DISCOVERED`：搜索命中或编辑录入；可能是假公司、非当前招聘。
2. `IDENTITY_REVIEWED`：法人/品牌关系、同名和别名的来源经审核；不代表招聘来源可信。
3. `SOURCE_VERIFIED`：官网拥有该招聘入口的可追溯证明，或企业官网明确授权链接指向对应 ATS 租户；**动态自动补入可信来源集合必须经过该可复验规则，不能因 DeepSeek 的文字断言入白名单**。
4. `JOB_DETAIL_VERIFIED`：具体岗位详情、城市、职责、要求、岗位 ID、申请入口由官方详情证据支持；如果招聘开放情况不可确认，继续标明 `OPEN_UNKNOWN`。
5. `OPEN_CONFIRMED`：从对应官方页面的明确开放申请证据核验并记录 `checked_at` 与短 TTL；无法确认时展示“需到官网确认”，不能自称实时在招。

**输出原则**：候选企业自动入待审核表，审核通过的来源才进入“可信白名单”；允许自动审核可机读的官方站→ATS 出站链接证据，但不允许凭模型文本或域名正则直接自动授信。

## D. 数据结构草案（本阶段不执行迁移）

保持 `D1`，不重建现有用户/简历/历史表，新增结构以经过冲突清理后的独立迁移文件交付：

| 对象 | 关键字段/索引 | 数据治理 |
| --- | --- | --- |
| `employer_entities` | `id`, `legal_name`, `brand`, `parent_entity_id`, `identity_status`, `source_evidence`, `updated_at` | 企业主体唯一 ID；母公司、子公司、品牌不靠字符串自动归并 |
| `employer_aliases` | `employer_id`, `alias_normalized`, `alias_type`, `evidence_url` | 同名冲突进入审核，未经证实不合并 |
| `employer_tags` | `employer_id`, `taxonomy_version`, `dimension`, `tag_id`, `evidence_source`, `review_status` | 行业、业务等维度交叉标签，保留来源与人工纠错 |
| `recruitment_sources` | `employer_id`, `canonical_host`, `ats_tenant_key`, `proof_url`, `proof_checked_at`, `verification_status` | 域名和 ATS 租户分别审核，不把 ATS 通用域名视为授权 |
| `job_source_index` | `employer_id`, `source_id`, `job_external_id`, `canonical_url`, `mainland_city`, `last_checked_at`, `status`, `jd_hash` | `(source_id,job_external_id)` 唯一，职位不同城市需保留独立记录 |
| `talent_profile_tags` | `owner_key`, `resume_id/version`, `taxonomy_version`, `dimension`, `tag_id`, `evidence_state`, `consent_version` | 按当前账户授权存储结构化标签，不复制简历原文 |
| `recommendation_feedback` | `owner_key`, `history_id`, `job_key`, `feedback_type`, `created_at` | “不合适/收藏/点开”不可等同录用或成功投递 |
| `recheck_queue` | `source_id`, `next_check_at`, `last_outcome`, `retry_count` | 先官方来源定期复查，后再加获授权用户的 7 天机会回探 |

重点索引：`(taxonomy_version,dimension,tag_id)`, `(employer_id,source_id)`, `(status,last_checked_at)`, `(owner_key,created_at)`。生产 D1 迁移必须在 Preview 验收、备份和版本核对后申请批准。

## E. 双向分类与关联检索

**企业侧：** 从当前企业审核档案的 `industry` / `overview` / `business` 出发，生成可交叉的行业与业务方向标签。DeepSeek 返回的分类只能是 `PROPOSED`。必须记录使用的字段、版本、标签含义和审核来源；企业主营业务标签不等于其当前招聘岗位标签。

**人才侧：** 复用已验证的学历、技能、工作经验与意向；职业意向 `career_intent` 和已证实经历 `demonstrated_role` 分开。大学专业/学历/项目如果缺正文证据，要求用户确认，不猜测。个人头像、证件号、手机号等不参与分类或搜索索引。

**岗位关联：** 岗位按“官方企业/来源/岗位 ID/国内工作城市/标题/职责/资质”等关联多个标签，通过企业标签与职业画像召回，再经过现有硬资格核验与排序；仅凭公司做新能源汽车，不代表推荐汽车岗位给每名求职者。候选不足 10 条就少于 10 条，不虚构。

**演示链路（不代表线上已跑通）：** `南芯科技` 的已审核档案可提出“半导体 + 汽车电子”跨行业标签，同时关联“电源管理、硬件研发、工业控制”。某用户已验证“自动化专业 + C/Python + 电路项目”时，可同时召回硬件、嵌入式、控制算法等方向；每条具体岗位仍必须查验官方条件和城市，职业转型意愿不得伪装成已做过该工作。

## F. 分阶段开发顺序

| 阶段 | 内容 | 交付和合并门槛 |
| --- | --- | --- |
| **S1 当前** | main/PR 审计、接口与 schema 设计；隔离企业/人才标签纯函数、来源候选校验与回归测试 | 无正式站改动，无任何模型调用或真实数据持久化 |
| S2 企业身份 | 企业主体/别名去重、来源证据状态机、审核队列、与既有静态档案增量导入 | 同名不同公司不误合并，可信来源必须有证据 |
| S3 人才画像 | 从已有简历解析提取专业/项目/技能/意向交叉标签，用户修改确认、授权删除/撤销 | A/B 用户隔离，未知不强行判负，删除后不可继续用于推荐 |
| S4 岗位关联 | 复用 Search/Fetch 与既有岗位索引，可信官方详情持久化、更新时效和交叉召回；接 V6/V7 | URL、地点、JD、要求、状态全链可复核，旧版 Top10 回归 |
| S5 反馈闭环 | 接现有匹配历史，保存“相关/不适合/收藏/跳转”反馈；审视 #319 复用 | 反馈不混成投递/录用，不允许未授权协同学习 |
| S6 定期回探 | 增量官方来源更新 + 用户可关闭的 7 天新机会回探；后台告警 | 预算、限频、失败退避、用户撤销、真实新增判别通过 |
| S7 商业化预留 | C 端免费；B 端广告位/签约与成功入职事件留证 | 广告和自然排序标识分离；付费不绕过资格与官方来源门槛 |

所有阶段执行 **独立分支 → 本地/CI 测试 → 独立 Preview/D1（必要时）→ 用户验收 → 合并 main → 经授权部署 hhba.work**；下一阶段才引入必要的运行时功能，不抢跑发布。

## G. 隐私、真伪、成本、性能和交付风险

1. **企业误归属/冒名 ATS**：Search 结果只当线索；官网官方出站证明、ATS 租户一致性和人工例外审核；禁止第三方职位板和无证据链接。
2. **闭岗、过期、境外**：岗位详情来自核验源，国内城市必须明确，开放状态独立判断，过期则降级/隐藏；不得将“搜索到了”当“在招”。
3. **职业画像误判**：只有证据支持的技能和经历可作为资格依据；用户意愿和历史经历独立；模型输出始终经服务端 schema 校验。
4. **账号和简历**：沿用 PNVS 会话、私有 R2 与 D1 行级账户约束、独立 AI 同意。用户改正/撤销/删除需传播到画像、反馈与回探，检查备份保留和法定授权文案。严禁明文简历写入公共索引、日志、客户端埋点。
5. **API 成本**：先命中经核验且未过期的企业/职位索引；缓存 miss 才搜索；按 Search/Fetch/模型分别记录次数和费用。限频、并发上限、失败退避、总额硬限和运营开关必须在 S4/S6 验收。
6. **性能**：预计算企业标签；以标签倒排索引 + 日期索引做候选召回，禁止每次读取全量企业 JSON 再联网查询；服务端限制推荐数量/响应体，索引失效回退到可信旧数据或明确提示。
7. **PR 分叉与数据库冲突**：#287 的 0019 命名碰撞、#319 的 0020、V6/V7 从旧主线分叉；先 diff/rebase/映射迁移再选实现，不能直接把整组未验收 PR 合并。
8. **安全回滚**：不改原表/不覆盖原记录、引擎 feature flag 默认 off；Preview 与 Production 独立配置，生产落地需要备份点和反向开关。
9. **商业化**：广告和签约企业不能享有隐形匹配加分；有效投递及成功入职必须具备用户主动授权、事件来源与协议，广告内容明确标记，法规与签约文本另行审查。

## H. Stage 1 验收标准和结果边界

**此分支应满足：**
- 源码审计与冲突清单保存在仓库；
- 企业跨行业/业务标签自动提出，所有标签保留 `PROPOSED`；
- HTTPS URL 形态只进入 `REVIEW_REQUIRED`，不自动写入可信白名单；
- 第三方招聘平台、明文 HTTP、凭据 URL、IP、本机 URL拒绝；
- 同名公司、共用集团/ATS 不自动合并；
- 经验证的个人画像输出职业意向、实际经历、技能主题三个独立维度；
- 缺少专业证据不猜专业；输出无简历正文、个人联系方式；
- Node `contract.test.mjs` 使用合成数据，CI 通过；
- **没有修改生产网站、D1、R2、DeepSeek 开关与主分支。**

**尚未验证/不宣称完成：** 真实用户简历测试、官方企业来源的实时身份/在招审核、Preview 网站部署、数据迁移、收费系统、定期回探和算法真实 Precision@10。上述是后续阶段的验收项。
