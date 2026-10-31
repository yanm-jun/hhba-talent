# 福建省9地级市 V5.1 政策与安居数据质量台账（2026-10-31）

仓库 yanm-jun/hhba-talent；独立分支 feature/talent-fujian；基准main `bad0de26d857fc3f6dac56e1249e26b03d3dfa9d`。
本分支不更新正式 GitHub Pages，也不合并 main；GitHub Actions构建工件不是已公开的网址。

## 范围
9市：福州、厦门、莆田、三明、泉州、漳州、南平、龙岩、宁德。
共 **33** 条政策记录（27条省级属地视图、6条有独立城市来源的地方资料），**14** 条住房制度/服务记录（9条省级住房制度属地视图、5条地方资料）。
每一条记录都可以用共用六板块指南阅读，按真实来源情况为B基础或C历史等级，**不自动认证A级**。

- 省级统一3项：2026大中专毕业生创业项目省级资助，2026-04-15截止，9月已公布110个获评项目，每项目3—10万元（是项目评审，不是普惠个人补贴）；2026届困难毕业生求职补贴2000元（只限六类困难毕业学年学生，2025年10月首次申请及2026年4—6月二轮均已结束）；2026年7—12月离校未就业青年就业服务攻坚行动（服务，不是普惠补贴）。
- 城市地方资料：福州四城区人才住房资格、厦门新引进人才生活补贴（已定位2024-10-11厦门市人社局官方办事指南，2026教育部汇编可复核，申请时限须核）、莆田2026就业创业11项政策指南（省人社厅政府案例确认，具体个人生活补贴转载金额不计正式可领数据）、三明医卫人才租房专项、泉州人才人口双增政策、龙岩2026先落户后就业。
- 住房：9条福建2024省级保租房运营管理办法属地索引+福州/厦门/三明/泉州/漳州5条城市住房制度与官方报道；所有记录均为`kind:'program'`，没有捏造独立可选房源或实时空置房。
- 质量重点：厦门市人社局2024年正式新引进人才办事指南与部分更早页面金额版本有差异；采用2024-10-11政府原文并由2026教育部汇编交叉验证。莆田2026毕业生个人生活补贴只有二手汇编，本次不作为已核政府原件可领档位；三明专限医疗卫生类；2025泉州的建房目标不是现实可租房源。
- **尚未完工**：9市并没有完整收齐2026全部区县市级独立人才政策、住房项目的真实门牌与当批租金、实际官方申办深链、浏览器PC/手机人工验收，不能宣称整省所有事项A级。
- 用户已明确固定流程：先独立分支可验收，再经明确授权合并并GitHub Pages发布；不得自行上线阿里云。
 
## 城市差异及数据矩阵
| 城市 | 省级政策属地视图 | 独立地方政策 | 省级住房制度 | 地方住房资料 | 独立真实可申报房源 | 整城A级 |
|---|---:|---:|---:|---:|---:|---|
|福州|3|1|1|1|0|否|
|厦门|3|1|1|1|0|否|
|莆田|3|1|1|0|0|否|
|三明|3|1|1|1|0|否|
|泉州|3|1|1|1|0|否|
|漳州|3|0|1|1|0|否|
|南平|3|0|1|0|0|否|
|龙岩|3|1|1|0|0|否|
|宁德|3|0|1|0|0|否|

## 政府原文及证据
- entrepreneurship: https://rst.fj.gov.cn/zw/zfxxgk/zfxxgkml/zyywgz/jycj/202602/t20260225_7101685.htm
- startupResult: https://rst.fj.gov.cn/zw/zfxxgk/zfxxgkml/zyywgz/jycj/202609/t20260914_7213121.htm
- jobseek: https://www.fj.gov.cn/nrrh/srst/202509/t20250904_7001017.htm
- employment: https://rst.fj.gov.cn/zw/zfxxgk/zfxxgkml/zyywgz/jycj/202607/t20260723_7191385.htm
- housing: https://zjt.fj.gov.cn/ztzl/fjsbzxzfxxgkzt/zcfg_2347/202409/t20240911_6516631.htm
- fuzhou: https://www.fuzhou.gov.cn/nrrh/fzsrlzyhshbzj/202309/t20230926_4686573.htm
- xiamen: https://glcat.ncss.cn/ncss/gjjdfjyzc/df/202605/20260528/2293500944.html
- xiamenOfficial: https://app.hrss.xm.gov.cn/xmggfw/intoCompany
- putian: https://glcat.ncss.cn/ncss/gjjdfjyzc/df/202605/20260528/2293500941.html
- sanming: https://www.sm.gov.cn/zw/gsgg/qt_5599/202509/t20250923_2157582.htm
- sanmingHousing: https://www.sm.gov.cn/zw/zwxx/sjdt/202602/t20260210_2189326.htm
- quanzhou: https://www.quanzhou.gov.cn/xsdmyjjfwzq/zqztfwrk/yhsjfwl/jyzf/ldlscjg/202607/t20260723_3311690.htm
- quanzhouBenefit: https://www.fujian.gov.cn/zwgk/ztzl/zswzjjylzzccs/sj/zx/202505/t20250522_6917056.htm
- zhangzhou: https://zjt.fj.gov.cn/xxgk/gzdt/bmdt/202512/t20251215_7046408.htm
- longyan: https://www.longyan.gov.cn/zt/rdzt/shfgf/zcwj/zwfw/202607/t20260723_2304155.htm
- ningde: https://career.xujc.com/2026/0907/c3990a172603/page.htm
- np: https://www.nprc.net/article/2060.html

## 开发与回归测试
- 数据导入：`fujianPolicyRecords.ts` / `fujianHousingRecords.ts`；接入`talentPolicyRecords.ts` / `talentHousingRecords.ts`。
- 城市目录、全国搜索共用现有注册表；独立福建intro不影响其他省份。
- 六板块指南：`/talent-service/policy-guide-preview/fujian/policy/{id}` 与 `.../housing/{id}`，所有详情页可点击到对应B/C指南。
- 验证命令：`node --experimental-strip-types scripts/test-fujian-city-v51.mjs`、`node --experimental-strip-types scripts/test-talent-cities.mjs`、`npm run build`。

## 2026-10-31 首次CI合同修复
- 所有无独立政府受理深链的政策、住房记录明确申报入口待核实。
- 2026届困难毕业生求职补贴由官方年度通知落实历史日期并降为C；创业资助截至4月15日同为C。
- 厦门2024人社局原件 https://hrss.xm.gov.cn/xxgk/tzgg/202410/t20241011_2894929.htm（教育部2026转录佐证）
- 莆田2026市级政策指南存在性由省人社厅政府案例 https://rst.fujian.gov.cn/zw/ztzl/zxzt/hfjs/jyjl/202607/t20260724_7191673.htm 确认。当地补贴标准二手汇编不冒充市政府原文。
- 2026届困难毕业生正式年度通知 https://rst.fujian.gov.cn/zw/zfxxgk/zfxxgkml/zyywgz/jycj/202510/t20251016_7022122.htm 。
