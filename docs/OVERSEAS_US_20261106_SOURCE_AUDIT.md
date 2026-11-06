# HHBA 美国出国发展专题 · 2026-11-06 来源与发布审计

## 范围

- 资料文件：`apps/web/src/data/overseasUnitedStatesA.ts`、`overseasUnitedStatesB.ts`、`overseasUnitedStates.ts`
- 展示页面：`apps/web/src/pages/UnitedStatesDevelopmentPage.tsx`
- 主路由：`/study-abroad/country/united-states`，详情 `/study-abroad/united-states/pathway/{route-id}`
- 范围：16条路线，8个知识章节/路线、每条独立FAQ、共36条官方参考资料条目（部分官方来源会在不同路线重复）。
- 真实摄影：复用 `apps/web/public/overseas/countries/us.webp`，授权见 `PHOTO_CREDITS.md`。

## 分类与适用性

| 类别 | 路线 |
|---|---|
| 美国学术/职业留学 | F-1、M-1 |
| 交换交流 | J-1 Intern/Trainee、J-1 Research Scholar |
| F-1实际培训授权（**非独立签证**） | CPT、OPT、STEM OPT |
| 雇主或项目工作签证 | H-1B、L-1A/L-1B、O-1、H-2A、H-2B |
| 职业移民（**并非自动取得绿卡**） | EB-1A、EB-2 NIW、EB-3、EB-5 |

## 当期重点核验

1. **H-1B（2027财年）**：USCIS 2026-01-30公告规定初次注册2026-03-04至03-19，注册费$215；2025-12-29联邦公报规定2026-02-27生效工资等级加权选择。$100,000特殊付款政策的公布、2026年延长与法院诉讼状态可能不一致，本站不按单一数字承诺费用。
   - https://content.govdelivery.com/accounts/USDHSCIS/bulletins/406da02
   - https://www.govinfo.gov/app/details/FR-2025-12-29/2025-23853
   - https://travel.state.gov/en/newsroom/visas/2025/restriction-on-entry-of-certain-nonimmigrant-workers.html

2. **2026年11月职业移民排期：中国大陆出生**（Final Action Dates，不是Dates for Filing，不是“每人必等固定年限”）：
   - EB-1: 2023-08-01
   - EB-2: 2021-10-01
   - EB-3: 2022-01-22
   - EB-3 Other Workers: 2019-10-01
   - EB-5 unreserved: 2016-12-01
   - EB-5 reserved农村/高失业/基础设施：当月表显示“C”，未来可倒退。
   - https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-november-2026.html
   - 申请人最终应按出生地/chargeability以及USCIS当月表格使用规则判断，不能仅凭国籍。

3. **F-1、M-1**：I-20、SEVIS、DS-160、使馆签证、边检入境及实习许可是不同阶段，不能把旅游B类签证、CPT或OPT当成通用工作许可。
   - https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html

4. **J-1**：DS-2019来自指定Sponsor；Intern/Trainee通常需DS-7002；212(e)是否适用需要独立核查，不可统一承诺豁免。
   - https://travel.state.gov/content/travel/en/us-visas/study/exchange.html
   - https://j1visa.state.gov/programs/intern
   - https://j1visa.state.gov/programs/research-scholar

5. **EB-5**：法定最低资本一般$1,050,000，针对符合条件地区/基础设施$800,000；投入商业项目有本金和流动性风险，不是买政府绿卡。
   - https://uscode.house.gov/us/usc/119-118/t8/s1153/
   - https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-fifth-preference-eb-5

6. **不适用提醒**：普通中国大陆护照E-1/E-2被国务院标为“No Treaty”；B-1/B-2不能替代正式工作或学位学习许可；J-1和H-2项目不可购买名额。
   - https://travel.state.gov/content/travel/en/us-visas/Visa-Reciprocity-and-Civil-Documents-by-Country/China.html
   - https://travel.state.gov/content/travel/en/us-visas/business/b-1-fact-sheet.html

## 验收纪律

- 新加坡分支及英国分支仍未合并main。美国从 `feature/overseas-singapore-20261106` 新建，MR目标也指向新加坡分支，以保证按顺序继承。
- 不直接修改 `main`，不触发 `hhba.work` 正式部署。
- 已做源数据静态一致性审查：16条唯一ID、8个内容字段、35组问答、36条关联官方来源，未发现当前检查规则的缺漏。
- **尚不能宣称已完成TypeScript编译、浏览器点击/响应式测试或CI通过**。验收命令：`node --test apps/web/scripts/overseas-united-states.contract.test.mjs`，`npm --prefix apps/web run build`；浏览器需检查国家卡片、每个详情、搜索、收藏、对比、筛选、外链。
- USCIS直接网页访问部分情况下存在403访问拦截，政策资料需要在可访问政府官网或授权渠道复查，不能将抓取失败误判为政策关闭。
