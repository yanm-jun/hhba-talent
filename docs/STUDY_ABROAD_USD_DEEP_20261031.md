# HHBA V2 · 留学机会第一模块 · 第二所南达科他大学（2026-10-31）

**开发主线：** `yanm-jun/hhba-talent` main。保留用户已确认的留学首页及全部原有组件，只完善「南达科他大学」点击进入的真实能力。

## 页面

- 大学详情：`/study-abroad/university/south-dakota`
- 商业分析：`/study-abroad/program/usd-business-analytics-ms`
- MBA：`/study-abroad/program/usd-mba`
- 计算机科学：`/study-abroad/program/usd-cs-ms`

复用现有 Shell、统一 Link、现有城市/企业导航、StudyUniversityDirectory 数据结构和 Minot 的已验证详细页面样式。现有留学主页未增加新板块，也没有改变原来的交互布局。

## 实际能力

* 学校历史、大学身份、师生统计、校区、认证、居住与交通建议；
* 真实校园本地图片：2023 主校区航拍、1976 Old Main 历史资料、2015 Belbas Center，并明确摄影者、拍摄年代、图片许可；点击图片可切换放大，图片本身不跳第三方网站；
* 3 个硕士各自独立的中文长文说明、4 个课程主题、专业先修限制、学位属性、2027 春秋申请日期；
* 7 步国际学生申请清单、语言标准、官方费用口径、研究生助教申请现实、签证资金证明；
* 7 条真实 FAQ、11 条学校官网/州教育系统第一方来源索引；
* 全站统一工作流中新增数据验证、照片打包与桌面/移动版 Chrome 交互检查；另设独立验证工作流，不建独立部署网站。

## 来源与风险

- 1862 建校、2026 年秋 10,040 人、16:1 师生比、274 英亩、HLC： https://www.usd.edu/About/At-a-Glance
- 国际研究生 2027 申请时间，79 TOEFL / 6.0 IELTS / 110 DET，非英语学历要求和 I-20： https://www.usd.edu/Admissions-and-Aid/International-Admissions/Applying-for-International-Graduate-Admission
- 商业分析硕士（STEM、Vermillion）： https://www.usd.edu/Academics/Graduate-Programs/Business-Analytics
- MBA（有多种校区/在线选项，**普通 MBA 不自动视为 STEM**）： https://www.usd.edu/Academics/Graduate-Programs/Business-Administration
- 计算机科学硕士（30 学分、thesis/non-thesis）： https://www.usd.edu/Academics/Graduate-Programs/Computer-Science
- 国际生入学后资金： https://www.usd.edu/Admissions-and-Aid/International-Admissions/International-Graduate-Student-Checklist
- 研究生助教： https://www.usd.edu/Admissions-and-Aid/Financial-Aid/Types-of-Aid/Graduate-Assistantships
- 校董会 2026–27 USD 非居民研究生 $689.15/credit + 一般活动费 $57.55/credit： https://sdbor.edu/cost-aid/south-dakota-tuition-rates/
- USD Graduate Cost of Attendance 模型以 18 credits/year 为基础： https://www.usd.edu/Admissions-and-Aid/Tuition-and-Costs/Graduate-Tuition-and-Costs

**注意：** 大学国际申请页面当前写研究生申请费 $38，州校董会列研究生申请费 $40。本模块如实披露口径冲突，不将任一数字视为支付阶段最终收费。学费按学分计算，不能直接误写“完整学位费用”。STEM 项目也不保证 OPT/工作；未核验跨专业先修不应标作无条件跨专业。

## 图片许可，独立文件下载并打包至本地

1. `usd-campus-aerial.jpg`：anup khanal，2023-09-24，CC BY-SA 4.0，https://commons.wikimedia.org/wiki/File:Aerial_view_of_University_of_South_Dakota_Vermillion_Campus.jpg
2. `usd-old-main-habs.jpg`：Jack Boucher / US National Park Service HABS，1976 历史照片，美国联邦公务作品公共领域，https://commons.wikimedia.org/wiki/File:Old_Main,_University_of_South_Dakota.jpg
3. `usd-belbas-center.jpg`：Ammodramus，2015-10-24，CC0 1.0，https://commons.wikimedia.org/wiki/File:University_of_South_Dakota_Belbas_Center_from_S_1.JPG

网站部署时由 `apps/web/scripts/package-usd-campus-photos.py` 下载 Wikimedia 的已授权缩略版本至 `apps/web/public/images/study/south-dakota/`，校验 JPEG 与长度并打印 SHA256；无法读取则让构建失败，而不是显示冒充校景的图片。实际照片版权和来源显示在网页的可查看区域。

## 验收

- `node --experimental-strip-types --test scripts/south-dakota.contract.test.mjs`
- `npm run build`
- `node scripts/south-dakota.browser.mjs`：真实 Chromium 桌面/手机、3 图片成功加载、字幕署名、缩略图、灯箱、三专业、截止时间、FAQ、费用与源码引用。
- 完成独立验证并全站 GitHub Pages 发布后交由用户验收，再做下一所。
