# HHBA 岗位定向 AI 简历优化 — P1（2026-11-19）

状态：Draft PR #405，未合并 main、未部署、未完成模型实测。

## 用户流程
- 在 `/candidate/match` 获得岗位卡片后，点击「针对这个岗位优化简历」。
- 展示**已提取的简历证据片段**，不是对原始 PDF/DOCX 的完整重排。
- 登录了 PNVS 求职者账户的用户，可在明确勾选授权后请求后台 AI。
- AI 返回分段建议，以 Siri 风格渐变文本直接显示在原有证据片段下方。
- 用户须逐条核实真实经历后点击「填充此建议」，也可保留原文、恢复本次预览。
- 原始简历文件、岗位推荐参考分均不被此功能自动更改。

## 组成
- `src/components/TargetedResumeOptimization.tsx` / 专属 CSS：原位对照与用户确认。
- `src/services/targetedResumeOptimization.ts`：提供商无关的版本、建议、填充验证。
- `src/services/resumeOptimizationApi.ts`：已登录的同源请求。
- `functions/api/resume-optimize.js`：PNVS 求职者鉴权、同源检查、授权、额度限制、常见联系方式脱敏、错误屏蔽。
- `functions/_lib/resume-ai-provider.js`：服务端 provider adapter；不向浏览器传密钥。
- `d1/0020_resume_optimization_usage.sql`：只存请求 ID、日期和带 pepper 的用户哈希，不存简历文本、模型回答、手机号或 token。

## 部署开关（仅部署侧操作，**不要**把密钥提交到 Git）
1. 在目标环境的 `HHBA_PNVS_AUTH_DB` 先执行 `apps/web/d1/0020_resume_optimization_usage.sql`。
2. 确保 PNVS 求职者登录与 `VITE_HHBA_REAL_AUTH_ENABLED=1` 符合当前环境。
3. Preview 配置 `HHBA_AUTH_ROLLOUT=preview`；production 按既有风控流程配置 `HHBA_MATCH_RUNTIME_MODE=production`。
4. 配置现有 `HHBA_MATCH_LIMIT_PEPPER`，以及 `HHBA_RESUME_OPTIMIZATION_ENABLED=1`。
5. 配置 `HHBA_AI_DEFAULT_PROVIDER=deepseek` 或其他服务商，以及相应服务端密钥和模型，例如 `HHBA_AI_DEEPSEEK_API_KEY` 与 `HHBA_AI_DEEPSEEK_MODEL`。也可使用 `HHBA_AI_RESUME_OPTIMIZATION_PROVIDER` 单独决定简历润色供应商。
6. 当前预置：`deepseek`、`openai`、`anthropic`、`gemini`、`qwen`、`zhipu`、`groq`、`openrouter`。模型 ID 必须由管理员根据提供商实际可用型号设置。

### 风控与披露
- **明确授权**是每次发送简历证据的前提。会脱敏常见邮箱、电话和中国身份证号，但不能保证去除所有个人信息；请自行审阅内容。
- 每账号每天最多 3 次，平台每天最多 50 次；额度写入 D1，异常模型回复亦占一次。
- API 故障不覆盖简历，不自动投递，不将模型输出写入数据库。
- 当前职位是上游岗位匹配的结果快照；此优化流程不重新核验岗位在招状态。
- 当前用户只修改内存预览，不支持 D1/R2 版本保存、导出、原始 PDF 排版回写。
- 不能把上游相关性参考分当录用概率；更不能在尚未实现同规则评分重算前显示伪造的“优化后匹配分”。

## 验收
- 新增 `scripts/resume-optimization.provider.test.mjs` 和 `scripts/resume-optimization.route.test.mjs`。
- 单独的 `HHBA Resume Optimization CI` 覆盖这两组测试、TypeScript/Vite 编译。
- 合并前需通过 CI、实测一个有效模型（无私密数据）、核实模拟额度耗尽、校验移动端及浏览器交互。
- 后续 P2：完整简历编辑数据结构、持久化版本、可解释的岗位要求覆盖分析、基于同一规则重评分与导出。

## P1.1 增量：岗位专属版本与文本证据对比
- 新迁移 `d1/0021_targeted_resume_versions.sql`，新增云端保存开关 `HHBA_RESUME_VERSION_STORAGE_ENABLED=1`；迁移未执行、开关未开启时功能返回 503，不误报保存成功。
- `functions/api/resume-versions.js`：只允许 PNVS candidate 保存、列出或删除自己的简历片段版本。POST 必须同源；最多保存 15 个版本，每个版本最多 12 个片段。数据保存在 D1，包括用户主动保存的文字，**并非端到端加密**，不得宣传为零数据留存。
- 用户必须先真实采纳至少一条建议，才能主动点击保存。旧版本可从列表载入或删除，原始 PDF/DOCX 始终不被改写。用户资料保存属于独立操作，不依赖第三方 AI 处理授权。
- `src/services/resumeEvidenceVisibility.ts`：对上游岗位卡片中的 `matched` 与 `not_evidenced` 做保守的文字三元组覆盖检查。前后使用同一个规则；这只是**实验性的文字证据可见度**，不是与官方 JD 精准匹配，更不是原有参考分的重新计算，不能承诺提高真实录用率。
- `request_evidence` 类型建议必须由用户亲自填写真实内容、核实后才允许填充；不能用 AI 代写虚构事实。
- 新增版本保存、账号隔离、授权、无证据填充、旧建议覆盖保护等测试。
- 后续 P2 仍必须衔接完整且稳定的岗位 JD、原有匹配算法和用户确认后的职业档案，才能重新计算原岗位匹配分。上线前需完成隐私评审、实际模型联调、可撤回的数据保存说明和浏览器/移动端验收。

### 版本保存开关
```text
HHBA_RESUME_VERSION_STORAGE_ENABLED=1   # 仅部署迁移后启用
HHBA_PNVS_AUTH_DB=<D1 binding>          # 按环境隔离
```

## P1.2 增量：可编辑、可打印简历
- `src/services/resumeDocument.ts`：将现有的学历证据、岗位/企业/时间、工作经历和技能证据组织为结构化简历文档。**无法从来源可靠取得的姓名、联系方式、职业概述、教育细节全部留白**，由用户自行填写。
- `src/components/ResumePrintSheet.tsx` 与 `styles/resume-print.css`：简洁 A4 单栏、便于 ATS 读取的正式排版。用户通过浏览器「打印／保存为 PDF」，不需要任何额外付费 PDF API。打印稿不含渐变 AI 建议或编辑控件；分页与浏览器样式仍需真实浏览器验收。
- `TargetedResumeOptimization.tsx`：新增联系信息与个人概述的手动输入、A4 预览切换、打印，以及直接编辑经历/技能段落。AI 再次生成建议将以**当前已编辑版本**为输入，不清空之前的用户修改。
- 私人版本现在可包含用户明确保存的联系信息、学历细节与概述；后端限制字段、长度、只接受明确 `confirmed_real:true` 的保存请求。用户仅手动修改、未采纳 AI 建议也可以保存。
- 联系信息会**仅在用户主动保存时**进入 `HHBA_PNVS_AUTH_DB`；不与第三方 AI 润色请求一起自动发送。但其他简历段落可能包含敏感内容，发给第三方 AI 时会尽力脱敏、不能保证完全去识别化。
- `scripts/resume-document.contract.test.mjs`、`scripts/resume-optimization.domain.test.mjs` 和版本存储测试涵盖不虚构资料、手工编辑、长度限制及云端保存授权。

### 匹配评分的现实限制
- 现有 V2 `scoreCandidateFit` 必须得到与初次匹配一致且可核验的完整岗位对象（所需技能、学历、地点、工龄等）和重新解析且有证据的求职者资料。
- 目前 `/candidate/match` 页面收到的 `JobMatch` 只是显示用字段（匹配理由、参考分和部分要求），**不足以安全重算同一岗位的参考分**；不能以词语覆盖率偷换岗位匹配分。
- 下一阶段需在既有匹配后端增加受信任 JD 快照、版本化简历的证据重提取与同一 V2 评分契约，最后做匹配前后解释。当前页面只显示独立的“文字证据覆盖”指标。

## P1.3 增量：复用原有 Ranking V2 的可信岗位复评（2026-11-19）
- `functions/_lib/resume-reassessment.js`：复用 `scoreCandidateFit`，对初始简历片段与当前简历片段使用**相同审核岗位、相同候选人原有属性、相同 V2 评分权重**，得到两个独立的可对比评分及岗位技能差异。
- `functions/api/resume-reassess.js`：仅允许登录的 PNVS 求职者、明确确认改写事实且同源的 POST 请求。只从本站静态 `/data/jobs.json`、`/data/job-sync-status.json`、`/data/job-search-facets.json` 获取岗位，按同一官方 ATS ID、平台、官方网址、JD 摘要 hash、最新更新时间、中国大陆地点等条件认证；不允许浏览器提交替代 JD。
- **局限**：当前只支持能在本站新鲜审核快照中找到的中国大陆 ATS 岗位，不支持无快照/失效快照/站外 DeepSeek 搜索候选岗位，亦不支持境外职位。无可信岗位输入时拒绝评分。
- **与旧分数的区别**：初次匹配卡片可能来自不同数据源和业务链路。界面显示的是本次 V2 引擎下的「修改前重新计算」与「修改后重新计算」，不应拿旧卡片分数作为同算法基线。两份分数仅用于简历匹配参考，不是企业录用概率。
- 候选人学历和工作年限维持相同的原有解析结果，不随润色提升；新增技能只在已确认简历文本**明确写到岗位标签**时纳入，不会让 AI 单凭想象增加证书、学历或年限。
- 用户传入的简历文字和原有候选人属性并不是独立第三方核验结果；即使分数上升，仍需用户核实真实性、符合任职资格，并以企业官网为准。
- 该复评 **不调用生成式 AI**，不将简历或分数写入额度表。新增 `d1/0022_resume_reassessment_usage.sql`，只存请求 ID、日期和 hash，默认每人每天 12 次、全站每天 400 次。
- 新增部署开关 `HHBA_RESUME_REASSESS_ENABLED=1`；只有已完成 0022 迁移，且现有候选人登录、官方快照与 ASSETS 绑定可用时才启用。
- 测试：`scripts/resume-reassessment.domain.test.mjs`、`scripts/resume-reassessment.route.test.mjs`，并纳入独立 CI。尚需真实浏览器与真实官方快照灰度验收。

## P1.4 增量：接入当前搜索式智能匹配入口
- `src/pages/CandidateMatchPage.tsx` 现在在一次浏览器端 PDF/DOCX 文字提取后，把同一份文字用于现有匹配与后续简历优化；不会因为打开优化器而重新触发整个岗位匹配。若用户已在预览文本框中修改过内容，使用的永远是修改后的文字，绝不无声回退到原始上传文件。
- `src/components/CandidateMatchNativeDialog.tsx`：在当前搜索式岗位推荐卡片添加「针对这个岗位优化简历」，完成匹配后直接打开同一 `TargetedResumeOptimization` 编辑器；流式未完成的结果不开放完整优化。
- 现有 `MatchProfile` 暂不提供可核实的结构化雇主/工作经历，所以 `sourceResumeBlocks` 将已脱敏的浏览器本地原文按段落划分供用户亲自整理，并明确标注为「简历原始文字 · 待结构化」，打印稿也标明「原始内容（请检查并整理）」。**不能把尚未解析的原文段落冒称为已验证的工作经历、企业或职务。**
- 新的可编辑简历打印排版、保存与多模型润色统一复用旧版组件。处理过的原始文本只存在当前浏览器页面状态，不会因开启优化器而自动入库。
- 官方 ATS 的 V2 重评分目前只覆盖通过 hash 和同版快照校验的中国大陆站内职位；以 DeepSeek Search 联网发现的站外候选岗位暂时只支持润色与文字覆盖提示，**不提供不真实的重新评分**。
- CI 要覆盖 `CandidateMatchPage.tsx`、`CandidateMatchNativeDialog.tsx`、打印文档原文回填，必须保持原匹配页的隐私与预览文本回退保护。

## P1.6 新增：搜索式推荐的企业官网直接核验与 V2 复评（未部署）
- 对当前 DeepSeek Search 给出的任何岗位网址，不再仅凭搜索摘要或模型声称的公司名称就创建可信 JD；仅由用户明确点击「核验这个企业岗位」，同意只访问该公开企业招聘详情后，由服务端尝试核验。
- 现阶段严格复用 `safeOfficialJobLocator` 的有限白名单及具体详情路径：腾讯、华为、美团、京东、百度、字节跳动等已实现识别规则的招聘页面。通用招聘平台、无法确认归属的域名、需跳转到第三方的页面、不支持的招聘站会**拒绝核验**，不能用看似合理的 AI 文本补齐。
- `functions/_lib/official-job-evidence.js`：服务端通过 HTTPS 直接抓取精确规范化的官网 URL；严格禁止自动重定向，限制网页大小和超时，过滤脚本/样式后调用现有 `extractOfficialJob` 检查真实页面的岗位职责、任职要求、岗位标题及中国大陆工作城市。内容不满足严格校验则直接失败。
- `functions/api/official-job-verify.js`：仅 PNVS 求职者、同源、明确核验授权；D1 额度每账号每天最多 4 次、全站最多 120 次。新迁移 `d1/0023_official_job_evidence.sql` 存储**仅公开企业 JD 内容**（岗位 URL、标题、公司、工作地点、任职要求、内容 SHA-256 摘要与抓取时间），不存姓名、简历或账号。相同有效岗位证据缓存 24 小时，允许复用而不增加官网抓取次数。
- `functions/api/resume-reassess.js`：新增从服务器自行保存的 `verified-official-<hash>` JD 快照获取 V2 评分输入；缓存须经过 TTL、URL 白名单、内容摘要一致性检查。浏览器不能替换已核验 JD、技能要求或企业名称。其他原 ATS 审核快照路径不变。
- `TargetedResumeOptimization`：搜索式岗位核验结果会明确展示**从官网实际读到的企业、职位和地点**。用户再次确认这是自己需要的岗位后，才允许复评；若来源不符，不能继续。无可信快照时仍只提供原位润色和独立文字覆盖检查。
- 如果原搜索式解析没有目标职业，复评仅以用户选择的这个岗位作为**目标方向**（role hint），两份简历使用相同意向与 V2 权重；这不构成已具备该岗位技能或任职资格的证明，界面显式告知。
- 新单元/路由测试 `scripts/official-job-evidence.contract.test.mjs`、`scripts/official-job-verify.route.test.mjs` 覆盖：严格 URL 白名单、无自动跳转、无完整 JD 必须失败、篡改摘要、过期证据、本人授权、每日额度与缓存复用。追加 CI 后构建。
- **不能等同人工法务/HR 审核，不保证页面仍允许申请**。该技术核验只证明服务器读取到了满足规则的受支持招聘官网页面；严禁宣传为企业已认证本人的资格。
- 上线时先执行 `0023` 迁移，再灰度配置 `HHBA_OFFICIAL_JOB_VERIFY_ENABLED=1`；需要同时具备 `HHBA_RESUME_REASSESS_ENABLED=1` 与 0022 复评额度迁移，才能展示更新后的 V2 分数。
