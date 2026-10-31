# HHBA V2 留学机会 · 第一所大学完整样板 · Minot State University

状态：**第一所大学深入开发**，不改首页、不修改其他 7 所学校的详情结构、不触碰其他功能模块。

## 完整交付
- 入口保持 `/study-abroad` 的大学卡片。
- 大学详情 `/study-abroad/university/minot-state`：学校历史、官方认证、校园环境、2026 学生统计、校园设施、真实照片图库、两个项目对比、语言要求、申请清单、学校国际生费用参考、奖助学金、宿舍、交通现实、6 问 FAQ、出处索引。
- 两个深度专业：
  - `/study-abroad/program/minot-management-ms`
  - `/study-abroad/program/minot-cyber-ms`
  每页分别展示课程学习方向（非逐门课程假清单）、背景要求、国际申请截止月日、语言成绩、材料清单、年度费用、I-20/签证资格判断边界和官方项目 URL。
- 三张真实校园 Old Main 照片。**三张均为 Old Main 不同年份/角度，不把主楼冒充校园的其他建筑**，照片在 GitHub Pages 构建期间从权利清晰的档案源获取并存入最终站点 `images/study/minot-state/`。发布后的浏览器读取同站点静态资产，不依赖用户浏览器连接到 Wikimedia / LOC。
- 图片点击只会放大，不跳到第三方图库；摄影者与许可单独清楚署名。Lightbox 可左右切换和 Escape 关闭。
- 7 步申请清单、数据来源逐条官方链接及申请信息不确定性提示。

## 关键校正（官方 2026-10-31 核对）

### 学校
- 1913 年创校，北达科他州 Minot 公立大学；HLC 认证；2026 秋季在校生 2,758，官方学校概况师生比 11:1。
- 学校概况 https://www.minotstateu.edu/about.shtml
- 认证 https://www.minotstateu.edu/accreditation/
- 校园 https://www.minotstateu.edu/map/

### 管理 MSM
- 官方课程 30 credits / On Campus and Online / 无需商科本科。
- GPA 最低累计 2.75，或按最近 60 学分规则；学校管理学项目页面列 GPA<3.00 时 GRE 要求。
- 国际生参考截止：秋季 5 月 31 日，春季 9 月 30 日；不能自行延伸到特定未公布入学年度。
- Management 在研究生院公布的 I-20/F-1 学位项目清单中（是否最终发放 I-20、签证和是否受课程负荷等条件限制仍须另核实）。
- https://www.minotstateu.edu/graduate/future_students/programs/management.shtml
- https://www.minotstateu.edu/graduate/future_students/Application-Deadlines.shtml

### 网络安全 MSCIA
- 官方课程 30 credits / On Campus and Online，预计 1–2 年。
- 招生要求科技/商科背景或有相关工作经验。
- 国际生参考截止：秋季 5 月 31 日。
- **重大限制：研究生院公布的 I-20/F-1 项目名单不列 Cybersecurity。不能仅凭“有校园课程”断言中国申请人可以凭这个学位获取 F-1。** 页面明确警示并提供学校原始依据。
- https://www.minotstateu.edu/graduate/future_students/programs/cybersecurity-information-assurance.shtml
- https://www.minotstateu.edu/graduate/future_students/

### 语言、材料、费用
- TOEFL iBT 79、IELTS 6.0、Duolingo 105，部分符合学校规则的申请人可以申请豁免。
- 研究生在线申请费 35 美元；目的陈述最少 500 英文字、简历、3 位推荐人；非加拿大国际学历需要 WES 或 ECE 逐课认证。
- 学校国际研究生费用参考（2026-27）：学杂费 $9,161、住房餐饮 $9,200、健康保险 $2,280、参考合计 $20,641。**是学校特定学分和住宿假设下的学年费用，不是完整 30 学分硕士总费用**，更不能保证覆盖签证、机票、私人物品及额外课程。
- 助教薪酬按学校网页现有规则参考 $1,370/学期（约 5h/周）或 $2,740/学期（约 10h/周），岗位需竞争、不是自动学费减免。
- https://www.minotstateu.edu/graduate/future_students/
- https://www.minotstateu.edu/graduate/future_students/financial-resources.shtml
- https://www.minotstateu.edu/graduate/future_students/aid-scholarships.shtml

## 照片及可重复构建
1. `old-main-highsmith.jpg` — Carol M. Highsmith，2021-11-27，Library of Congress `LC-DIG-highsm-69075`，公共领域、无已知出版限制，https://www.loc.gov/pictures/item/2021757296/ ，图片原图 `https://tile.loc.gov/storage-services/service/pnp/highsm/69000/69075v.jpg`。
2. `old-main-goldenpaw2000.jpg` — Goldenpaw2000，CC BY-SA 3.0，https://commons.wikimedia.org/wiki/File:Oldmainmsu.jpg ，图片 `https://upload.wikimedia.org/wikipedia/commons/6/67/Oldmainmsu.jpg`。
3. `old-main-alexwcovington.jpg` — Alexwcovington，CC BY-SA 3.0，https://commons.wikimedia.org/wiki/File:Minotstate.jpg ，图片 `https://upload.wikimedia.org/wikipedia/commons/1/1e/Minotstate.jpg`。

图片构建脚本检查源状态码、JPEG 文件头、文件大小并打印 SHA256，不满足即阻止 Pages 发布。许可署名在专属资料页完整显示。图片保持独立文件，不拼图、不用 AI 伪装真实校园。

## 测试
- `cd apps/web && node --experimental-strip-types --test scripts/minot-state.contract.test.mjs`
- `npm run build`
- 原始 GitHub Pages 工作流执行 Chromium 浏览器检查：桌面 1440、手机 390、真实本地照片加载、缩略图切换、图片放大、FAQ、两专业详情、签证提醒、费用、出处。
- 等待用户验收后再开发第二所大学和第二模块。

### 特别提醒
页面来源为查询时点公开的大学网页，不构成录取建议、签证意见或费用保证。不存在 2027 入学确认、可供购买的留学席位或承诺就业。
