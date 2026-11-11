# HHBA 汇方职场：能源电力馆第三批（201—300）100个不同企业候选主体

**采集日期：2026-11-11。状态：UNVERIFIED（待企业实体、来源归属与岗位级别核验）。**

## 与前两批的计数口径差异

- 前两批001–200：200条**不同的候选URL**，但包含同一企业的不同招聘公告、同一集团的多个入口。
- 第三批201–300：100个**不同的企业/集团招聘单位名称**，来自26个不同的招聘/企业来源URL。集团公司和下属企业共享招聘平台是现实存在的，不能为了凑网址虚构“子公司专属招聘系统”。
- 本批100个名称与前两批200条的**显示企业名称没有精确重复**。这**不等于**对100个法人身份做了工商尽调，或跨馆完全无重复；集团下属事业部、法律主体关系和旧别名仍需逐项核验。
- 原200条URL没有被替换；第三批100个企业候选另建表存储，避免破坏早期“URL唯一”的结构。**不能说当前有300个不同URL**。

## 来源批次与集团归属

| 来源分组 | 企业候选主体 |
|---|---:|
| 深圳能源集团2027校园招聘的用人单位 | 25 |
| 东方电子集团官网“旗下公司招聘” | 16 |
| 中国东方电气集团2027校招的下属单位 | 15 |
| 广州发展集团2027校园招聘 | 6 |
| 安徽省能源集团（皖能）招聘公告及有关单位 | 11 |
| 跨集团独立企业及专项子公司 | 27 |
| **合计** | **100** |

## 九个分类的第三批数量

| energy_section | 本批 |
|---|---:|
| energy-grid 电网与输配电 | 5 |
| energy-generation 发电与能源运营 | 36 |
| energy-nuclear 核电与核能 | 2 |
| energy-hydro 水电与抽水蓄能 | 3 |
| energy-engineering 电力工程与设计 | 6 |
| energy-solar 光伏 | 6 |
| energy-wind 风电 | 7 |
| energy-storage 储能 | 6 |
| energy-equipment 电力装备 | 29 |
| **合计** | **100** |

## 典型官方来源/企业指定招聘平台

- 深圳能源2027招聘及明确的所属招聘单位： https://szny2027.zhaopin.com/jobs/index.html
- 东方电子集团官网旗下公司招聘： https://www.dongfang-china.com/join/job_list.htm
- 东方电气集团2027旗下单位职位： https://dongfang2026.zhaopin.com/jobs/index.html
- 广州发展2027集团招聘： https://gdghr.iguopin.com/job
- 安徽省能源集团招聘公告： https://www.wenergy.com.cn/xxgk1/zpgg/62.htm
- 山东能源招聘： https://zhaopin.shandong-energy.com/recruit
- 华润电力招聘： https://crp.hotjob.cn/
- 南瑞集团招聘： https://job.sgepri.sgcc.com.cn/nari-career-ui/empty
- 新疆大全招聘： https://www.xjdqsolar.com/career/contact
- 思格新能源2027招聘： https://jobs.sigenergy.com/campus
- 楚能新能源招聘： https://www.cn-np.com/Index/join_us.html
- 中材叶片招聘： https://yp.sinomatech.com/campus/index.html

部分来源为企业自有域名；另一些为**企业自己指定或从集团官方页面链接出去**的招聘系统，如智联招聘、北森、国聘、BOSS企业专属频道。**这些不是非官方中介数据，但不能自动当作已经审核通过。** 还有少数 `DISCOVERY` 网站只是企业官网，不是直接投递页面。使用时优先选择有专属岗位页的入口。

## 存储与读取

- 数据：`apps/web/functions/_lib/energy-employer-candidates-201-300.js`
- SQL：`apps/web/d1/0031_energy_employer_candidates_201_300_v1.sql`（独立候选表；允许多家真实子公司共用一个已知ATS网址，企业名唯一）
- 只读函数：`getEnergyEmployerCandidateHints` in `apps/web/functions/_lib/energy-employer-candidate-scope-v1.js`
- 检查：`apps/web/scripts/energy-employers-201-300.contract.test.mjs` + `.github/workflows/hhba-energy-employers-201-300.yml`

所有候选返回 `source_status='UNVERIFIED'`、`is_reviewed_whitelist_source=false`，并对共享入口标记 `shared_parent_recruitment_portal=true`。内部查询仅允许 `HHBA_AUTH_ROLLOUT='preview'`。具体岗位是否仍在招、资格要求、公司隶属、报名有效期和工作地点都需独立核验。

## 发布边界

这是依赖上游能源馆 Draft PR #335 的**草稿 PR**；没有合并 `main`、未向生产 Cloudflare D1 应用迁移、未启用生产 DeepSeek、未部署 `hhba.work`，不向用户展示未经审核的招聘岗位。
