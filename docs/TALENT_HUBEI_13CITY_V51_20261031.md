# 湖北省13市州 V5.1 独立开发台账

2026-10-31；开发分支 `feature/talent-hubei`；基于原主线 `bad0de26`。未经用户验收禁止合并main或覆盖现有GitHub Pages正式站。
 
## 范围
13市州：武汉、黄石、十堰、宜昌、襄阳、鄂州、荆门、孝感、荆州、黄冈、咸宁、随州、恩施。12个地级市在现有全国293城字典中，恩施土家族苗族自治州补成独立州条目。全市州数据**59条政策**、**16条住房资料**，共75个使用统一6板块组件的B/C级办事指南。未新增独立页面风格、不改招聘或留学。
 
52条省级统一政策属地映射，每市州4项：鄂人社发〔2026〕21号高校毕业生初创一次性5000元，困难毕业生求职补贴为当地最低工资80%，小微企业社保补贴由企业申领，指定重点县域基层就业3000元（执行至2026-12-31）。重复按城市展示不等于52项独立市级福利。
7条地方专项政策分别为黄石2026公积金2000元、宜昌2026青年租房和购房券、鄂州2026人才生活补贴和取消人才购房补贴通道、咸宁2026已截止武汉大学站引才待遇、十堰2026工匠认定。
住房13条省级2026青年安居政策的市州索引另加3条：黄石钢友大厦2026真实项目交付173套历史建设总量，荆州2025年第三批7小区1090套历史房源公告，宜昌青年人才公寓及驿站规划。**只有黄石为已核独立实体住房项目；其实际2026-10-31可租余量、实时租金和申报时限未核实。**
 
## 特别风险
- 鄂州市经信局2026-06-15答复：2026不再发放人才购房补贴，旧申请通道关闭。与2024旧购房券政策冲突时以该2026最新正式答复为准。
- 宜昌2026年租房500/800/1000元按学历和实际人才资格、项目区域审核；10/6/5万购房券仅限项目库内指定新建商品房，租购待遇不得随意叠加。
- 咸宁2026武汉大学站5月22日报名截止，招聘岗位限定的生活补贴不是全体咸宁本科生普惠。
- 全省住建厅2026年9月青年安居措施中“2万套以上”是省级统筹动态目标，不是每市2万套或现有空房。
- 全部乡村振兴重点县就业3000元政策必须查适用县区范围，不能按全市普惠。
- 当期正式办理深链、具体市县独立人才专项、真实住房项目租价与余房尚未逐项核清，不能标整城A级。

## 政府来源
- 2026省级就业创业原文：https://rst.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/202606/t20260602_5949911.shtml
- 2026省住建厅青年安居：https://zjt.hubei.gov.cn/bmdt/dtyw/gzdt/202609/t20260922_6020406.shtml
- 黄石2026公积金：https://www.huangshi.gov.cn/xwdt/hsyw/202605/t20260527_1330827.html
- 黄石钢友大厦：https://zjj.huangshi.gov.cn/xxgk_7967/fdzdgknr/gysy/zfbz/202610/t20261009_1364636.html
- 宜昌住房新政：https://gzw.yichang.gov.cn/content-40899-17785-1.html
- 宜昌购房券：https://www.yichang.gov.cn/show-64236-1075936-1.html
- 鄂州取消补贴：https://jxj.ezhou.gov.cn/hdjl/xjhf/202606/t20260616_768372.html
- 鄂州生活补贴：https://jxj.ezhou.gov.cn/hdjl/xjhf/202606/t20260625_769398.html
- 咸宁已截止引才：https://slj.xianning.gov.cn/xxgk/xxgkml/rsxx/202605/t20260513_4618518.shtml
- 十堰工匠文件：https://fzzx.shiyan.gov.cn/index.php?a=show&c=index&catid=11&id=2180&m=content
- 荆州2025年保租房：https://zjt.hubei.gov.cn/bmdt/dtyw/szsm/202501/t20250120_5510051.shtml
 
## 自动检查
`node --experimental-strip-types scripts/test-hubei-city-v51.mjs`
`node --experimental-strip-types scripts/test-talent-city-contract-v51.mjs`
`node --experimental-strip-types scripts/test-talent-cities.mjs`
`npm run build`

独立 Actions artifact 只能作为构建包，**不是公开可点击预览网址**；是否合并和发布仍等待用户手动验收。