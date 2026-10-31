# HHBA 山西省11市 V5.1 开发审计 · 2026-10-31

## 范围
已开发：太原、大同、阳泉、长治、晋城、朔州、晋中、运城、忻州、临汾、吕梁。新增22条人才政策基础资料和11条住房制度/项目核验记录；已接入全国政策索引、住房索引与原V5.1共用列表、搜索、详情，不改变首页和企业留学页面。新增自动门禁禁止山西11市在构建中出现政策或住房同时为零的情况。

## 证据与历史边界
大同2026补贴正式通知属特定招聘入职时间的补助，不保证开放到今日；阳泉补贴由高新区公示与市级房地产政策来源，区级额不可随意叠加；长治2026年圣鑫园110人的配租为历史完成，不代表现在有110套空房；晋城2024解读金额须核2026现行受理。太原历史建筑规模非当前可租；吕梁2025住房500套是建设目标非已运营。

晋中、朔州、临汾目前未核到可证明2026具体人才公寓楼栋、租金、空房或完整当期个人申领深链的政府公文。相应住房项目只标为“政策核验通道”，**不得对用户显示仍有房源**；所有新增记录B/C级，不伪造A级完整指南或已验收城市。

## 省级政策
山西人才1+N： https://wjw.shanxi.gov.cn/xwzx/szyw/202409/t20240906_9648834.shtml
省级2025新制度： https://wjw.shanxi.gov.cn/xwzx/szyw/202505/t20250506_9825721.shtml
省级2026市场化引才奖励： https://wjw.shanxi.gov.cn/xwzx/szyw/202601/t20260106_10032528.shtml （主要补贴给符合条件的猎头机构和用人单位，**不是所有毕业生的个人补助**）

## 各城市政府原文来源
- 太原： https://wjw.shanxi.gov.cn/xwzx/szyw/202409/t20240909_9650213.shtml； https://wjw.shanxi.gov.cn/zfxxgk/fdzdgknr/gggs/202601/t20260126_10048322.shtml
- 大同： https://www.dt.gov.cn/dtszf/gsgg/202605/3b279820197d4eb58d7daada9c0949c8.shtml； https://www.dt.gov.cn/dtszf/xzgfwj2025/202510/4c4744b43cad4bbca2666dccdd0ecf6f.shtml
- 阳泉： https://xxgk.yq.gov.cn/yqjjjskfq/fdzdgknr/gzdt/tzgggs/202602/t20260226_2174885.shtml； https://xxgk.yq.gov.cn/yqsrmzf1/gzk/xzgfxwj0317/202410/t20241022_1968236.shtml； https://yq.gov.cn/ywdt/jryq/202609/t20260908_2236210.shtml
- 长治： https://zjj.changzhi.gov.cn/xwzx/zfwj/202501/t20250108_3004288.html； https://www.changzhi.gov.cn/xwzx/jrzz/202408/t20240828_2946518.shtml； https://changzhi.gov.cn/xxgkml/zfxxgkml/szfgzbm/szfbzhcxjsglj/czsrmzf/lzxx/202603/t20260327_3152199.shtml
- 晋城： https://www.jcgov.gov.cn/dtxx/jcdt/202405/t20240517_1983815.shtml； https://www.jcgov.gov.cn/zwgk/wjgg/zcjd/202601/t20260113_2308257.shtml
- 朔州： https://wjw.shanxi.gov.cn/xwzx/szyw/202411/t20241111_9688548.shtml； https://wjw.shanxi.gov.cn/xwzx/szyw/202409/t20240909_9650192.shtml； https://wjw.shanxi.gov.cn/xwzx/szyw/202409/t20240909_9650213.shtml
- 晋中： https://wjw.shanxi.gov.cn/xwzx/sxdt/202604/t20260413_10102474.shtml； https://wjw.shanxi.gov.cn/xwzx/szyw/202505/t20250506_9825721.shtml； https://wjw.shanxi.gov.cn/xwzx/szyw/202409/t20240909_9650213.shtml
- 运城： https://gxj.yuncheng.gov.cn/doc/2023/05/23/344799.shtml； https://gxj.yuncheng.gov.cn/doc/2020/07/10/38963.shtml； https://gxj.yuncheng.gov.cn/doc/2024/01/08/415966.shtml
- 忻州： https://www.dt.gov.cn/dtszf/sxyw/202504/a997e94f687e403183512183d9f889b1.shtml； https://rd.xzpc.gov.cn/info/1016/6430.htm
- 临汾： https://ywtycb.gaj.linfen.gov.cn/site/public/showinfo.aspx?id=2016080817142260930110； https://gxj.yuncheng.gov.cn/doc/2020/07/10/38963.shtml
- 吕梁： https://www.lvliang.gov.cn/llxxgk/zfxxgk/xxgkml/zcwj_21555/202407/t20240710_1881023.html； https://www.lvliang.gov.cn/llxxgk/zfxxgk/xxgkml/gbmwj/zjj/fdzdgknr_55202/csjs_69302/fdcgl_55537/202506/t20250604_1956122.html

## 构建验收
独立分支 feature/talent-shanxi-v51-20261031；脚本 test-shanxi-11city-v51.mjs、全国V5.1合同测试、住房空缺门禁以及npm run build。GitHub Actions只构建并上传静态产物，未发布正式Pages。合并main与正式部署需用户单独批准。
