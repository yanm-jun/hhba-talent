# HHBA 免费 AI API 匹配：预览验收与零付费防线（2026-11-13）

## 目标与状态
**当前仅独立分支和预览 D1 准备；不得将“代码/CI 通过”解读为 hhba.work 已启用。**
从 DeepSeek Search + V4 Pro 改为“官方职位审核 + 免费模型结构化解析 + 免费模型仅选择真实职位 ID”。
已存在的 PDF/DOCX 本地文字提取、真账号授权、R2 私有简历和两层缓存沿用。

### 免费服务商（必须是使用方真实的 Free 资格）
- Cloudflare Workers AI：固定模型 @cf/zai-org/glm-4.7-flash；Free 每天 10,000 Neurons。**Workers Paid 可能对超额推理收费**，所以未验证整个账户套餐前不能打开生产开关。新匹配逻辑每调用预留 145 Neurons；HHBA 自己的模型使用日预留上限 7,200 Neurons（不能覆盖同账户其他应用）。
- Groq Free：仅允许 openai/gpt-oss-20b；基准额度有 RPD 1,000/TPD 200,000/TPM 等限制，真实账户以 Groq 控制台为准。HHBA 额外保守限制每日约 16 次/120,000 预留 Token，最多每分钟 3 次。
- OpenRouter Free：模型 ID **必须明确以 :free 结尾**，拒绝 openrouter/free 或任意动态路由；免费账户通常每日 50 次请求，HHBA 仅预留 30 次/天。需要单独审批所使用的模型与供应商的隐私条款。
- Gemini Free：不接收用户简历，不加入自动备用池。
- DeepSeek：在零付费模式下，所有现有匹配/发现接口以及独立网申 AI 帮填均被明确拦截，**没有隐藏付费兜底**。

## 功能开关：全部默认关闭
代码的完整零付费模式至少需要：
- HHBA_ZERO_PAID_AI_ENFORCED=1 ；阻断旧 DeepSeek 入口
- HHBA_FREE_MATCH_ENABLED=1 ；启用原 /api/match-native -> /api/match-free 的后端改道
- HHBA_FREE_RESUME_PARSE_ENABLED=1 ；启用私有简历缓存
- HHBA_MATCH_LIMIT_PEPPER（密文/secret，至少 24 字符）
- HHBA_PNVS_AUTH_DB、ASSETS、简历 R2 和登录系统仍需有效绑定

**至少一个已人工确认免费计划的供应商：**
- 只有在确认 Cloudflare 账户为 Workers Free 且已添加 Pages Functions AI 绑定后，才能设 HHBA_FREE_AI_CLOUDFLARE_FREE_PLAN_VERIFIED=1。
- 只有 Groq 免费套餐真实有效、API Key 放进 Cloudflare Secret 且完成第三方处理评估后，才能设 HHBA_FREE_AI_GROQ_FREE_PLAN_VERIFIED=1、HHBA_FREE_AI_EXTERNAL_PROCESSING_APPROVED=1，并设置 HHBA_FREE_GROQ_KEY。
- Groq 处理**尚未缓存的脱敏简历正文**必须另外经过真实隐私和跨境传输评估，并显式设置 HHBA_FREE_AI_RAW_RESUME_EXTERNAL_APPROVED=1。默认不允许发送给 Groq 或 OpenRouter；结构化能力资料与正文分离。
- OpenRouter 最后备用，单独设置 HHBA_FREE_AI_OPENROUTER_FREE_PLAN_VERIFIED=1、HHBA_FREE_AI_OPENROUTER_ENABLED=1、HHBA_FREE_OPENROUTER_MODEL=<verified-model>:free、HHBA_FREE_OPENROUTER_KEY；不得使用通用路由或者任何没有 :free 后缀的模型。

> 所有“已核实免费资格”变量是**人工审批断言**，并不是系统能读取供应商账单的证明。假如账户计划变更，立即关闭并重新审批。当前 Cloudflare 连接无法读取 Billing Subscriptions（缺少 Billing Read），因此**不可以自动认定 Cloudflare Workers Free**。服务默认失败关闭，不使用付费兜底。

## 缓存、隐私和真实性
1. **简历档案**：在当前账号拥有已保存 R2 文件、授权且原文件 SHA256 相同的前提下复用。结构化字段存 D1，原文件仍在私有 R2；一次性新文件或手改文字不持久缓存。
2. **推荐结果**：按 owner + resume_id + SHA256 + 方向/数量 + 官方职位快照版本生成散列键；只为保存的简历缓存，15 分钟 TTL。命中后不读取 R2、不给 AI 发请求；过期才重新评分。
3. **职位来源**：只读取当前 Cloudflare Pages 静态官方岗位索引、同一版本 JD Audit 和 Facets；证据必须在 24 小时内，拒绝错版、来源不明、境外职位、学历/年限等硬门槛不符合的记录。AI 仅可给出输入的候选 ID 排序，不可生成公司名称、薪资或 URL。候选来自已核实的原岗位链接。
4. **个人数据**：后端核验真实登录、候选者角色、本人简历归属；不记录原始简历全文、手机号、API key 到日志或新缓存；新增隐私处理缓存表均使用外键 ON DELETE CASCADE，删除保存的简历时应联动删除其结构化简历与推荐结果。
5. **失效处理**：服务商免费额度用尽、额度记录 D1 不可用、模型不符免费白名单、职位审核过期、后台免费资格尚未核实，**立即停止新分析**。不能把缓存结果谎称刚刚完成在线搜索，也不能预测录用成功率。

## 数据库：预览与正式物理隔离
Cloudflare Pages 项目 hhba-talent：
- 预览 D1 HHBA_PNVS_AUTH_DB id: 8916eebc-c730-4597-8a6b-abe16cec1e40
- 正式 D1 id: 355929c2-92e0-43e5-92fe-b87f59f89a59（本轮**未修改**）
- 预览/正式 R2 分别为 hhba-private-resumes-preview / hhba-private-resumes-prod
- 新增预览表：
  - 0026_free_resume_profile_cache.sql (原有一次解析缓存)
  - 0027_free_ai_budget_and_recommendation_cache.sql (免费供应商预算预留 + 推荐缓存)
- 0027 迁移前记录的预览 D1 Time Travel bookmark 为 00000377-00000000-00005122-d44605847dc26bed9c6aa530963a8a06。
- 迁移只在预览 D1 执行成功，未动生产库。

## 自动测试结果
- CI: .github/workflows/hhba-free-resume-profile.yml
- 单元与协议验证：免费模型白名单、账本配额、禁用付费入口、Groq/O.R. 显式免费资格门槛、真实公司岗位 ID 白名单、旧简历复用、并发去重、授权失败、源审核过期。
- 完整合成请求：免费 PDF/DOCX 文字输入 -> 真实登录鉴权约定 -> R2 保存简历对应缓存 -> 免费解析 -> 免费职位排序 -> 相同请求再打开时零 AI 调用。
- 构建：Node syntax、TypeScript/Vite build，CI 结果见 PR 链接。模拟测试无真实求职者简历。
- 某些原有综合 CI 针对以前文案的历史断言失败；与本功能的专项 CI 分开跟踪，不可宣称全站 CI 通过。

## 仍未完成的上线条件
- [ ] 确认 Cloudflare 账号 Workers Free 套餐；给 **Pages Preview** 增加原生 Workers AI 绑定（变量名 AI），并在预览部署中验证绑定，不覆盖生产配置。
- [ ] 若使用 Groq / OpenRouter，申请并保管用户自己账户的免费 API Key，核对模型额度和允许的商业使用，再审批数据处理、隐私告知及必要跨境同意。
- [ ] 人工预览站实际验收：用虚拟用户授权测试、真实 PDF/DOCX 文件提取、首次与重复调用、岗位新鲜度、手机交互。
- [ ] 校验 Cloudflare 账户其他 Workers AI 项目耗额情况及成本账单；必要时采用单独的纯 Free 账号隔离。
- [ ] 生产 D1 另行建立恢复书签/审阅迁移，随后合并 main 并通过灰度开启；**本次没有进行这一步**。

## 回滚
下线新功能只需取消 HHBA_FREE_MATCH_ENABLED；若保持 HHBA_ZERO_PAID_AI_ENFORCED=1，旧 DeepSeek 也继续被禁止，不会因此产生付费调用。建议独立保留零付费总开关，不要因紧急业务恢复而放开旧付费路由。
