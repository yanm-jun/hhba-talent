# HHBA 简历匹配：直接投递链接 + DeepSeek 个性化理由

日期：2026-11-09  
开发分支：`feature/match-direct-links-deepseek-reasons-20261109`

## 目标与用户流程

用户登录并选择 PDF/DOCX 或个人私有简历，主动同意分析，点击「开始智能匹配」。后台沿用现有的简历文字本地提取、脱敏、DeepSeek 意图解析、官方职位检索与资格匹配。结果在原有弹窗中按相关性呈现不超过 10 个大陆岗位。

**每个岗位列表项直接显示：** 企业、职位、城市、薪资是否披露、参考相关度、根据简历实际经历撰写的「为什么推荐」、安全验证的官方职位详情/投递入口。不必进入二级岗位详情才能点击官方链接。岗位打不开或验证不通过时不生成猜测的直链。

## 技术边界

1. 继续使用 Cloudflare 服务端 `HHBA_MATCH_DEEPSEEK_KEY`；前端无密钥输入，不提交用户密钥，不把密钥写入仓库。
2. DeepSeek Search + Fetch 只做发现与读取；官方来源、国内工作地点、岗位职责和申请信息照常核验。AI 不创建职位或职位链接。
3. 在已有排序之后，增加一次可选 DeepSeek JSON 批量解释。要求每个推荐理由同时有「简历原文引用」和「岗位已审核材料引用」，逐条验证原文连续片段；不通过则使用已有确定性的相关性说明，保证可用性。
4. 从简历中明确写出的「意向城市 / 期望城市」提取城市偏好，只影响排序而不排除异地机会。支持「AI 产品」「AI Agent 产品经理」等方向。
5. 搜索或 AI 失败时不伪造 10 条，也不声称企业仍在接收申请。官方投递最终状态以企业网页为准。

## 验收

- `node --test scripts/match-ai-explanations.contract.test.mjs`
- `node --test scripts/resume-match-cloudflare.contract.test.mjs scripts/domestic-match-fusion.contract.test.mjs`
- `npm run build`
- 使用经过授权的测试简历、真正的 DeepSeek 服务端密钥和 Cloudflare Preview 登录态测试搜索、可点击直链、弹窗显示及移动端布局。

开发分支与自动化测试不能替代真实联网端到端验证。未经过预览和生产 Secret/D1 环境验收前，不宣称 hhba.work 的付费 AI 服务已上线。

## 预览环境

Cloudflare Pages 自定义预览分支名单现已加入本开发分支；本次提交用于触发仅限此分支的预览构建。正式站 main 未改变。
