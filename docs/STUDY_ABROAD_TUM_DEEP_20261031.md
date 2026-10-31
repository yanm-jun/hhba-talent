# HHBA 留学机会 · 第 6 所大学：慕尼黑工业大学 TUM
信息核验：2026-10-31；开发主线：yanm-jun/hhba-talent main。

**用户已确认首页保持不变**：不增加任何留学首页板块，只扩展既有 university/tum 和 program/tum-informatics-ms 深度页，并沿用 HHBA 既有 Shell/导航/搜索结构。

## 1. 页面与功能
- `/study-abroad/university/tum`：学校与 Garching 科研环境（四段详解）、三张不同地点真实校园照片、图库切换放大、120 ECTS Informatics MSc 方向介绍、11 步申请、英语要求、冬夏申请窗口、非欧盟实际学费与奖助边界、FAQ、原始官方来源。
- `/study-abroad/program/tum-informatics-ms`：独立专业详情，四学期 120 ECTS，六个研究/实践课程方向和清楚的本科学科基础条件、学术匹配、申请、学费。
- 本项目不是伯明翰大学那种 conversion MSc，不支持没有计算机科学本科先修便“无条件跨专业”推荐。

## 2. 校方资料（可复核）
- 主专业、Garching、4 semesters、120 ECTS、主要英语授课、每学期 €6,000 非欧盟学费及 €97 当前学期杂费： https://www.tum.de/en/studies/degree-programs/detail/informatics-master-of-science-msc
- 两阶段 aptitude assessment、申请文件、VPD、Curricular Analysis：https://www.cit.tum.de/en/cit/studies/degree-programs/master-informatics/
- 英语 IELTS 6.5，TOEFL iBT 88（0–120 分制），PTE 65：https://www.tum.de/en/studies/application/application-info-portal/admission-requirements/language-certificates/
- 非欧盟新生收费与可申请豁免：https://www.tum.de/en/studies/fees/tuition
- 常规冬季申请 2/1–5/31、夏季 10/1–11/30：https://www.tum.de/en/studies/degree-programs/detail/informatics-master-of-science-msc

注意：每学期 €6,000 是官方当前**全日制学费**，€97 是另行缴纳的**当前学期杂费**。四学期 €24,000 仅在不减免且读完标准学制时的算术参考，未含生活、保险、交通、签证等。减免资格不是自动获得。

## 3. 真实照片版权及静态打包
1. Garching 研究园区全景（2009），High Contrast，CC BY 3.0 DE，https://commons.wikimedia.org/wiki/File:Campus_TU_M%C3%BCnchen,_Garching.jpg
2. Garching Institute for Advanced Study（2013），High Contrast，CC BY 3.0 DE，https://commons.wikimedia.org/wiki/File:TU_M%C3%BCnchen_Garching_-_Institute_for_Advanced_Study.jpg
3. Mathematics/Informatics Magistrale2 中庭与滑梯（2012-01-11），TobiasK，CC BY-SA 4.0，https://commons.wikimedia.org/wiki/File:MI-Geb%C3%A4ude_der_TU_M%C3%BCnchen_Magistrale2.JPG

在 GitHub Actions 同源构建中使用 `apps/web/scripts/package-tum-campus-photos.py` 从真正的 Commons 文件路径下载与验证 JPEG，失败则构建失败；不假冒校园、不使用 AI 合成图片，页面对每张照片都公开作者、年代、许可与原始 URL。

## 4. 验收
- 节点化数据约束：`node --experimental-strip-types --test scripts/tum.contract.test.mjs`
- React 编译：`npm run build`，校验不产生错误。
- Chromium 真机浏览器环境：1440 和 390 px，三张本地图片、署名、图库、灯箱、11 步材料、€6,000、FAQ、专业深度页与内部路由。
- 全站 GitHub Pages workflow 另行进行全部企业与城市模块回归，不绕过旧测试来上线。
