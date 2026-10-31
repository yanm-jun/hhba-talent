# 四川省人才政策 V5.1 · 来源接入及缺口表（2026-10-31）

本阶段以2026-10-31 `main` 为基线，从四川21个地级行政区（18市、3自治州）建立统一可点击目录及政府资料接入。**只有已核查政府一手政策的地区才进入正式聚合，不能用省级兜底政策伪装为当地政策。** `ACCEPTED_TALENT_CITIES` 不变，仍然没有整城A级认证。住房记录 `kind=program`，绝不是当前有空房的项目。

## 已有政府来源的10个地区
- 成都：2026人才优租，https://cdzj.chengdu.gov.cn/gkml/zcjd/1477308600903794688.shtml （门户若反爬拒绝访问，需复核公开入口；同名原文由成都住建发布）
- 自贡：2026重点产业人才支持，https://www.zgtalent.gov.cn/M/rczc-View-363-7377.html
- 德阳：“青春留德”公积金支持，https://credit.deyang.gov.cn/sndt/20240531/25526.html （政府宣传，非2026独立事项入口）
- 广元：2025保障性租赁住房管理办法，https://jsj.cngy.gov.cn/mshow/4db9af794fca416ea6e17f54eb5c84e7.html
- 乐山：已有乐山高新区人才政策八条，本分支保留两条政策和一条住房制度，https://www.leshan.gov.cn/lsswszf/zfwj/90053490/2024060709322216460200000.html
- 南充：2026高层次人才引进公告，https://www.nanchong.gov.cn/xwdt/gsgg/t_2367885.html
- 眉山：2025配售型保障住房管理办法，https://credit.ms.gov.cn/detail.do?channelId=c77c6fb89dcd465fa27639c1be0c91a2&contentId=2114bccc2648406fb6b93853da6e0176
- 达州：2025市政府人才建议答复，涉及万源达人英才专项，不等于达州全市统一标准，https://www.dazhou.gov.cn/xxgk-show-37725.html
- 雅安：市委组织部高层次人才岗位激励，https://www.yarc.gov.cn/front/web/details/475.html
- 阿坝：2025人才发展大会，人才公寓三年建设计划及缺房引进人才支持，https://www.abazhou.gov.cn/abazhou/c101955/202512/7232d7133cd34dbbaa20ea626f8e56c0.shtml

## 仍缺独立市级一手政策原文的11个地区

攀枝花、泸州、绵阳、遂宁、内江、宜宾、广安、巴中、资阳、甘孜、凉山。

已有其他转发线索或历史招聘公告的不等于当前现行普惠政策；需要逐市核实后才填正式 `TALENT_POLICY_RECORDS`。特别注意2026宜宾下半年引才单位报名截止2026-10-31，不得以当前开放仍可报名；凉山2026第一批引才历史报名也已结束。

## 本阶段新增的住房制度记录

成都、自贡、德阳、广元、南充、眉山、达州、雅安、阿坝共9条，均为政府住房支持或制度类型 `kind=program`。不把政策划定的面积、历史项目规划数量、2026建设计划、贷款额度或资格公示人数称为当前库存。

## 页面/质量约束

- 保留现有首页布局；在四川21市（州）的城市服务入口内呈现本地政策与住房指南组件。
- 所有已核实政策均有适用对象、原文来源、申请材料、分步核查流程、受理状态警告和跨地区条件限制，均为B级。
- 未完成的一手证据继续明确标注待核验，不标记为“全省V5.1完成”。
- 测试：`node --experimental-strip-types scripts/test-sichuan-city-v51.mjs`，`node --experimental-strip-types scripts/audit-talent-national-main.mjs`，`npm run build`。

### 2026-10-31追加住房制度核验

- 德阳：2024年政府域名“青春留德”公积金支持政策（https://credit.deyang.gov.cn/sndt/20240531/25526.html），仅作历年制度基础；2026新版受理细则/入口需确认，非人才公寓空房。
- 达州：达市府办发〔2021〕55号《达州市市本级人才公寓管理办法》，见达州市政府公报2022年第1期第9-10页（https://swj.dazhou.gov.cn/uploadfile/16/Attachment/af21e4c4a8.pdf），原文件仅适用市本级特定引进人才，当前是否修订和项目空房需核验，不可称2026现行开放。
- 全国住房数据质量规则要求住房制度记录有明确“申报入口待核实”提示；这不是办理入口核实完成，而是明确未核验状态。
