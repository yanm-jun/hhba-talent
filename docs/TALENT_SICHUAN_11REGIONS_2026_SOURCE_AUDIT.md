# 四川省11处直接政策缺口 · 2026年专项补录记录

日期：2026-11-01。执行分支：`feature/talent-2026-sichuan-qinghai-housing-gap-20261101`。主线原先为 `ac77fdb661aa2338a99e3ca53710dfa6a6c31478`。

## 数据口径
原 `main` 有11个四川市州缺少直接政策记录，本分支独立核验来源并逐个建立带属地、资格、材料、办理步骤、原文、时效字段的记录。11个市州**直接政策记录不再为0**，但这里的“建档”并不等于本市2026所有现行人才待遇已查全、更不是11个城市全部A级。正常奖补、岗位招录、公示和服务项目必须分开。未确认实时资格受理入口。招聘已截止的日期标记历史；安家费与人才分类认定必须按具体单位核验。

| 市州 | 新记录 | 2026证据 | 适用范围与仍需审查 |
|---|---|---|---|
| 攀枝花 | `sc-2026-panzhihua-industry-talent-recognition` | https://jxj.panzhihua.gov.cn/zfxxgk/tzgg/10297031.shtml | 市经信局工业高层次人才分类认定历史公示；无统一现金，后续批次待核 |
| 泸州 | `sc-2026-luzhou-spring-industry-talent-posts` | https://www.lzsrsks.cn/web/info/detail/8ac981829d235619019d76702e4f02c7 | 官方组织的人才需求5175名是岗位计划，春招已结束；不同企业政策须另查 |
| 绵阳 | `sc-2026-mianyang-delivery-housing-voucher` | https://sc.spb.gov.cn/scsyzglj/c105609/c105613/202609/76bb61f2e18440919ce0468d4a7c7462.shtml | 快递员等符合条件新就业群体的城区购房消费券；不得当全市硕博现金补贴 |
| 遂宁 | `sc-2026-suining-young-career-guidance` | https://chinajob.mohrss.gov.cn/c/2026-07-16/574114.shtml | 高校毕业生就业指导服务，不是财政现金项目；具体当期项目需问本地就业部门 |
| 内江 | `sc-2026-neijiang-graduate-employment-relief` | https://chinajob.mohrss.gov.cn/c/2026-10-13/619337.shtml | 2026已兑现困难求职创业补贴及就业帮扶信息；具体申领类别/年度仍需原规章 |
| 宜宾 | `sc-2026-yibin-autumn-talent-2309` | https://www.ybrsks.com.cn/#/websitepublicnewsone?newsId=9cce72af-b3fb-4323-a99e-fbceea7c6884 | 引才2309名是计划；原则上10月31日截止报名，安家15—25万元只限合格分层人才；原站JS直链可访问性待查 |
| 广安 | `sc-gap-guangan-2026-buy` | https://www.hys.gov.cn/zfxxgk/c112143/pc/content/content_2101506338819870720.html | 市级支持县区分类购房激励，不代表全市统一钱款 |
| 巴中 | `sc-2026-bazhong-spring-talent-728` | https://www.bzswzzb.gov.cn/tzgg/23912553.html | 2026春招728名计划，原站自动访问超时，另有高校原文转载；历史招聘，不是当前可报名 |
| 资阳 | `sc-2026-ziyang-anyue-high-talent-allowance` | https://www.cqdx.gov.cn/web/article/1501547796643905536/web/content_1501547796643905536.html | 严格限安岳县2026引才岗位及人才资格，金额不得扩大为资阳市市级补贴 |
| 甘孜 | `sc-2026-ganzi-xiangcheng-additional-jobs` | https://www.xcx.gov.cn/gsgg/article/736938 | 乡城县增量基层政策性岗位历史招录，不等于甘孜州全域现金政策 |
| 凉山 | `sc-2026-liangshan-first-talent-505` | https://www.cqdx.gov.cn/web/article/1502633408910557184/web/content_1502633408910557184.html | 州内首批505名岗位历史计划；县市和单位人才待遇另查，事业单位服务期至少5年 |

## 未完事项
1. 所有市州其他现行2026现金补贴、落户、创业、安居等政策继续逐条检查，不能只因已有一条记录停止研究。
2. 宜宾人事考试网单页应用及巴中党建网网页存在自动访问限制，须人工核对原件；政府域名转载并非原发布机构。
3. 11市州因新增政策暴露的住房缺口单列 `newlyExposedSichuanHousingCount`，不应将原有26处住房防回退上限放宽，也不能隐藏新缺口。
4. 确认受理入口、最新材料、2026有效性、项目及住房余房以后才能考虑申请A级。

### 自动化门禁
`node --experimental-strip-types scripts/test-sichuan-2026-policy-gap.mjs`
`HHBA National Talent Main Audit`、住房缺口审计和前端静态构建仍需同PR检查。