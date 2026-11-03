# HHBA V2 第111–113家企业招聘与图片来源审计｜2026-11-03

- 该分支 `feature/employers-111-113-v2` 以 `main` `f86e896ba510a114f2e814c876063ae69d4f867b` 为基线；前面Draft PR均不自动合并。
- 本批共28条展示记录：**钱江摩托20（2高校独立岗位+18公示方向）**、**舒客电商6（官方飞书独立招聘条目）**、**AIA Digital+2（校招公告方向，无独立Workday编号）**。只有8条具备单独招聘职位表或独立企业招聘条目证据。所有记录 `currentOpenVerified:false`。

## 111 钱江摩托
- 2027校园招聘高校公告及明细：https://job.wzu.edu.cn/teachin/view/id/78035 （历史来源，网页现提示数据过期）；其检索摘要可见**三电开发工程师**、**研发设计工程师**均在台州温岭，硕士，分别有技术专业要求。
- 2027招聘20个公开方向：https://www.jdjianli.com/campus/47718 和 https://www.jdjianli.com/campus/1617；总体招聘城市杭州、台州、重庆，各方向未逐岗标明城市、学历、需求数量。
- 实际官方企业人才门户：https://campus.geely.com/campus-recruitment/geely/98148，属于吉利科技集团校园招聘栏目，未确认保留2027申请入口。
- 2027秋招简章投递8月13日至10月31日；不能以11月仍发Offer推定仍在接受网申。

## 112 舒客电商
- 华中科技大学2026-09-17官方就业发布：https://job.hust.edu.cn/zpinfo1/2436698.htm；公开9个管培生方向，全部在广州，面向2027届本硕。
- 舒客电商自行发布的飞书职位页：https://tianzhulingshan.jobs.feishu.cn/267335/m/position/；明确列出**财务管理、短视频编导、平面设计、市场推广、产品经理、互联网运营**六个2027届校招独立招聘条目。
- 官方互联网运营单条涵盖平台电商、直播、内容、渠道、海外运营五个内部分工；不能重复拆分五个职位增加招聘数量。
- 2027批次公开投递2026-09-01至10-31已经结束。官网显示职位并不能实时证明仍可投递。

## 113 AIA Digital+
- 2027友邦资讯科技（AIA TSS）公开招聘转录：https://www.upcv.tech/xiaozhao/cmughxa4i000tm93ot55ffymf.html；两个AI培训生方向AI Full Stack与Algorithm Engineer，广州，毕业时间2026-07-01至2027-07-30。
- 同一2027批次截止2026-10-31。该转载不是AIA官方单岗招聘系统，无独立Workday校园职位编号。行业背景另可查AIA官方广州工程岗位 https://aia.wd3.myworkdayjobs.com/en-US/External/job/Engineer_JR-65783-2；**这个社会招聘Engineer不是上述两个校园培训生岗位**。
- AIA集团官方Workday检索入口 https://aia.wd3.myworkdayjobs.com/en-US/External ，不冒充“2027校园岗位直达”。

## 模板和素材
- 按四块模板展示公司标识及两图、相关专业、岗位要求和证据链接、六条业务内容；所有岗位按自己的专业关联进入统一搜索。
- 各公司暂提供明显注明**非实景、非官方logo**的审核占位资产。真实照片候选及来源保存在各 `media-sources.json`，无转载许可，不可替换为未经授权的网络图片。
- 独立PR及CI上传可审查静态站Artifact；正式main与GitHub Pages保持原状。
