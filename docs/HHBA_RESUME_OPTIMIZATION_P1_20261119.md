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
