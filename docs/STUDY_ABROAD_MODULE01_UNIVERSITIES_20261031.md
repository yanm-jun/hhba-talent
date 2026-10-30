# HHBA 留学机会 · 模块 01：真实大学与专业数据库 (2026-10-31)

主仓库 `yanm-jun/hhba-talent` 的 `main` 分支。无独立 Pages 站点，无新后台，无阿里云部署。

## 交付范围
- 8 所大学，6 国，15 个具体硕士专业；每个专业有唯一 ID、官方来源 URL、核验日期、专业领域、授课方式、语言证据状态、申请说明与费用核实状态。
- 与既有 `/study-abroad` 首页布局无缝整合：搜索大学中英文、项目名称、专业关键词；国家卡片会过滤真实学校；国家、学历、专业领域、授课语言可组合筛选。专业关键词命中时只显示命中的具体专业，不把院校全部课程当匹配。
- 独立学校详情 `/study-abroad/university/<id>`，独立专业详情 `/study-abroad/program/<id>`，前端复用原有 Shell/BrandMark/Link 和 GitHub Pages 404 深路径回退。
- 保留原有 6 个“国家研究方向”详情，放在真实数据库板块下方，避免误认为它们是院校申请。
- 官方入口打开学校官网/课程目录，信息无证据则显示“待核验”。不提供申请代办、不把研究方向冒充招生项目。

## 官方项目来源
- Minot State University: Management MSM、Cybersecurity MSCIA (`minotstateu.edu`)
- University of South Dakota: Business Analytics、Business Administration MBA、Computer Science MS (`usd.edu`)
- Texas A&M International University: MBA (`catalog.tamiu.edu`)
- University of Birmingham: Computer Science Conversion MSc、Artificial Intelligence and Computer Science Conversion MSc (`birmingham.ac.uk`)
- Monash University: Master of Information Technology C6001、Master of Business Information Systems C6003 (`monash.edu`)
- Technical University of Munich: M.Sc. Informatics (`cit.tum.de`)
- Kyoto University: Intelligence Science and Technology、Social Informatics English-taught international masters (大学官方项目目录 `kyoto-u.ac.jp`)
- University of Auckland: Master of Information Technology、Master of Business Analytics (`auckland.ac.nz`)
每个具体 URL 及核实口径见 `apps/web/src/data/studyUniversities.ts`，不要依据概览卡推断学费、授课地点或毕业后就业资格。

## 核实边界
- 只验证“学校确实存在且开设此专业”，并注明官方页面支持的授课方式；不能证明当前开放招生、符合国际生资格、录取成功。
- 仅两条费用证据发布：Monash BIS 2027 A$57,540/标准年负荷；Auckland MInfoTech 2027 NZ$55,214/年参考，不是整段学位总费用。
- 此批所有项目均为硕士。选择本科或博士显示正确的“无收录结果”，不应捏造项目。
- 国家和专业的真实匹配能力由本地静态数据提供，不依赖实时国外 API。

## 质量门槛
`cd apps/web && node --experimental-strip-types --test scripts/study-universities.contract.test.mjs scripts/study-abroad.contract.test.mjs && npm run build`
现有主站 GitHub Pages 工作流另行验证页面、媒体和全站回归；成功部署后用户独立验收本模块。
