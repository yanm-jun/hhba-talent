# HHBA 浙江省11市人才政策 V5.1 开发与验收记录

日期：2026-10-31 · 独立整合分支：`feature/talent-zhejiang` · 基线：`feature/talent-hangzhou` 从 `main` 衍生 · 不合并、不触发正式 Pages。

## 1. 11个地级市数据覆盖

| 城市 | 新增政策 | 新增住房 | 重点内容 | 资料边界 |
| --- | ---: | ---: | --- | --- |
| 杭州 | 5 | 2 | 毕业生租补、高层次人才购租房、专项租赁住房、2023–25历史生活补贴 | 需逐栋核验2026人才公寓及申请分支；原先已有杭州旧记录保留 |
| 宁波 | 2 | 1 | 奉化2026-10-20至11-30租补、宁波市级青年租住总览 | 奉化区与市级金额不能混用；2024/2021新旧版本条件不同 |
| 温州 | 2 | 1 | 温州人才分类住房租售、510大学生招引政策 | 2024原文参考，须核2025–27迭代510+细则 |
| 嘉兴 | 1 | 1 | 2025市级人才落户、2025配售型保障住房条例 | 配售型住房≠房票/现金；2026申报补贴当批已截止，尚未作为主源入库 |
| 湖州 | 2 | 1 | 2026青年入乡法规、南太湖项目、德清德欣公寓 | 德欣159套及租价是历史项目资料非实时余房 |
| 绍兴 | 2 | 1 | 人才发展促进条例、党校专用过渡住房、住房制度 | 单位过渡住房不能扩展为全市普惠；市区新房票细则待核 |
| 金华 | 2 | 1 | 智选金华2023购租住房历史细则 | 2026新旧交接尚未核实，旧金额绝不标为当前待遇 |
| 衢州 | 2 | 1 | 2021“十四五”高层次人才补助工作规划 | 是历史制度建设证据，不是2026可领项目；实际申报公告尚缺 |
| 舟山 | 2 | 1 | 2026跨岛公租房资格、海洋人才产业支持 | 政府报道非申领入口；没有可申报空房/金额数据 |
| 台州 | 2 | 1 | 2026版青年人才房票、安家补贴、青年驿站 | **浙江台州**，严禁与江苏泰州混用；受理系统仍待核 |
| 丽水 | 2 | 1 | 经开区房票与租票、碧湖数商园732套改建工程 | 经开区政策不是全市；732套在建不代表已可出租 |

**合计新增24条政策、12条住房资料。** 均按城市索引接入 `TALENT_POLICY_RECORDS`、`TALENT_HOUSING_RECORDS`；已有记录不可删除或覆写。全国城市注册表内浙江11市早已存在，统一组件自动展示新数据，不另复制新城市独立JSX首页。

## 2. 官方来源选摘与来源层级

- 宁波奉化2026年租补（有效至2026-11-30）：https://qf.ningbo.gov.cn/qykj/easy-public/2747
- 温州人才住房分类政策：https://wzast.wenzhou.gov.cn/art/2024/6/27/art_1229798508_58920300.html
- 嘉兴配售型住房管理暂行办法，嘉政办发〔2025〕22号：https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web2778/site/attach/0/64e16f1a173b4461810ec1cc9e0dbb64.pdf
- 湖州青年入乡发展促进条例：https://renda.huzhou.gov.cn/lzgk/lfgj/20260403/i4145302.html
- 绍兴人才发展促进条例：https://sxrd.sx.gov.cn/art/2024/4/8/art_1488387_58881663.html
- 金华市政府公报2023年历史实施细则：https://www.jinhua.gov.cn/module/download/downfile.jsp?classid=0&filename=affcce0dbb74492cb88f0c535cf195f1.pdf
- 衢州衢发改发〔2021〕27号“十四五”规划：https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web2771/site/attach/0/08924256c2b040d583a51c5aa87f5598.pdf
- 舟山2026发展政策公报网站报道：https://zsstb.zhoushan.gov.cn/col/col1228973558/art/2026/art_bcd3bd2796184137821243d40af6dbd3.html
- 浙江台州2026青年人才意见原文地址：https://www.zjtz.gov.cn/col/col1229564401/art/2026/art_b9fe9e081f6147a6ab8487604d1f7480.html
- 丽水经开区2025年专项：https://www.lishui.gov.cn/module/download/downfile.jsp?classid=0&filename=59a2ee21f2794b37a15f7c28d90de08d.pdf

部分PDF原文在自动网络访问中超时，虽能检索部分文稿文本，**2026最新生效细则、实际受理窗口、租价与项目仍待逐条复核**。政府网站刊载的新闻通稿仅可证明报道提到的制度事实，不得当作主管部门公开申请表。

## 3. 页面与搜索系统

- `/talent-service/cities/浙江`：原有全国城市目录的浙江筛选；
- `/talent-service/city/杭州` ... `/talent-service/city/丽水`：11市统一城市详情；
- `/talent-service/list/policies/城市名`：统一V5.1政策分类，含历史独立归档；
- `/talent-service/list/housing/城市名`：独立住房制度、项目和历史资料；
- `/talent-service/search/城市名/关键词`：共用城市政策与住房查询；
- `/talent-service/policy/<id>`、`/talent-service/housing/<id>`：通用详情。

全部保留旧网站首页、企业招聘、留学模块及已有城市数据，**不会创建独立城市首页组件**。政策的A/B/C/D按 `talentQuality.ts` 现有规则评定，未独立认证的资料不升级为A级，浙江11市均**不属于整城验收通过**。

## 4. 已明确的不足与下次升级优先级

1. 嘉兴2026人才补贴9月3日—10月16日历史窗口尚需找到可独立访问的政府原始公告，当前不能冒充仍在开放。
2. 衢州现有官方可访问证据主要是2021规划：须找到2026高层次人才津贴市级原件与真实2026项目配租文件，不能以规划充当最新补贴。
3. 杭州、温州、绍兴、金华、湖州、舟山、丽水：要逐项补全2026实际受理深链、项目地址/租价/房号、最新人才分类和互斥细则。
4. 台州2026修订意见与2023旧房票细则不同，已按2026新规入库，仍须查对原文链接可访问性和实际县区办理差异。
5. 所有B/C级资料须单独建立经官方证据验证的六区块交互指南后才有资格申请A级认证；**严禁自动批量“升级A”。**

## 5. 自动检查与部署

`node --experimental-strip-types scripts/test-zhejiang-11city-v51.mjs`、`test-talent-city-contract-v51.mjs`、`test-talent-cities.mjs`、`global-talent-nav.contract.test.mjs` 和 `npm run build` 交由独立GitHub Actions分支运行，成功时上传一个完整的静态网站工件。工件**不是已公开部署的GitHub Pages地址**。任何失败都要据实处理。没有合并到main，也没有部署到阿里云正式站。
