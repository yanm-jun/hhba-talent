# HHBA V2 企业端第1—65号完整性审计

> 审计时间：2026-10-31；代码基线：feature/employers-063-065-v2；执行：GitHub Actions #41200547610。**静态代码、媒体资源与数据检查，不等于线上点击逐页验收或最新岗位可投递核查。**

## 总结

- 原始截图样本：156 家；现有 V2 企业档案：52 份（含插队企业 #157）。
- #1—65中缺少独立V2档案：14 家，其中10家已有专门旧版页面，仅4家使用通用回退页面。
- 本地媒体槽位：153，缺失或过小：23 个。
- 岗位资料/档案P1缺陷：52项；证据、预览与图片P2事项：101项。**缺陷项数不等于受影响的企业数。**
- 后续未进入第1—65号本轮开发的截图企业：91 家，不计为历史缺陷。

## P1 缺V2完整档案（4家）

- cn-autumn-036 南芯科技：目前仅原有通用回退页面，尚无四板块完整企业资料。
- cn-autumn-051 金中新材：目前仅原有通用回退页面，尚无四板块完整企业资料。
- cn-autumn-052 宏川集团：目前仅原有通用回退页面，尚无四板块完整企业资料。
- cn-autumn-053 兰石集团：目前仅原有通用回退页面，尚无四板块完整企业资料。

## P1 岗位数据缺字段（24家）

说明：现有旧批次岗位仍可能展示，但存在缺少`category`或`majorNames`等字段。尤其是在统一专业筛选界面中，这可能造成方向分组遗漏、岗位数量不准确或匹配能力不足。需要逐条映射后复测，不能仅靠页面能打开来判断已完成。

- cn-autumn-012 远景科技集团 INCOMPLETE_JOB_FIELDS 6 jobs; missing fields: category; examples: it-delivery-2027, composite-structural-2027, windfarm-integration-2027
- cn-autumn-013 蜂巢能源 INCOMPLETE_JOB_FIELDS 7 jobs; missing fields: category, majorNames; examples: research-technical-2027, research-support-2027, intelligent-manufacturing-2027
- cn-autumn-014 中国能建国际集团 INCOMPLETE_JOB_FIELDS 5 jobs; missing fields: category; examples: technical-management-2027, commercial-contract-2027, legal-affairs-2027
- cn-autumn-015 中国煤炭科工 INCOMPLETE_JOB_FIELDS 8 jobs; missing fields: category; examples: mechanical-engineer, electrical-engineer, hydraulic-engineer
- cn-autumn-016 中国通服广西公司 INCOMPLETE_JOB_FIELDS 12 jobs; missing fields: category; examples: planning-consulting-2027, ai-bigdata-rd-2027, ai-agent-application-2027
- cn-autumn-017 太极股份 INCOMPLETE_JOB_FIELDS 10 jobs; missing fields: category; examples: project-lanzhou-2027, project-taiyuan-2027, project-xian-2027
- cn-autumn-018 新奥集团 INCOMPLETE_JOB_FIELDS 15 jobs; missing fields: category; examples: computing-software, infomanagement-math, electronics-automation
- cn-autumn-019 湖南省广播影视集团（湖南广电） INCOMPLETE_JOB_FIELDS 3 jobs; missing fields: category; examples: 2026-qingmang-film-media-historical, 2026-qingmang-editorial-media-historical, 2026-qingmang-computing-historical
- cn-autumn-020 紫金集团 INCOMPLETE_JOB_FIELDS 6 jobs; missing fields: category; examples: mining-geology, electrical-automation, digital-and-ai
- cn-autumn-021 青蛙王子 INCOMPLETE_JOB_FIELDS 12 jobs; missing fields: category, majorNames; examples: intl-trade, packaging, product-planning
- cn-autumn-022 万兴科技 INCOMPLETE_JOB_FIELDS 5 jobs; missing fields: category, majorNames; examples: ai-product-manager, ai-app-development, full-stack-development
- cn-autumn-023 紫龙游戏 INCOMPLETE_JOB_FIELDS 12 jobs; missing fields: category, majorNames; examples: system-design, combat-ai-native, narrative
- cn-autumn-024 菲婷丝 INCOMPLETE_JOB_FIELDS 2 jobs; missing fields: category; examples: quality-assurance-trainee-2027, marketing-trainee-2027
- cn-autumn-025 青岛银行 INCOMPLETE_JOB_FIELDS 7 jobs; missing fields: category, majorNames; examples: branch-customer-manager, branch-operation-support, branch-hall-service
- cn-autumn-026 南方传媒 INCOMPLETE_JOB_FIELDS 6 jobs; missing fields: category, majorNames; examples: editorial-content, marketing-operations, tech-design
- cn-autumn-027 广之旅 INCOMPLETE_JOB_FIELDS 8 jobs; missing fields: category, majorNames; examples: international-travel-presenter, management-trainee, tour-leader-trainee
- cn-autumn-028 中建路桥 INCOMPLETE_JOB_FIELDS 12 jobs; missing fields: category, majorNames; examples: road-technical-management, cost-contract, surveying
- cn-autumn-029 中电建电力投资集团 INCOMPLETE_JOB_FIELDS 8 jobs; missing fields: category, majorNames; examples: thermal-electrical, thermal-energy, thermal-chemistry
- cn-autumn-030 江苏省国信集团 INCOMPLETE_JOB_FIELDS 4 jobs; missing fields: category, majorNames; examples: trainee-power, trainee-finance, trainee-ai
- cn-autumn-031 奇正 INCOMPLETE_JOB_FIELDS 9 jobs; missing fields: category, majorNames; examples: qizheng-role-01, qizheng-role-02, qizheng-role-03
- cn-autumn-032 微谱 INCOMPLETE_JOB_FIELDS 10 jobs; missing fields: category, majorNames; examples: j11547-aibp, j11545-sales, j11530-vehicle
- cn-autumn-033 邦德激光 INCOMPLETE_JOB_FIELDS 16 jobs; missing fields: majorNames; examples: mechanical-rd, electric-rd, software-rd
- cn-autumn-034 鹏芯微 INCOMPLETE_JOB_FIELDS 11 jobs; missing fields: majorNames; examples: process-rd, process-integration-rd, analysis-technology
- cn-autumn-035 佑驾创新 INCOMPLETE_JOB_FIELDS 14 jobs; missing fields: majorNames; examples: MJ000950, MJ000947, MJ000945

## P1 缺图片资源（9家，共23个文件）

- **cn-autumn-027 广之旅**：3个文件缺失（logo.png、photo1.jpg、photo2.jpg）。
- **cn-autumn-028 中建路桥**：3个文件缺失（logo.png、photo1.jpg、photo2.jpg）。
- **cn-autumn-029 中电建电力投资集团**：2个文件缺失（photo1.jpg、photo2.jpg）。
- **cn-autumn-030 江苏省国信集团**：2个文件缺失（photo1.jpg、photo2.jpg）。
- **cn-autumn-031 奇正**：2个文件缺失（photo1.jpg、photo2.jpg）。
- **cn-autumn-032 微谱**：2个文件缺失（photo1.jpg、photo2.jpg）。
- **cn-autumn-033 邦德激光**：3个文件缺失（logo.webp、photo1.jpg、photo2.jpg）。
- **cn-autumn-034 鹏芯微**：3个文件缺失（logo.webp、photo1.jpg、photo2.jpg）。
- **cn-autumn-035 佑驾创新**：3个文件缺失（logo.webp、photo1.jpg、photo2.jpg）。

## P1 空岗位资料（1家）

- cn-autumn-011 万科泊寓：`jobs`为空。需确认是否属于不招聘企业/纯商业档案，再决定展示岗位资料或显式“暂无可核实岗位”；不应虚构职位。

## P2 旧版独立页面（10家）

- cn-autumn-001 毕马威
- cn-autumn-002 施耐德电气
- cn-autumn-003 辉瑞
- cn-autumn-004 中国南方航空
- cn-autumn-005 顺丰
- cn-autumn-006 网易游戏
- cn-autumn-007 鹰角网络
- cn-autumn-008 安克创新
- cn-autumn-009 徕芬科技
- cn-autumn-010 新鸿基地产

## P2 招聘入口/来源未确认（9家）

- cn-autumn-049 红谱科技
- cn-autumn-050 汇蓉国科
- cn-autumn-054 海程邦达
- cn-autumn-055 长隆科技
- cn-autumn-056 维音
- cn-autumn-062 厦门国资运
- cn-autumn-063 桑椹汽配
- cn-autumn-064 新海威
- cn-autumn-065 双视科技

## P2 图片来源审计缺失（28家）

- cn-autumn-011 万科泊寓
- cn-autumn-012 远景科技集团
- cn-autumn-013 蜂巢能源
- cn-autumn-014 中国能建国际集团
- cn-autumn-015 中国煤炭科工
- cn-autumn-016 中国通服广西公司
- cn-autumn-017 太极股份
- cn-autumn-018 新奥集团
- cn-autumn-019 湖南省广播影视集团（湖南广电）
- cn-autumn-020 紫金集团
- cn-autumn-021 青蛙王子
- cn-autumn-022 万兴科技
- cn-autumn-023 紫龙游戏
- cn-autumn-024 菲婷丝
- cn-autumn-025 青岛银行
- cn-autumn-026 南方传媒
- cn-autumn-027 广之旅
- cn-autumn-028 中建路桥
- cn-autumn-029 中电建电力投资集团
- cn-autumn-030 江苏省国信集团
- cn-autumn-031 奇正
- cn-autumn-032 微谱
- cn-autumn-033 邦德激光
- cn-autumn-034 鹏芯微
- cn-autumn-035 佑驾创新
- cn-autumn-057 line plus
- cn-autumn-058 招商金科
- cn-autumn-059 中盈优创

## P2 仅非官方编辑性素材（审计明确识别6家）

- cn-autumn-060 云尖信息
- cn-autumn-061 美迈科技
- cn-autumn-062 厦门国资运
- cn-autumn-063 桑椹汽配
- cn-autumn-064 新海威
- cn-autumn-065 双视科技

说明：第57—59家也含独立SVG编辑图片，但是由于尚无对应媒体溯源JSON，当前列入“媒体来源审计缺失”而非重复计数为“已认定官方实景”。所有SVG必须独立核实，不得误称真实公司图片。

## P2 截图清单元信息未更新（48家）

多家已完成资料仍保留`reviewStatus:not_checked`的历史截图字段。截图文件作为原始证据不应直接篡改，建议新建独立审校状态表，避免把旧截图状态展示为当前开发状态。

- cn-autumn-011 万科泊寓
- cn-autumn-012 远景科技集团
- cn-autumn-013 蜂巢能源
- cn-autumn-014 中国能建国际集团
- cn-autumn-015 中国煤炭科工
- cn-autumn-016 中国通服广西公司
- cn-autumn-017 太极股份
- cn-autumn-018 新奥集团
- cn-autumn-019 湖南省广播影视集团（湖南广电）
- cn-autumn-020 紫金集团
- cn-autumn-021 青蛙王子
- cn-autumn-023 紫龙游戏
- cn-autumn-024 菲婷丝
- cn-autumn-026 南方传媒
- cn-autumn-027 广之旅
- cn-autumn-028 中建路桥
- cn-autumn-029 中电建电力投资集团
- cn-autumn-031 奇正
- cn-autumn-032 微谱
- cn-autumn-033 邦德激光
- cn-autumn-034 鹏芯微
- cn-autumn-035 佑驾创新
- cn-autumn-037 炬芯科技
- cn-autumn-038 博创科技
- cn-autumn-039 安世中国
- cn-autumn-040 黑格科技
- cn-autumn-041 晶云
- cn-autumn-042 艾普工华
- cn-autumn-043 迦智科技
- cn-autumn-044 博顿光电
- cn-autumn-045 元夫半导体
- cn-autumn-046 芯德科技
- cn-autumn-047 瀚通通讯
- cn-autumn-048 元力股份
- cn-autumn-049 红谱科技
- cn-autumn-050 汇蓉国科
- cn-autumn-054 海程邦达
- cn-autumn-055 长隆科技
- cn-autumn-056 维音
- cn-autumn-057 line plus
- cn-autumn-058 招商金科
- cn-autumn-059 中盈优创
- cn-autumn-060 云尖信息
- cn-autumn-061 美迈科技
- cn-autumn-062 厦门国资运
- cn-autumn-063 桑椹汽配
- cn-autumn-064 新海威
- cn-autumn-065 双视科技

## 企业招人端（Employer dashboard）的功能状态

静态站的`EmployerGrowthHubPage.tsx`、`EmployerWorkspacePage.tsx`、`EmployerPublicJobsPage.tsx`明确说明：企业入驻、真实资料认证、岗位保存/发布和人才检索依赖独立API。`services/api.ts`通过`employerApiReady`及多个环境开关控制。不能把“静态可点击预览”解释为真实业务已上线。此项为实现边界，不是企业档案缺数据。

## 整改优先级建议

1. 先补齐#036、#051—053四家独立V2企业档案并验证招聘市场接入。
2. 修复#027—035的23个缺失图像文件，确保真实来源或明确标示编辑图，同时保证不破坏现有站点。
3. 修复#012—035中24家岗位的category/majorNames字段，按职位真实方向匹配，而不是统一灌入全部专业。
4. 针对#011没有岗位和#001—010的旧版模板，明确是否需要转成同一V2标准。
5. 复核9家待核验招聘入口，补28家来源审计；制作独立审校状态表解决截图信息过期。
6. 招人端真实API接入、认证及业务动作单列为后端项目，需独立测试环境及用户验收，不能直接上正式站。

## 审计可复现性

- 扫描脚本：`apps/web/scripts/employer-completeness-audit.mjs`
- 本批合同测试：`apps/web/scripts/employers-063-065-v2.contract.test.mjs`
- [GitHub Actions全站构建与可下载MD/JSON审计Artifact](https://github.com/yanm-jun/hhba-talent/actions/runs/41200547610)
- 通过的构建仅证明代码/静态数据检查，**未证明**真实素材采集已完成、全部招聘入口可投递或GitHub Pages正式线上可用。
