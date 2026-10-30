# HHBA 留学机会 V1 · 主线发布（2026-10-30）

- 唯一代码仓库：`yanm-jun/hhba-talent`，分支 `main`。
- GitHub Pages 前端：`https://yanm-jun.github.io/hhba-talent/`。
- 新入口：公共首页顶部导航「留学机会」→ `/study-abroad`（前端 History API 路由），六条研究方向各有 `/study-abroad/<id>` 详情。
- 现有「人才政策」「招聘市场」「企业发现」「加入我们」、求职者和雇主模块不移除、不重命名。
- 首版只有 **6 个国家级“研究方向”**，没有发布未经验证的院校招生信息、奖学金数额、学费、录取率或就业保证。
- 国家级官方信息入口（核查日期 2026-10-30）：EducationUSA、Study UK（British Council）、Study Australia、DAAD、Study in Japan、Study with New Zealand。链接详见 `apps/web/src/data/studyAbroad.ts`。
- 支持关键词搜索（输入后回车或点击查询）、目标筛选、国家选择/取消、组合过滤、无结果提示、重置、6 个详情页与官方外链。
- 本期不采集简历、无留学中介收款、无后台数据库/实时招生名额，保持 GitHub Pages 静态可运行。
- 后续正式院校条目需另外核验官方学校项目 URL、学费、申请要求、截止日、奖学金与当期来源，不能把研究方向变成“已开放申请”的冒充卡片。
- 发布使用现有 GitHub Actions Pages 工作流，阿里云正式环境不在本次操作范围内。

## 回归
`cd apps/web && node --test scripts/study-abroad.contract.test.mjs && npm run build`
