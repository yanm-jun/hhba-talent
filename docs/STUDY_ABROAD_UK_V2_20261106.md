# HHBA 英国海外发展 · 2026 官方方案 V2 深度升级与验收记录

> 资料核验基准：2026-11-06。以英国政府 GOV.UK / UKVI 官方法律规则为优先；政策、收费与雇主许可证均可能调整。HHBA 不是移民代理，不承诺任何签证结果。
>
> 开发基础：`yanm-jun/hhba-talent` GitHub `main` 的 **已有英国 V1（8 条）**。本次是原英国模块升级为 **15 条**，不是创建新的国家入口。GitLab 备份有同步延迟，不能用来判断 GitHub 主线开发程度。

## 一、15 条独立签证与资格路线

| ID | 英国路径 | 分组 | 真正的先决条件或限制 |
|---|---|---|---|
| uk-skilled | Skilled Worker | 海外工作 | 合法 UKVI 担保雇主、CoS、SOC、工资及英语 |
| uk-health | Health and Care Worker | 海外工作 | 医疗执照/职业、合格雇主、工种资格；护理员从海外新担保已关闭 |
| uk-student | Student | 留学 | 英国持牌大学与 CAS、学费和最多9个月生活资金 |
| uk-graduate | Graduate | 海外工作 | 合格英国课程、持有效 Student 签证并在英国境内申请 |
| uk-global-talent | Global Talent | 海外工作 | 合格科研/艺术/数字科技成果及背书或符合标准的获奖 |
| uk-hpi | High Potential Individual | 海外工作 | 毕业年度合格高校、5年内取得学位、Ecctis、年度名额 |
| uk-scale | Scale-up Worker | 海外工作 | 合格快速增长企业专门担保、至少6个月真实工作及工资 |
| uk-innovator | Innovator Founder | 长期居留 | 创新、可行、可扩张的真实商业项目及合规背书 |
| uk-seasonal | Seasonal Worker | 工作与旅行 | 合法scheme operator、CoS、园艺/家禽临时限定岗位 |
| uk-creative-worker | Creative Worker | 工作与旅行 | 合规演艺/影视/舞蹈等实际项目，通常有雇主CoS |
| uk-gov-exchange | Government Authorised Exchange | 工作与旅行 | 英国政府批准的交流/研究/实习项目与担保 |
| uk-senior-specialist | Senior or Specialist Worker | 海外工作 | 跨国集团内部调派、英国关联分支与GBM担保 |
| uk-family-partner | Family visa – partner or spouse | 长期居留 | 真实伴侣关系、担保人身份、收入及英语 |
| uk-youth-mobility | Youth Mobility Scheme | 工作与旅行 | 中国大陆普通护照2026不符合直接申请国籍名单，明确限制 |
| uk-global-business-graduate-trainee | GBM Graduate Trainee | 海外工作 | 跨国集团培养计划、此前3个月海外任职、GBM担保 |

## 二、2026 年易产生误导的高风险规则

1. **Skilled Worker：**一般薪资门槛为每年 £41,700 与对应职业 SOC going rate 取更高值；某些符合条件的新入行者、科研和行业类别、历史申请享有不同的法律例外，不能简单统一折扣。
2. **英语：**2026-01-08 起部分首次 Skilled Worker / Scale-up 等新申请要求 CEFR B2；历史签证续签有过渡规定，不能写成所有人的唯一标准。
3. **健康护理员：**care worker 和 senior care worker 从 2025-07-22 起新的海外申请渠道关闭，不能向中国境内求职者出售所谓养老护理直接赴英担保签证。医生、护士等其他合格医疗职业另查。
4. **Graduate：**非博士毕业生在 2026-12-31 或之前递交通常2年，2027-01-01 起申请通常18个月；博士仍通常3年。具体以申请日期和官方页面为准。
5. **Student：**2026年度伦敦每月 £1,529、非伦敦每月 £1,171，通常最多按9个月计算资金证明（除此还需CAS对应学费）。符合条件的配偶/子女随行受到更严限制。
6. **HPI：**必须按学位**授予年度**查 Global Universities List，而不是直接拿当前世界排名或2026年度名单追溯任意年份；还有毕业5年窗口、Ecctis和年度限额。
7. **Scale-up：**不能将“高成长公司”简单当成持有Scale-up sponsor licence。需要相应真实担保、工资和最初6个月履职。
8. **GBM Graduate Trainee：**与英国大学毕业生的Graduate工作签证完全不同；有跨国集团内部培训资格、境外任职记录、UK企业对应赞助。
9. **Creative Worker：**要有实际节目或项目及合资格赞助；普通中国大陆护照不能不加区分地套用入境免签国籍的短期创意签证concession。
10. **Youth Mobility：**2026官方名单**不含中国大陆普通护照**；香港地区护照和其他资格单独判断，页面不展示虚假的大陆直接申请入口。
11. **sponsor licence：**UKVI注册持牌雇主名单不等于真实实时招聘名额，也不等于该雇主愿意为某位申请人签发CoS。职业编码与实际职责需核对，禁止购买假offer。

## 三、每条方案的内容结构

全部15条路线使用现有共享 `OverseasDetailedGuide` 阅读组件，保持与另外五国一致：
1. 方案是什么与适用人群；
2. 资格 / SOC / 英语 / 资金；
3. 实际申请资料及取得方式；
4. 正规从零申请步骤；
5. 费用、IHS、生活资金及运营成本；
6. 时限、窗口、特殊过渡；
7. 获批后的工作、家属、公共福利及限制；
8. 续签、转签、定居与风险退出。

每章至少3个可执行说明节点（**是什么／为什么／应该做什么**），并提供不少于4条FAQ、至少3条 GOV.UK 官方来源、诈骗警示与英国移民术语说明。**内容详细不等于保证个人资格审核**。

## 四、代码与兼容策略

- 新完整源：`apps/web/src/data/overseasUK.ts` 和 `overseasUKGuides.ts`。
- 既有国家入口：`/study-abroad/country/united-kingdom`；历史详情：`/study-abroad/united-kingdom/pathway/{id}`。保持原始 V1 八个 ID 不变，新增七个 ID。
- 统一展示：`apps/web/src/pages/UKDevelopmentPage.tsx`，搜索、分类筛选、最多三项对比、个人收藏、目标筛选和详细阅读器。
- 原页面导出：`UnitedKingdomDevelopmentPage.tsx` 只重导出新组件，保持 `src/main.tsx` 主路由不变，避免两套英国页面。
- 历史收藏 key 仍是 `hhba.overseas.uk.saved.v1`，对比 key 仍是 `hhba.overseas.uk.compare.v1`。旧八条路线 ID 保持原值。
- 主站使用已经存在的真实 WebP 图片 `public/overseas/countries/uk.webp` 与 CC BY-SA 来源归属。
- 历史资料模块 `overseasUnitedKingdom.ts` 暂保留供回退，不再被英国页面使用；后续审核通过可再清理，不影响此次正式入口唯一性。

## 五、验收与发布

- 运行 UK V2 合约：`cd apps/web && node --test scripts/overseas-united-kingdom.contract.test.mjs`，它会调用新的15路线与指南合约。
- 运行前端 TypeScript + Vite build：`cd apps/web && npm ci && npm run build`。
- 核对15个路线深链、图片加载、来源链接、搜索和目标筛选、收藏与比较、2026风险警告。
- 合并前走 Pull Request 审核；**禁止直接自动合并 main 或部署 hhba.work**。只有审核通过才能继续正式网站更新。
- 本次没有编造英国企业实际在招岗位；外链只指向政府官站，持牌名册仅说明许可。
