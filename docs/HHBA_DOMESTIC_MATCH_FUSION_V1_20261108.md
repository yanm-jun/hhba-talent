# HHBA AI 智能匹配：双渠道排序算法 V1

时间：2026-11-08
开发分支：feature/match-domestic-fusion-top10-v1-20261108。
本 PR 叠加在 #284（DeepSeek Search/Fetch 国内职位发现），#284 再叠加在 #283（现有简历匹配）。三个 PR 均保持草稿，禁止未经用户验收合并 main。

## 核心目标
以有来源、有职业证据、有地区核验的岗位为输入，不由 AI 凭记忆生成企业或职位。默认只推荐中国大陆境内工作地点。
站内岗位必须来自现有同版完整 JD/要求审核器，站外候选须来自 DeepSeek Search + Fetch 后通过固定官方招聘网址、职位详情、岗位要求、国内城市及时间检查。
站外候选只有当网页包含申请入口时才具备纳入候选条件，且必须显著提示开放状态 NEEDS_OFFICIAL_CONFIRMATION；不得称“正在招聘”“已核验开放”。

## V1 排序
1. 先筛掉不符合来源、超时效、地点不明确或经验/学历明确不满足的职位。
2. 目标岗位名称匹配、岗位要求与简历有证据的技能一致性参与评分；简历学历或经验没有证据时要提示核对，不能假设合格。
3. 站内和站外统一排序，相关性强的站外岗位可高于不合适的站内岗位。只有分数相同才偏向站内。
4. 相同企业+职位去重（不同城市不重复刷屏）；优先每企业最多 2 条，岗位不足时再放宽。总数最多 10 条，不足不凑数。
5. 分数是“相关性参考”，绝不是实际录用概率；外部候选要显示来源、核验时间、待核实开放状态。

## 功能开关与未完成
本提交是纯函数+测试，不会自动请求 DeepSeek，也不会修改数据库或生产页面。
独立 search 接口开关 HHBA_MATCH_EXTERNAL_SEARCH_ENABLED 继续保持关闭；后续需单独做真实返回 schema / 页面抓取验收、候选人显式搜索授权、Preview 端到端融合和展示。
用户明确不希望国外岗位；任何外国、港澳台或地址模糊职位不纳入。

## 自动化测试
node --test scripts/domestic-match-fusion.contract.test.mjs scripts/domestic-search-fetch.contract.test.mjs scripts/domestic-search-fetch.route.test.mjs
覆盖大陆地点白名单、站外真实性/申请状态、不同来源公平排序、同岗去重、学历/工作经验明确不满足的硬过滤、技能匹配、公司多样性和不足十条直接返回。

DeepSeek 官方接口参考：https://api-docs.deepseek.com/zh-cn/guides/search/