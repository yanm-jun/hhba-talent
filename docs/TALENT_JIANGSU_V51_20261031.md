# 江苏省13市 HHBA V5.1 独立开发与验收记录

> 分支 `feature/talent-jiangsu` ｜ 独立 PR #107 ｜ 2026-10-31

## 本轮功能

- 江苏13个设区市共26条来源明确的政策资料，接入现有全国城市、专业政策检索、城市列表和原始政策详情。
- 江苏13市共14条安居制度/住房服务资料。2026泰州首批100套零成本安居是已截止的历史配租，不标为实时空房。
- 全部40条记录从城市主页或统一详情进入六部分交互指南：待遇分档、资格分支、申请步骤（why/action/done）、材料自查、FAQ、政府依据与官方入口。
- 实施说明：未获得独立A级证据认证的指南仍显示B级；历史/截止记录C级。市级、园区级、专项人才、贷款和房票性质均区分。
- 新增 `apps/web/scripts/test-jiangsu-city-v51.mjs` 与 `.github/workflows/hhba-jiangsu-branch-ci.yml`。GitHub Actions自动校验并保存独立完整站点构建产物。

## 逐市内容索引

| 城市 | 政策数 | 安居资料数 | 代表专题 | 核验注意 |
| --- | ---: | ---: | --- | --- |
| 南京 | 2 | 1 | 租房安居：南京2026—2028年高校毕业生及青年人才住房租赁补贴；生活补贴：宁聚项目2026生活补贴：学士1万、硕士3万、博士10万 | 尚不能把制度记录当实时项目房源 |
| 无锡 | 2 | 1 | 购房补贴：无锡2026人才房票及新建商品住房购房支持；购房补贴：无锡2026人才购房补贴实施细则：资格、社保和配偶住房 | 尚不能把制度记录当实时项目房源 |
| 徐州 | 2 | 1 | 生活补贴：徐州彭城英才青年人才生活补贴（2024官方回顾，现行需复核）；生活补贴：彭城英才计划20条：青年人才生活补贴适用版本 | 存在历史批次/已截止，需要关注后续公告 |
| 常州 | 2 | 1 | 租房安居：常州‘常青工程·引凤来常’2026青年就业与分层安居支持；租房安居：常州2026龙城英才青年生活租房双资助和购房房票 | 尚不能把制度记录当实时项目房源 |
| 苏州 | 2 | 1 | 购房补贴：苏州工业园区2026青年人才房票及购房安居支持；租房安居：苏州工业园区优租房、人才社区与青年安家补贴 | 尚不能把制度记录当实时项目房源 |
| 南通 | 2 | 1 | 购房补贴：南通市区2026人才房票：覆盖全日制大专至高层次人才；购房补贴：南通2026人才房票具体七档金额及市区新房适用范围 | 尚不能把制度记录当实时项目房源 |
| 连云港 | 2 | 1 | 生活补贴：连云港人才政策3.0：高校毕业生生活补贴与分级支持；购房补贴：连云港2026人才优惠购房与市区购房券活动（第二期） | 存在历史批次/已截止，需要关注后续公告 |
| 淮安 | 2 | 1 | 购房补贴：淮安2026人才房票：数字化服务平台申领与购房抵扣；租房安居：淮安2026人才公寓及先租后补：博士1200至大专300元/月 | 尚不能把制度记录当实时项目房源 |
| 盐城 | 2 | 1 | 生活补贴：盐城黄海明珠人才计划2.0：生活、租房与购房补贴；购房补贴：盐城2026黄海明珠人才购房补贴凭证抵扣房款 | 尚不能把制度记录当实时项目房源 |
| 扬州 | 2 | 1 | 生活补贴：扬州2025—2026人工智能产业专项引才及安居支持；购房补贴：扬州2026青年人才住房公积金贷款额度梯度提高 | 尚不能把制度记录当实时项目房源 |
| 镇江 | 2 | 1 | 生活补贴：镇江‘聚镇归雁’高校毕业生生活补贴及租房补贴官方申报通道；租房安居：镇江‘镇青驿站’免费短期住宿与人才服务入口 | 尚不能把制度记录当实时项目房源 |
| 泰州 | 2 | 2 | 购房补贴：泰州人才购房券办理与分层人才安居支持；租房安居：泰州2026青年人才零成本安居100套首批分配通告（历史） | 存在历史批次/已截止，需要关注后续公告 |
| 宿迁 | 2 | 1 | 购房补贴：宿迁人才新政2.0：青年安居购房券与生活补贴；生活补贴：宿迁2026人才新政2.0青年生活补贴最高8万元（分类待核） | 尚不能把制度记录当实时项目房源 |

## 内容质量分档与不可夸大的事实

1. 城市目录已开通不等于城市所有人才政策收录完毕。各市仍可能有大量区县级、园区级、季节性就业创业待遇未收录，需另行核对。
2. 房票/购房券用于按规则抵扣指定房屋购房价，不属于无条件现金发放。住房公积金贷款额度需偿还，不是购房补贴。
3. 住房制度、人才公寓建设累计规模、旧批次房源数均不等于实际可申请空房。没有实际项目地址、房型、租金、实时有效批次的内容保持B或C。
4. 2026年申请系统首页和政府官方政策原文不是同一种链接。所有不确定的业务深链均明确标注待核验，不将新闻转载冒充第一手实施细则。
5. 未逐项具备官方细则和真实经办操作证据的城市不得勾选整城完成，也不得为新增记录自动授予A级。

## 重点官方依据

### 南京
- [南京2026—2028年高校毕业生及青年人才住房租赁补贴](https://www.nanjing.gov.cn/zxfwn/ztfw/zf/zcxx_74507/zcwj/202603/t20260323_5810366.html) — 2026-03-04，等级待独立核验，ID `js-nanjing-2026-rent`
- [宁聚项目2026生活补贴：学士1万、硕士3万、博士10万](https://rsj.nanjing.gov.cn/njsrlzyhshbzj/202603/t20260304_5799905.html) — 2026-02-09，等级待独立核验，ID `js-nanjing-living-detail`
- [住房：南京2026—2028青年人才租房补贴与住房保障政策通道](https://www.nanjing.gov.cn/zxfwn/ztfw/zf/zcxx_74507/zcwj/202603/t20260323_5810366.html) — 2026-03-04，ID `js-nanjing-youth-rent-program`

### 无锡
- [无锡2026人才房票及新建商品住房购房支持](https://www.wuxi.gov.cn/doc/2026/06/01/4784429.shtml) — 2026-04-13，等级待独立核验，ID `js-wuxi-2026-house-ticket`
- [无锡2026人才购房补贴实施细则：资格、社保和配偶住房](https://www.wuxi.gov.cn/doc/2026/06/01/4784429.shtml) — 2026-06-01，等级待独立核验，ID `js-wuxi-purchase-detail`
- [住房：无锡2026人才房票安居制度与购房业务](https://js.wuxi.gov.cn/doc/2026/04/13/4758521.shtml) — 2026-04-13，ID `js-wuxi-house-ticket-program`

### 徐州
- [徐州彭城英才青年人才生活补贴（2024官方回顾，现行需复核）](https://www.js.gov.cn/art/2024/10/24/art_88959_11412206.html) — 2024-10-24，等级待独立核验，ID `js-xuzhou-2024-youth-living`
- [彭城英才计划20条：青年人才生活补贴适用版本](https://jshrss.jiangsu.gov.cn/art/2023/12/26/art_78498_11109821.html) — 2023-12-26，等级待独立核验，ID `js-xuzhou-living-detail`
- [住房：徐州彭城英才人才公寓与青年住房服务（项目受理待核）](https://jshrss.jiangsu.gov.cn/art/2023/12/26/art_78498_11109821.html) — 2023-12-26，ID `js-xuzhou-pengcheng-apartment-program`

### 常州
- [常州‘常青工程·引凤来常’2026青年就业与分层安居支持](https://www.changzhou.gov.cn/gi_news/481178246027268) — 2026-06-26，等级待独立核验，ID `js-changzhou-2026-qinggong`
- [常州2026龙城英才青年生活租房双资助和购房房票](https://czj.changzhou.gov.cn/html/czfb/2026/OJPCNLOE_0921/22270.html) — 2026-09-21，等级待独立核验，ID `js-changzhou-housing-detail`
- [住房：常青工程·引凤来常青年安居支持政策](https://www.changzhou.gov.cn/gi_news/481178246027268) — 2026-06-26，ID `js-changzhou-qinggong-housing`

### 苏州
- [苏州工业园区2026青年人才房票及购房安居支持](https://www.suzhou.gov.cn/szsrmzf/qxkx/202601/1c153d1dc7de4e5aac004b807541034a.shtml) — 2026-01-01，等级待独立核验，ID `js-suzhou-2026-sip-ticket`
- [苏州工业园区优租房、人才社区与青年安家补贴](https://www.suzhou.gov.cn/szsrmzf/qxkx/202605/291fdb1aa30e44bc9ebe8ae3a64ee11f.shtml) — 2026-05-20，等级待独立核验，ID `js-suzhou-housing-detail`
- [住房：苏州工业园区青年人才房票与住房服务](https://www.suzhou.gov.cn/szsrmzf/qxkx/202601/1c153d1dc7de4e5aac004b807541034a.shtml) — 2026-01-01，ID `js-suzhou-sip-housing-program`

### 南通
- [南通市区2026人才房票：覆盖全日制大专至高层次人才](https://www.nantong.gov.cn/ntsrmzf/zffwzx/content/acb9ee0d-35c6-4805-933e-a219e66890be.html) — 2025-12-18，等级待独立核验，ID `js-nantong-2026-house-ticket`
- [南通2026人才房票具体七档金额及市区新房适用范围](https://www.nantong.gov.cn/ntsrmzf/zffwzx/content/acb9ee0d-35c6-4805-933e-a219e66890be.html) — 2025-12-18，等级待独立核验，ID `js-nantong-purchase-detail`
- [住房：南通2026市区人才房票安居服务](https://www.nantong.gov.cn/ntsrmzf/zffwzx/content/acb9ee0d-35c6-4805-933e-a219e66890be.html) — 2025-12-18，ID `js-nantong-house-ticket-program`

### 连云港
- [连云港人才政策3.0：高校毕业生生活补贴与分级支持](https://www.lyg.gov.cn/zglygzfmhwz/gcyw/content/8a1128cb-4c03-4f7c-90b3-66193d14f9af.shtml) — 2025-11-20，等级待独立核验，ID `js-lianyungang-2025-talent-living-3`
- [连云港2026人才优惠购房与市区购房券活动（第二期）](https://www.lyg.gov.cn/zglygzfmhwz/gcyw/content/f90695c4-aa2c-4abe-93cf-759f3ed091ae.html) — 2026-09-23，等级待独立核验，ID `js-lianyungang-purchase-detail`
- [住房：连云港2026青连驿站短期免费住宿服务](https://www.lyg.gov.cn/zglygzfmhwz/fwzx_cycx/content/a6e4a52b-c48b-4ce8-9cfd-78290eba54a0.htm) — 2026-03-16，ID `js-lianyungang-youth-inn-program`

### 淮安
- [淮安2026人才房票：数字化服务平台申领与购房抵扣](https://rsj.huaian.gov.cn/col/4093_565365/art/o/17802432/1781060562890n1VBorqk.html) — 2026-05-25，等级待独立核验，ID `js-huaian-2026-voucher`
- [淮安2026人才公寓及先租后补：博士1200至大专300元/月](https://www.zgjssw.gov.cn/shixianchuanzhen/huaian/202605/t20260509_8572201.shtml) — 2026-05-09，等级待独立核验，ID `js-huaian-housing-detail`
- [住房：淮安2026人才房票安居保障办理通道](https://www.huaian.gov.cn/col/16657_173466/art/17775648/1780037470306YQEhbERP.html) — 2026-05-29，ID `js-huaian-house-ticket-program`

### 盐城
- [盐城黄海明珠人才计划2.0：生活、租房与购房补贴](https://jsychrss.yancheng.gov.cn/art/2025/12/17/art_45150_4388987.html) — 2025-12-17，等级待独立核验，ID `js-yancheng-huanghai-2025`
- [盐城2026黄海明珠人才购房补贴凭证抵扣房款](https://zfhcxjsj.yancheng.gov.cn/art/2026/4/30/art_2319_4422105.html) — 2026-04-30，等级待独立核验，ID `js-yancheng-purchase-detail`
- [住房：盐城青年路人才社区二期与黄海明珠人才公寓住房服务](https://www.yancheng.gov.cn/art/2026/5/26/art_34222_4427389.html) — 2026-05-26，ID `js-yancheng-youthroad-community`

### 扬州
- [扬州2025—2026人工智能产业专项引才及安居支持](https://www.jiangsu.gov.cn/art/2025/6/3/art_89419_11579137.html) — 2025-06-03，等级待独立核验，ID `js-yangzhou-2025-ai-talent`
- [扬州2026青年人才住房公积金贷款额度梯度提高](https://www.jiangsu.gov.cn/art/2026/10/10/art_46548_346.html) — 2026-10-10，等级待独立核验，ID `js-yangzhou-purchase-detail`
- [住房：扬州人工智能人才政策配套人才公寓、青年人才驿站](https://www.jiangsu.gov.cn/art/2025/6/3/art_89419_11579137.html) — 2025-06-03，ID `js-yangzhou-ai-apartment`

### 镇江
- [镇江‘聚镇归雁’高校毕业生生活补贴及租房补贴官方申报通道](https://5a.hrss.zhenjiang.gov.cn/) — 2026-10-31，等级待独立核验，ID `js-zhenjiang-youth-benefits-portal`
- [镇江‘镇青驿站’免费短期住宿与人才服务入口](https://5a.hrss.zhenjiang.gov.cn/) — 2026-10-31，等级待独立核验，ID `js-zhenjiang-housing-detail`
- [住房：镇江智慧人社镇青驿站青年求职免费住宿](https://5a.hrss.zhenjiang.gov.cn/) — 2026-10-31，ID `js-zhenjiang-qing-inn`

### 泰州
- [泰州人才购房券办理与分层人才安居支持](https://tac.rsj.taizhou.gov.cn/guide/1edb1faea14541fbad5d69ce84863c68) — 2026-10-31，等级待独立核验，ID `js-taizhou-talent-housing-voucher`
- [泰州2026青年人才零成本安居100套首批分配通告（历史）](https://jsj.taizhou.gov.cn/ztzl/zfztfw/zcxx/art/2026/art_f0cebf60532442daa98c851bf1787875.html) — 2026-05-28，等级待独立核验，ID `js-taizhou-housing-detail`
- [住房：泰州人才公共服务平台购房券安居事项](https://tac.rsj.taizhou.gov.cn/guide/1edb1faea14541fbad5d69ce84863c68) — 2026-10-31，ID `js-taizhou-house-ticket-program`
- [住房：泰州2026年首批零成本青年安居100套配租（历史已截止）](https://jsj.taizhou.gov.cn/ztzl/zfztfw/zcxx/art/2026/art_f0cebf60532442daa98c851bf1787875.html) — 2026-05-28，ID `js-taizhou-2026-zero-rent-batch1`

### 宿迁
- [宿迁人才新政2.0：青年安居购房券与生活补贴](https://www.jiangsu.gov.cn/art/2026/7/20/art_33718_11805792.html) — 2026-07-20，等级待独立核验，ID `js-suqian-2026-talent-2`
- [宿迁2026人才新政2.0青年生活补贴最高8万元（分类待核）](https://www.jiangsu.gov.cn/art/2026/7/20/art_33718_11805792.html) — 2026-07-20，等级待独立核验，ID `js-suqian-living-detail`
- [住房：宿迁人才新政2.0购房券安居服务](https://www.jiangsu.gov.cn/art/2026/7/20/art_33718_11805792.html) — 2026-07-20，ID `js-suqian-housing-policy`

## 测试与交付

在 GitHub Actions 独立分支运行：

```bash
cd apps/web
npm ci --no-audit --no-fund
node --experimental-strip-types scripts/test-jiangsu-city-v51.mjs
node --experimental-strip-types scripts/test-talent-city-contract-v51.mjs
node --experimental-strip-types scripts/test-talent-cities.mjs
HHBA_GITHUB_PAGES=1 HHBA_PAGES_BASE=/hhba-talent/ npm run build
```

独立静态构建产物保存为 GitHub Actions artifact：`jiangsu-13-city-v51-static-preview`。没有正式部署本仓库 GitHub Pages，不覆盖主线站点；正式网站需要用户另行验收合并后再发布。

## 剩余可继续拓展的官方调查

已覆盖13市基本人才政策/安居制度入口，但还应逐城补充：区县级补贴、实楼盘门牌地址与每项目房型/租金、实时有效申请公告、真实热线、专项平台直达业务深链。上述内容缺少第一手资料时不作为已完成实际可申办资料。
