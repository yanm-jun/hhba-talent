# HHBA 国内岗位 Search/Fetch · Stage 1

日期：2026-11-08
开发分支：feature/match-domestic-search-fetch-v1-20261108，基于草稿 PR #283。

已核实接口：POST https://api.deepseek.com/v1/tools/search 和 POST https://api.deepseek.com/v1/tools/fetch
文档：https://api-docs.deepseek.com/zh-cn/guides/search/
官方价：两者各 5 元/1000 次成功请求（2026 年 11 月核实）。

首批白名单：腾讯 careers.tencent.com/jobdesc.html 和华为 career.huawei.com/cn/job-details；只认有岗位 ID 的 HTTPS 详情页。
只有 Search 搜到的官方详情页可以进入 Fetch；Fetch 之后校验标题、工作职责、任职要求、中国大陆城市和来源。
当前仅发现候选岗位；即使有申请按钮，也不能保证仍在招聘。状态一律 NEEDS_OFFICIAL_CONFIRMATION，不进入 Top 10。

安全：只向搜索接口发送用户明确输入的职业方向，不发送简历、姓名、手机号、邮箱或任意用户给定 URL。
服务端限制两次 Search、三次 Fetch，最多三条核验候选；不自动跟随任何重定向，不记录网页正文。

路由：POST /api/match/discover；限 Preview、求职者登录、同源请求、独立搜索授权和独立 D1 次数。
开关：HHBA_MATCH_EXTERNAL_SEARCH_ENABLED=1；默认缺失即关闭。不得在 Production 打开。
迁移：apps/web/d1/0018_external_search_usage.sql；每用户每天 2 次，全站每天 12 次。
仅储存匿名账号哈希、日期、随机请求 ID，不存用户职业意图或简历；不占用现有 AI 匹配扣次。

本阶段不改变 Top 10 页面或现有生产服务。要在 Preview 独立数据库完成迁移并核实调用成本后，才可考虑开启真实调用。
测试：node --test scripts/domestic-search-fetch.contract.test.mjs scripts/domestic-search-fetch.route.test.mjs
所有测试均使用合成请求和模拟 DeepSeek 响应，不使用用户密钥或产生付费请求。