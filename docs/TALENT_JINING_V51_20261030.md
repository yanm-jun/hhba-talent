# HHBA 济宁市 V5.1 核验与发布记录（2026-10-30）

城市：济宁｜仓库：`yanm-jun/hhba-talent`｜主线：`main`｜共享组件：`UnifiedPolicyList`、`UnifiedTalentRecordDetail`、`UnifiedPolicyGuide`。

## 数据范围
保持原有 `sd-jining-2026-introduction`、`jn-start-26`、`jn-opc-insurance-26` 三个ID不变，补齐一手来源、对象、条件、受理流程和限制。新增 `jn-maincity-rent-2026` 租房补贴与 `jn-houseticket-2022-history` 历史房票。新建两条住房**政策通道**（kind=program），不虚构人才公寓地址、房源或开通申请状态。济宁现有独立项目未获得实时来源，故不作为已核实独立住房项目。

## 核心事实与防误读
- 2026-07-24 济宁人社惠企政策第十六项：博士6万元/年，硕士2.4万元/年，本科1.2万元/年，攀登企业专科6000元/年；博士和符合条件硕士另有家属奖励。财政拨付单位，并不代表财政直接转给毕业生。2024市级明白纸明确单位依法缴税、按规定发放给人才；学历、年龄、单位及引才年度有分档条件，2024特定批次平台不当作2026仍开放。
- 2026-07-24 一次性创业补贴：小微企业1.2万、个体工商户2000元，政策人群、首次创业、经营1年及社保缴纳时间分别核对，个人限一次。
- 2026-08-17 OPC吸纳毕业生社保补贴：企业支持，**不是**个人现金。
- 2026-06-23济宁市住建局官方答复：主城区新就业无房职工租赁补贴须具主城区户籍或居住证、全日制专科及以上毕业不满5年、依法就业参保、家庭无私房、不享互斥补贴、合法租赁备案。较早公开回复有单人300、二人350、三人及以上400元/月和公积金要求，与2026细节需在属地窗口复核，不能保证同一现行标准。
- 2022《济宁人才金政20条》曾设人才房票购房奖励，2026实施细则和受理状态未核实，标历史C级，不宣称当前直接可领。
- 2022市政府保租房意见：重点保障当地无房的青年新市民；项目具体租金原则不高于市场租金80%，不是同城所有公寓统一八折；2025“筹集人才住房4050套”是建设目标，非现时空房。

## 政府一手来源
1. https://hrss.jining.gov.cn/art/2026/7/24/art_77432_2718783.html
2. https://hrss.jining.gov.cn/art/2026/8/17/art_15073_2718865.html
3. https://hrss.jining.gov.cn/art/2024/2/20/art_15086_2714566.html
4. https://hrss.jining.gov.cn/art/2024/7/16/art_15073_2716080.html
5. https://www.jining.gov.cn/jact/front/mailpubdetail.do?sysid=1&transactId=303487
6. https://dlrk.jining.gov.cn/jact/front/comquestiondetail.do?comquestid=186&sysid=1
7. https://www.jining.gov.cn/art/2022/11/10/art_103322_7832.html
8. https://bhdjq.jining.gov.cn/art/2022/11/25/art_71991_2714792.html
9. https://www.jining.gov.cn/art/2025/3/12/art_33401_2899110.html

## 质量与验收
- 两份公用模板B级指南：`talentJiningGuides.ts` 的引才、租补分支；各有步骤、材料自查、常见问题及官方证据，不擅自申请A级认证。
- 运行 `test-jining-city-v51.mjs` 与 `test-talent-city-contract-v51.mjs`、山东16市测试、全站构建。
- 首页：`/talent-service/city/%E6%B5%8E%E5%AE%81`；政策：`/talent-service/list/policies/%E6%B5%8E%E5%AE%81`；住房：`/talent-service/list/housing/%E6%B5%8E%E5%AE%81`；指南：`/talent-service/policy-guide-preview/jining/youth` 和 `/talent-service/policy-guide-preview/jining/rent`。
- GitHub Pages是验收预览，不修改阿里云正式环境。

待完善：2026有效线上申请入口（引才和租补）、人才房票最新实施细则、可公开核实的具体人才公寓项目/地址/实际租金/最新配租批次。不得把这些标为已完成。
