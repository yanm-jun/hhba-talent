# HHBA 留学机会 · 第三所大学：德州农工国际大学（TAMIU）
核验日期：2026-10-31；主仓库：yanm-jun/hhba-talent；分支：main

## 架构
不改现有留学首页。使用首页已存在的真实大学卡片及现有统一搜索。
大学深度页：/study-abroad/university/tamiu
MBA 深度页：/study-abroad/program/tamiu-mba
保留其他 7 所院校、15 个具体硕士项目的原始数据结构与现有 URL。新页面沿用 Minot 和 USD 经验证的 HHBA Shell/导航/页内目录与 responsive 样式。

## 项目深度
MBA 是一项硕士学位，不应把多个 concentration 伪造为多个学位。内容包含：学校所在地、Texas A&M System 与本校区的区分，AACSB 商学院认证，四大课程主题（2026–27 官方编号），六个 MBA 方向，跨专业本科背景差异，GPA 3.00 GRE/GMAT 豁免前提，TOEFL 79 / IELTS 6.5 / PTE 53，八步国际学生准备，申请期限，2026–27 官方成本（各项目及合计）、研究生各类资助资格、七个常见问题、官方第一方来源目录。

**重要风控：** MBA 官方既有线上路径也有可能的校内路径。线上或标注 onsite 的大学项目介绍，均不代表某一位国际申请人自动满足 F-1/I-20、校内负荷或签证审批。学校国际办公室确认之前，禁止宣传为确定可赴美线下留学。不是 College Station 的 Texas A&M University 主校区。

## 官方数据
- https://www.tamiu.edu/gradschool/admissions.shtml — 国际生 preferred dates：秋季 6/1、春季 10/1；英语 TOEFL 79 / IELTS 6.5 / PTE 53。
- https://catalog.tamiu.edu/graduate-information/admissions/ — 2026–27 国际研究生申请费 $50；Duolingo 115；研究生商学院上层本科 GPA ≥3.00 可考虑 GRE/GMAT 豁免；不同情况按学校确认。
- https://catalog.tamiu.edu/graduate-information/a-r-sanchez-jr-business/master-business-administration-mba/ — MBA 课程代码、CIP 52.0201.00、随本科专业变化的核心课结构。
- https://www.tamiu.edu/arssb/ — 商学院实际提供的 MBA 浓度方向与教学模式，需核实国际申请人校内资格。
- https://www.tamiu.edu/finaid/26-27-cost-of-attendance.shtml — 2026–27 年研究生 Nonresident On Campus、秋春且每学期 6 学分年度预算：学杂费 $10,778；教材 $648；生活 $13,394；交通 $572；个人 $2,980；合计 **$28,372**。这些数不是完整 MBA 学位或 I-20 专项担保报价。
- https://www.tamiu.edu/gradschool/financialassistance.shtml — 硕士助教最多 $15,000/九个月、Fellowship 最多 $9,000/学年、奖学金最多 $3,000/学年；均须具体 GPA/学分/国际身份与岗位资格验证，绝非保证。

## 真实照片
仅采用真正拍摄的 **Texas A&M International University（Laredo）**：
1. Canseco Hall (2012) — Billy Hathorn，摄影者 PD-self，https://commons.wikimedia.org/wiki/File:Dr._F.M._Canseco_Hall,_TAMIU,_Laredo,_TX_IMG_5425.JPG
2. Killam Library (2012) — Billy Hathorn，CC BY-SA 3.0，https://commons.wikimedia.org/wiki/File:Sue_and_Radcliffe_Killam_Library,_TAMIU,_Laredo,_TX_IMG_5427.JPG
3. Western Hemispheric Trade Center (2012) — Billy Hathorn，CC BY-SA 3.0，https://commons.wikimedia.org/wiki/File:Western_Hemispheric_Trade_Center,_TAMIU,_Laredo,_TX_IMG_5432.JPG

网站构建时按 Commons 文件名计算标准 MD5 静态图片路径，优先获取 1280px 照片并校验 JPEG，放在 apps/web/public/images/study/tamiu，不用外链在浏览器中展示，不使用 AI 图片。真实摄影者、许可、来源、裁切说明逐图列于学校详情页。失败即终止本次构建，不会使用其他大学图片顶替。

## 测试
静态资料核验，TypeScript React 编译，GitHub Pages 同源图片静态打包，真实 Chromium 的 PC 1440px / Mobile 390px 浏览器测试；真实照片加载，图库切换/放大，MBA 深页链接，费用、准备任务、FAQ、官方外链和无未捕获的 JS 错误。独立专项 CI 不另行部署，统一主站 GitHub Pages 工作流继续完整回归其他企业和城市。

**开发阶段说明：** 已核验的公开信息并不等于申请窗口当前开放；最终费用、入学、签证及资助以申请当天的官方信息为准。
