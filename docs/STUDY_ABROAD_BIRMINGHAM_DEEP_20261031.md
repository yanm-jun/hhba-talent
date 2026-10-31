# HHBA 留学机会 · 04 伯明翰大学深度开发 · 2026-10-31

原有留学机会首页、搜索、六国选择、校园入口及既有页面的排版与导航保持不变。只深化已存在的 University of Birmingham 大学卡片。

- 大学页面 `/study-abroad/university/birmingham`：历史背景（1900 年建校、Edgbaston）、三张不同建筑的真实校园照片、两项 conversion MSc、申请材料与语言成绩、2027 申请截止、国际生收费、奖学金和 FAQ、完整来源目录。
- 专业独立页面 `/study-abroad/program/birmingham-cs-conversion`：Computer Science MSc，180 学分＝6×20 核心模块 + 60 学分项目；2027 1 月 £34,740、9 月 £36,000 国际生课程学费；仅为学费非全程花费。
- 专业独立页面 `/study-abroad/program/birmingham-ai-conversion`：Artificial Intelligence (AI) and Computer Science MSc，180 学分＝5×20 核心模块 + 20 选修 + 60 学分项目；官网证实一年校内 9 月入学及非 computing 2:1。国际生学费未充分核实，不拿本地 £12,780 冒充国际生收费。

## 入学与身份
两项均要求 UK 2:1 或认可同等学位、非 computing 本科。语言 IELTS 6.5，各项至少 6.0；TOEFL iBT 2026 年前后的新旧计分方式不得混淆。国际生大学标准申请截止：2027 1 月一般项目 2026-10-30，9 月一般项目 2027-07-02，可能有专业提前截止。一般 postgraduate taught 不收大学申请费。学校国际授课型硕士一般在 CAS 签发前要求 £3,000 押金（抵扣学费），不是学费之外重复收取。任何签证与就业不能保证。

## 真实图片授权
- Aston Webb, 2005 年，stephen boisvert，CC BY 2.0，https://commons.wikimedia.org/wiki/File:University_of_Birmingham_-_Aston_Webb.jpg
- Main Library, 2016 年，Elliott Brown，CC BY-SA 2.0，https://commons.wikimedia.org/wiki/File:University_of_Birmingham_-_new_main_library_(26663121392).jpg
- Old Joe, 2026-04-12，Athikhun.suw，CC BY 4.0，https://commons.wikimedia.org/wiki/File:Old_Joe_2026.jpg

图片在构建时从 Wikimedia Commons 原件或缩略件下载成 3 个真正独立的 jpg，JPEG 签名、最小大小和 SHA256 校验。页面给出每张图片作者、来源、许可、日期和裁切说明，点击图片仅放大，不跳出 HHBA 网站；不使用任何 AI 虚假校园图。

## 官方资料
https://www.birmingham.ac.uk/about/our-history-and-heritage
https://www.birmingham.ac.uk/study/postgraduate/subjects/computer-science-and-data-science-courses/computer-science-msc
https://www.birmingham.ac.uk/study/postgraduate/subjects/computer-science-and-data-science-courses/artificial-intelligence-ai-and-computer-science-msc
https://www.birmingham.ac.uk/study/postgraduate/taught/apply
https://www.birmingham.ac.uk/study/postgraduate/taught/apply/international-entry-requirements
https://www.birmingham.ac.uk/study/international/fees/international-deposits
https://www.birmingham.ac.uk/study/postgraduate/scholarships-and-funding/postgraduate-scholarships

## 验收
`node --experimental-strip-types --test scripts/birmingham.contract.test.mjs`；`npm run build`；真实 Chromium 桌面 1440 与手机 390 像素：照片加载切换、灯箱、真实课程模块、官网、准确国际生费用、10 步申请、日期、FAQ、两个专业独立路由。独立专项工作流保证不被其他城市高频提交干扰；全部仍需主站 GitHub Pages 发布才能宣称“已上线”。
