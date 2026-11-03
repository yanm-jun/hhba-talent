# HHBA V2 第108—110家来源审计（2026年11月3日）

独立支线 feature/employers-108-110-v2 从 main f86e896ba510a114f2e814c876063ae69d4f867b 分出；不得假设前批PR #206/#207/#208/#210/#211已合并。

## 108 复旦微电子
- 西安电子科技大学2027招聘表：https://job.xidian.edu.cn/campus/view/id/757619 。此表有15行带职责/任职要求的具体岗位名称，且明确唯一官方2027投递渠道 https://app.mokahr.com/campus-recruitment/fmsh。
- 官方企业资料 https://www.fmsh.com/about.shtml 。
- 网申原期2026-09-10至2026-10-31，已过期。所有岗位的官方单岗申请链接并未独立核验。工作地点以上海校招主体为一般性标识，并非确认每条岗位都只在上海。

## 109 金发科技
- 吉林大学2026年9月2日企业发布招聘表：https://jdjywpt.jlu.edu.cn/mportal/recruit/details?id=80f1320ef0ff4f56b45c90786637d8eb
- 中国科学技术大学2027招聘说明与分板块职位表：https://job.ustc.edu.cn/Specialrecruitment/info.aspx?itemid=10094
- 招聘系统 https://kingfa.zhiye.com/ 与集团官网招聘入口 https://career.kingfa.com/
- 本批精选24条企业具名方向，包含材料研发、机械设备、IT、财务法务、供应链等，均对照公开表核对专业学历和城市候选集合。**多地点是同一行招聘表给出的可选城市，不按城市拆成多个空缺**。
- 2027招聘表称10类80余岗位方向1000余需求，但此批只确认24条名称，不冒充24条实时职位。大学公告未显示统一绝对截止日期，第三方10-31信息不得直接用来封禁所有岗位。

## 110 远光软件
- 2027提前批正式招聘说明：https://yjsjob.91wllm.cn/campus/view/id/1005888
- 2027高校宣讲 https://jobs.tiangong.edu.cn/recruitment/content/type/2/id/2777.html
- 实施顾问（FDE前沿部署岗）2026-10-09独立校方职位 https://jiuye.xtu.edu.cn/detail/job?id=2609704&online_id=3617164 ，招聘30人，本科及以上，全国（具体地区以企业分配为准）。
- 其他15项为公告具名研发/产品方向（AI工程师、软件开发、信息安全工程师等），**没有独立岗位编号、单岗地区与人数**。不可写成15个独立职位。
- 提前批2026-10-30截止；另有博士研究员其他专项截止日期，不把它误用于提前批。

## 页面与风险
- 原四板块视觉模板、职位详情、统一招聘搜索、专业筛选继续沿用；只新增上述三家独立JSON与公司页批次路由，保留各招聘出处。
- 55条均标 currentOpenVerified:false；数据含15条复微逐JD、24条金发具名岗位方向、1条远光独立岗位和15条远光概览方向。**55条展示记录≠55个当前可申请空缺。**
- 企业Logo目前是注明“非官方字标”的编辑占位。每公司2张图片区为注明非实景的SVG，真实可商用照片需核对归属及授权。media-sources.json逐条保留审核入口。
- PR和CI独立验收，main及正式GitHub Pages不应被自动覆盖。
