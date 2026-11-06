/* HHBA 美国发展方案 B：跨国工作、杰出人才、农业/非农季节工及EB移民。资料基准2026-11-06。 */
import type {UsPathway} from './overseasUnitedStatesTypes';
export const usRoutesB:UsPathway[]=[
  {
    "id": "us-l1",
    "name": "跨国企业内部调动签证（L-1）",
    "english": "L-1A / L-1B Intracompany Transferee",
    "category": "work",
    "summary": "美国境内外具有合格关联关系的真实公司，可为符合工作经历要求的经理高管（L-1A）或拥有专门知识的员工（L-1B）申请内部调动；不能只靠注册空壳海外公司取得。",
    "audience": "已在合格跨国企业境外机构工作、获计划调任美国关联公司的管理人员或关键专业员工。",
    "requirements": [
      "美国公司与境外公司须存在USCIS认可的母子公司、附属公司或分支等合格关系，业务需要真实运营。",
      "多数候选人须在申请前规定的连续三年内，有至少一年在美国境外合格关联企业连续就业；以官方具体计算规则为准。",
      "L-1A要求美国岗位确实属于高管或管理职责；L-1B要求拥有符合定义的公司专门知识及对应岗位。",
      "申请通常由美方合格实体递交I-129；新建美国办公室还需满足场所、发展能力等特别规则。"
    ],
    "documents": [
      "境内外企业股权、组织架构、控制关系及实体运营证据",
      "境外连续就业记录、工资税务及岗位职责证据",
      "赴美岗位、汇报线、管理职责或专门知识材料",
      "美国企业I-129申请文件、办公场地与业务计划（如新办公室）"
    ],
    "steps": [
      "与公司法务核实母子/关联实体的所有权及经营关系。",
      "核对最近三年中的境外连续一年就业和美国拟任岗位职责。",
      "由美国关联实体准备实际岗位、组织结构、薪资以及I-129证据。",
      "取得批准与适用签证后办理派遣及美国入境手续；持续保持真实关联公司就业。"
    ],
    "fees": [
      "需按USCIS雇主I-129申请和国务院L类签证收费标准分类计算。",
      "加急、法律服务、跨国搬迁、家属、医疗及住宿成本另列。"
    ],
    "rights": [
      "在符合批准条件的美国关联公司工作，L-1A与L-1B在工作性质和可延期时长方面不同。",
      "部分符合规定的家属可申请L-2，配偶工作许可规则依实际身份和I-94类别核对。"
    ],
    "risks": [
      "短时间虚构境外工作经历不能绕过连续就业要求。",
      "L-1A获批并不自动达到EB-1C跨国经理移民标准，后者有独立证据审查。"
    ],
    "timing": [
      "先按境外就业月份和公司关联结构排期，复杂企业文件准备往往占时。",
      "L-1A与L-1B可停留总期限不同，提前评估延长与长期规划。"
    ],
    "future": [
      "对符合条件的真实跨国经理，可另外评估EB-1C，但不是L-1自动转绿卡。",
      "遇到雇主更换或岗位大幅调整时应咨询公司法务并核对身份影响。"
    ],
    "faq": [
      {
        "question": "没有美国公司，先注册一家再转L-1可以吗？",
        "answer": "不能只凭注册行为。需要合格的关联企业、真实境外就业及符合新办公室或现有业务的完整条件。"
      },
      {
        "question": "L-1就是绿卡吗？",
        "answer": "不是，L-1属于非移民临时工作身份，永久居留需独立申请。"
      }
    ],
    "highlights": [
      "跨国关联企业",
      "境外连续就业",
      "L-1A/L-1B区分"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/temporary-workers/l-1a-intracompany-transferee-executive-or-manager",
    "sources": [
      {
        "label": "USCIS L-1A",
        "url": "https://www.uscis.gov/working-in-the-united-states/temporary-workers/l-1a-intracompany-transferee-executive-or-manager",
        "purpose": "跨国管理岗位与关联关系"
      },
      {
        "label": "USCIS L-1B",
        "url": "https://www.uscis.gov/working-in-the-united-states/temporary-workers/l-1b-intracompany-transferee-specialized-knowledge",
        "purpose": "专门知识雇员要求"
      }
    ]
  },
  {
    "id": "us-o1",
    "name": "杰出人才临时工作签证（O-1）",
    "english": "O-1 Extraordinary Ability / Achievement",
    "category": "work",
    "summary": "适合在科学、教育、商业、体育、艺术及影视领域有持续可验证杰出成绩的人员，通常由合格美国雇主或代理人申请；O-1是临时工作身份，不等于EB-1A绿卡。",
    "audience": "具备行业重大成果、获奖、权威评审、重大媒体报道或突出专业贡献等高质量证据的创作者、科研人员与专业人才。",
    "requirements": [
      "O-1A适用于科学、教育、商业及体育领域，O-1B适用于艺术或影视相关杰出成就，证据要求各不相同。",
      "申请人须在美国继续从事本人获得杰出认可的领域工作，通常应由合资格美国雇主或代理人提出I-129申请。",
      "需结合大奖、发表/报道、评审、独创贡献、关键职位、薪酬或同等证据等具体标准形成证据链；不能单凭自我描述或一般奖项证明。"
    ],
    "documents": [
      "美国真实雇主/代理协议、合同、工作行程及项目证明",
      "奖项、同行评价、新闻报道、论文或其他可核验成果文件",
      "领域专家意见、相关咨询意见或适用豁免材料",
      "护照、I-129支持文件与适用签证申请资料"
    ],
    "steps": [
      "先确认更接近O-1A还是O-1B及适用法规的具体证据标准。",
      "把每项成果与法定证据要求逐一对应，剔除无法独立核实的材料。",
      "取得真实美国项目与合格申请主体支持，由申请人/律师整理专家咨询意见与I-129。",
      "获准后只在所获准的项目、雇主及授权范围内活动，留意项目变更手续。"
    ],
    "fees": [
      "由申请主体按USCIS I-129、可能的加急和领事签证费率计算。",
      "专家推荐、材料翻译及法律服务可能有费用，但不应购买虚假奖项或报道。"
    ],
    "rights": [
      "可在批准的O-1项目或相应雇佣活动范围内工作。",
      "O-1通常可考虑续签或其他合法转换，但不自动带来绿卡或开放式就业许可。"
    ],
    "risks": [
      "网络包装、付费媒体通稿、伪造大赛奖项不能取代严肃的独立证据。",
      "O-1A与EB-1A标准不相同，O-1获批不能作为EB-1A必然通过证明。"
    ],
    "timing": [
      "由雇主/代理人提前规划I-129和项目起始日期，必要时核对咨询意见出具周期。",
      "获批准证的最长期限及延期规则须按实际活动及USCIS通知确认。"
    ],
    "future": [
      "持续发展可研究EB-1A或EB-2 NIW，但两者属于独立移民申请。",
      "若需要多雇主或项目工作，应事先安排合法的代理或多雇主申请结构。"
    ],
    "faq": [
      {
        "question": "艺术/设计专业能申请O-1吗？",
        "answer": "可以研究O-1B，但要用真实艺术领域杰出成绩与美国项目证明，而不是仅凭学位。"
      },
      {
        "question": "没有美国老板也能自己交O-1吗？",
        "answer": "通常必须有合格的美国申请主体或代理人，不能简单由个人以自己名义直接申请O-1。"
      }
    ],
    "highlights": [
      "艺术/科研/商业",
      "需可核验证据",
      "O-1≠EB-1A"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement",
    "sources": [
      {
        "label": "USCIS O-1",
        "url": "https://www.uscis.gov/working-in-the-united-states/temporary-workers/o-1-visa-individuals-with-extraordinary-ability-or-achievement",
        "purpose": "两类O-1的条件、证据及申请主体"
      },
      {
        "label": "国务院临时工作签证",
        "url": "https://travel.state.gov/content/travel/en/us-visas/employment.html",
        "purpose": "领馆签证程序与身份区别"
      }
    ]
  },
  {
    "id": "us-h2a",
    "name": "季节性农业工作（H-2A）",
    "english": "H-2A Temporary Agricultural Workers",
    "category": "work",
    "summary": "美国雇主有真实的临时或季节性农业用工需求且完成适用劳动市场程序后，才可能为符合规定的外国工人申请；它不提供永久居留或统一年度岗位保证。",
    "audience": "愿意从事季节性农业工作、获得合法美国农业雇主招聘且具备适用入境和工作条件的人。",
    "requirements": [
      "必须存在真实且符合规定的美国农业临时/季节性工作需求，由美国雇主启动劳动和移民手续。",
      "雇主需依据美国劳工部DOL规定进行招聘、工资与住房交通等适用条件审查。",
      "外国申请人资格、有效身份证件及国家适用性和领事程序必须按USCIS与国务院当期规则核实。"
    ],
    "documents": [
      "经过核实的雇主主体、岗位地址、合同与招聘信息",
      "雇主的H-2A临时劳工认证与USCIS申请相关证明",
      "护照、签证申请文件与岗位具体上岗日期证据"
    ],
    "steps": [
      "到DOL及USCIS官方渠道核查真实招聘项目与雇主身份。",
      "确认工资、工时、住宿、交通、工资扣除、工作期限等合同实质条款。",
      "由雇主依法完成劳工认证与I-129，再进入申请人适用的领事签证阶段。",
      "获准后仅按合法合同与批准条件工作，保留支付凭证。"
    ],
    "fees": [
      "签证与雇主申请阶段费用依法有不同承担主体，必须核查劳工保护及招聘费用限制。",
      "不得通过私人微信付款购买所谓农业签证名额。"
    ],
    "rights": [
      "在H-2A批准的时限、雇主和农业岗位合法工作。",
      "符合规定时享有适用的工资、就业合同、住房和其他劳动保护权利。"
    ],
    "risks": [
      "H-2A不是美国移民/绿卡捷径，不保证可在美国长期留居。",
      "应警惕非法扣押护照、工资回流、虚假农场和中介收费欺诈。"
    ],
    "timing": [
      "农作物季节与雇主劳工认证时点决定真实招聘进度；不要把往年公告当今年在招。",
      "每次签证与合同工期由获批准的项目决定。"
    ],
    "future": [
      "合同结束按身份规定离境或完成依法允许的其他手续。",
      "欲转长期雇主或移民类别需重新满足独立资格。"
    ],
    "faq": [
      {
        "question": "H-2A能直接由个人网申买吗？",
        "answer": "不能。核心是美国真实雇主完成官方劳工认证和移民申请。"
      },
      {
        "question": "农业工作算不算自动拿绿卡？",
        "answer": "不算，H-2A是临时非移民工作类别。"
      }
    ],
    "highlights": [
      "真实农场雇主",
      "临时农业工作",
      "劳动保护与防骗"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-2a-temporary-agricultural-workers",
    "sources": [
      {
        "label": "USCIS H-2A",
        "url": "https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-2a-temporary-agricultural-workers",
        "purpose": "雇主责任和申请要求"
      },
      {
        "label": "美国国务院临时工作类别",
        "url": "https://travel.state.gov/content/travel/en/us-visas/employment.html",
        "purpose": "签证及领事程序"
      }
    ]
  },
  {
    "id": "us-h2b",
    "name": "临时非农业工作（H-2B）",
    "english": "H-2B Temporary Non-Agricultural Workers",
    "category": "work",
    "summary": "适用于美国真实雇主季节性、繁忙高峰、间歇性或一次性临时非农业需求，通常受年度名额、劳工认证及招聘条件影响；并非普通永久岗位的自由工作签证。",
    "audience": "获得美国合法雇主明确季节性服务、酒店、景区或其他非农业临时岗位邀请的人。",
    "requirements": [
      "雇主必须证明真实临时用工需求，满足DOL临时劳工认证要求与USCIS适用的申请标准。",
      "H-2B通常有年度配额和分期安排；补充名额、类别及国籍可受临时规则调整。",
      "岗位不能冒充长期固定工作，雇主及工作地点、工资和工作期必须真实对应申请材料。"
    ],
    "documents": [
      "真实雇主、合同、工作地点、工资与期限证据",
      "DOL批准的临时劳工认证及雇主USCIS申请证明",
      "护照与领事要求的签证申请资料"
    ],
    "steps": [
      "核验用工企业、真实职位及职业时长，分清H-2B与H-2A农业类别。",
      "查阅DOL临时劳工认证、当地工资及雇主法定义务。",
      "雇主提交USCIS申请并依据当期名额、项目类别完成审批。",
      "申请人取得合法工作身份及入境许可后，只在允许的岗位与时限内工作。"
    ],
    "fees": [
      "费用依雇主申请及签证阶段分开核算，雇主法定义务不能违规转嫁。",
      "警惕所谓无限制雇主工作许可的个人收费服务。"
    ],
    "rights": [
      "获准后可在合法期限内为批准雇主进行指定临时非农业工作。",
      "工作期结束通常需要离境或符合另外的合法身份安排。"
    ],
    "risks": [
      "名额不足或雇主缺乏临时用工证据都可能导致申请不成功。",
      "不应把签证申请当成可出售的绿卡或非限制性美国工作许可。"
    ],
    "timing": [
      "H-2B名额以USCIS当期公告为准，有些岗位早于传统求职季启动。",
      "雇主申请与领馆办理需在合同开始时间之前完成。"
    ],
    "future": [
      "希望再次合法工作需视当期岗位、配额、停留上限与再次申请规则而定。",
      "职业移民仍需另行完整资格和排期管理。"
    ],
    "faq": [
      {
        "question": "中国籍可否直接抢H-2B名额？",
        "answer": "不能简单抢个人名额。实际受美国雇主招聘、劳工认证、USCIS配额与当期国籍政策等多因素约束。"
      },
      {
        "question": "酒店工作是不是直接可做永久职位？",
        "answer": "H-2B要求临时用工需求，普通永久职位不能直接套用。"
      }
    ],
    "highlights": [
      "临时岗位",
      "年度配额",
      "雇主主导申请"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-2b-temporary-non-agricultural-workers",
    "sources": [
      {
        "label": "USCIS H-2B",
        "url": "https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-2b-temporary-non-agricultural-workers",
        "purpose": "临时非农工作与雇主资格"
      },
      {
        "label": "美国国务院临时工作签证",
        "url": "https://travel.state.gov/content/travel/en/us-visas/employment.html",
        "purpose": "工作签证申请条件"
      }
    ]
  },
  {
    "id": "us-eb1a",
    "name": "职业移民第一优先：杰出人才",
    "english": "EB-1A Extraordinary Ability (Immigrant)",
    "category": "residence",
    "summary": "美国就业移民第一优先中的杰出人才类别，极高标准认可持续的国内或国际专业成就；可由本人自行提交I-140，但申请获批后仍需要排期及后续移民签证或身份调整。",
    "audience": "在科学、艺术、教育、商业或体育等领域具有广泛、持续、公认高水平杰出成就的申请人。",
    "requirements": [
      "须证明在相关领域达到非常少数的顶尖水平，依据重大国际奖项或移民法规规定的多项证据及整体优势进行严格审查。",
      "不同于大多数雇主担保类别，EB-1A可以自行申请I-140，通常无须固定工作邀请及PERM劳工证。",
      "申请人需要证明计划继续在美国本人杰出能力领域从事工作，且符合全部入境与适用移民程序条件。",
      "中国大陆出生申请人截至2026年11月签证公告的EB-1 Final Action Date为2023年8月1日，说明排期并非全部当前。"
    ],
    "documents": [
      "重大获奖或实质等同性证据、领域内专业成果",
      "独立媒体采访、专业奖项、评审及出版或关键贡献证明",
      "专家推荐及每项成果真实可核验的原始记录",
      "I-140申请证据及后续NVC、DS-260或I-485所需个人资料"
    ],
    "steps": [
      "根据USCIS法定证据标准整理个人成就矩阵，区分独立认可和普通工作成绩。",
      "逐项建立证据的主张、来源、第三方核验、日期及反向风险。",
      "由本人或合格代表准备I-140，按USCIS现行材料和收费要求提交。",
      "获批后按出生地与当月职业移民Visa Bulletin核对排期，选择在境内调整或境外领事处理。"
    ],
    "fees": [
      "I-140与可能的加急处理、I-485或DS-260领事手续需依最新USCIS和国务院公布费率。",
      "证据整理、专业翻译和咨询费用应明确服务边界，警惕假奖项或包过承诺。"
    ],
    "rights": [
      "移民申请批准只说明该就业移民类别资格部分被认可，不等于已取得永久居民身份。",
      "绿卡身份还需签证配额、可受理日期、背景及相关许可程序完成。"
    ],
    "risks": [
      "仅凑够表面三项证据未必足以在整体证据标准下通过。",
      "把O-1或一般行业职称当成EB-1A自动认证是错误宣传。",
      "中国大陆出生申请人的排期可能变化，不能用别国Current状态推算自己立即获得绿卡。"
    ],
    "timing": [
      "每月核对国务院Visa Bulletin，特别区分Final Action Dates与Dates for Filing。",
      "2026年11月EB-1中国大陆Final Action Date为2023-08-01，此数字只作核验日示例，不保证下个月相同。"
    ],
    "future": [
      "获批移民签证并入境或完成I-485获准后才能取得相应永久居民身份。",
      "同领域工作规划、家属安排和身份维持需独立评估。"
    ],
    "faq": [
      {
        "question": "EB-1A能自己递交吗？",
        "answer": "符合条件者可自行提交I-140，但仍须提供极强的杰出能力证据。"
      },
      {
        "question": "拿到I-140批准就能拿绿卡吗？",
        "answer": "不行，需等待适用排期并完成移民签证或调整身份的最终步骤。"
      }
    ],
    "highlights": [
      "允许自我申请",
      "顶尖证据标准",
      "中国出生有排期"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-first-preference-eb-1",
    "sources": [
      {
        "label": "USCIS EB-1",
        "url": "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-first-preference-eb-1",
        "purpose": "EB-1A资格及自我申请"
      },
      {
        "label": "国务院2026年11月排期",
        "url": "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-november-2026.html",
        "purpose": "中国大陆EB-1 Final Action与递交日期"
      }
    ]
  },
  {
    "id": "us-eb2-niw",
    "name": "职业移民第二优先：国家利益豁免",
    "english": "EB-2 National Interest Waiver (NIW)",
    "category": "residence",
    "summary": "符合EB-2高等学历或特殊能力门槛且拟从事符合美国国家利益标准的事业者，可以申请豁免常规工作邀请及劳工证；NIW并非“拥有硕士学位就能移民”。",
    "audience": "有研究、科技、创业、公共健康、教育或产业领域的重要可证明贡献，拟在美国继续有实际影响力项目的专业人才。",
    "requirements": [
      "先满足EB-2基本门槛：高级学位或适用的学士加至少五年循序渐进专业经验，或法规规定的特殊能力资格。",
      "NIW必须就拟从事事业的实质价值与国家重要性、申请人推进该事业的能力及综合豁免利益提供证据。",
      "NIW可在符合规则时自己申请I-140，并寻求免除工作邀请和PERM；但申请成功绝不直接取得绿卡。",
      "中国大陆出生申请人2026年11月EB-2 Final Action Date为2021年10月1日，排期可能比公众想象长。"
    ],
    "documents": [
      "学位、成绩单及相关教育证据，或特殊能力支持文件",
      "职业成就、研究成果、专利、影响指标、合作函、实际项目业绩",
      "面向美国的具体事业计划、实施路径及独立第三方证据",
      "I-140申请材料及签证排期/后续移民办理所需文件"
    ],
    "steps": [
      "明确本人依靠高级学位还是特殊能力资格符合EB-2门槛。",
      "提出与美国国家利益相关的具体事业而不是空泛宣称“有潜力”。",
      "围绕国家重要性、推进能力、豁免权衡三方面归集高质量直接证据。",
      "提交符合当期USCIS要求的I-140及NIW支持文件。",
      "通过排期公告和具体批准进度判断何时可进行领事签证或境内调整身份。"
    ],
    "fees": [
      "USCIS I-140等官方费用与加急服务选择依现行官方表格核对。",
      "翻译、咨询及专家证明可能有支出，但不能付费购买所谓国家利益认可。"
    ],
    "rights": [
      "获批NIW是移民申请的阶段性成功，不自动授予在美合法工作或居留权。",
      "完成可用签证名额和移民签证或I-485最终获批后，才成为永久居民。"
    ],
    "risks": [
      "拥有普通硕士学历不等于事业具有国家重要性。",
      "论文篇数、引用数量或公司注册并非单一自动合格指标。",
      "若申请人在美，I-140待审或批准通常不独立延长合法非移民身份。"
    ],
    "timing": [
      "把EB-2中国大陆2026年11月Final Action 2021-10-01记为历史核验点，后续以每月公告为准。",
      "评估个人合法身份与移民申请进展，避免签证到期与排期混淆。"
    ],
    "future": [
      "可以与其他适用工作签证安排并行研究，但每条程序独立且存在潜在签证意图问题。",
      "符合条件时后续可为配偶及未婚子女办理相应衍生移民申请，遵守年龄与身份条件。"
    ],
    "faq": [
      {
        "question": "普通硕士可直接走NIW吗？",
        "answer": "硕士可能满足EB-2学历基础，但NIW还须满足独立的国家利益豁免审查，不是硕士自动通过。"
      },
      {
        "question": "NIW通过就能在美国上班吗？",
        "answer": "不能，I-140批准本身不是工作授权。"
      }
    ],
    "highlights": [
      "高级学位非充分条件",
      "可申请豁免雇主",
      "排期明显"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-second-preference-eb-2",
    "sources": [
      {
        "label": "USCIS EB-2与NIW",
        "url": "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-second-preference-eb-2",
        "purpose": "NIW国家利益豁免资格"
      },
      {
        "label": "国务院当月排期",
        "url": "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-november-2026.html",
        "purpose": "核验中国大陆EB-2排期"
      }
    ]
  },
  {
    "id": "us-eb3",
    "name": "职业移民第三优先：雇主担保",
    "english": "EB-3 Skilled Workers, Professionals, and Other Workers",
    "category": "residence",
    "summary": "美国雇主为符合分类的长期就业岗位招募外国员工，通常需先完成劳工认证PERM，再提交I-140；涉及技术工人、专业人士及其他工人等不同子类别。",
    "audience": "获得真实美国雇主长期全职工作邀请且能够满足岗位教育、经验或职业要求的人。",
    "requirements": [
      "必须核对EB-3专业人士、技术工人和其他工人的具体区分，所需学位或工作经验因类别不同。",
      "大多数案件需要美国雇主先完成DOL PERM劳工认证，证明符合劳动力市场与招聘程序的岗位条件。",
      "申请人应与真实岗位匹配且雇主具备工资支付能力；仅凭中介买职位或预付所谓排期费不合格。",
      "中国大陆出生申请人2026年11月EB-3 Final Action Date为2022年1月22日；Other Workers子类别更早，不能混用普通EB-3日期。"
    ],
    "documents": [
      "美国雇主正式工作岗位、岗位职责及工资要求证明",
      "个人学位、职业培训、相关工作年限证明",
      "雇主的PERM批准及I-140相关申请资料",
      "按排期阶段要求准备的护照、出生、公证及其他签证材料"
    ],
    "steps": [
      "通过雇主官网核实真实公司、岗位性质及是否愿意合法做PERM。",
      "雇主按DOL规则进行招聘和劳工认证，岗位要求须与实际工作一致。",
      "取得适用的PERM后由雇主提交I-140及相关资格和付薪能力证据。",
      "按照中国大陆出生类别及当月Visa Bulletin核对申请和签证可用日期。",
      "在名额可用且获批准时完成DS-260领事手续或I-485境内手续。"
    ],
    "fees": [
      "通常涉及PERM招聘、I-140及后续领事或身份调整费用，具体承担主体与法律禁止转嫁的成本必须区分。",
      "不应向中介或雇主支付所谓合法收取的“买美国绿卡工作名额”费用。"
    ],
    "rights": [
      "属于就业移民路径，最终资格获批及完成移民签证后可能取得永久居民身份。",
      "工作邀请与PERM本身不提供入境、在美工作或永久居民权利。"
    ],
    "risks": [
      "PERM申请失败、雇主财务/岗位发生变化都可能影响后续I-140。",
      "很多宣称无技能快速绿卡的服务混淆EB-3 Other Workers排期与普通EB-3。",
      "不等于先到美国打黑工后可以自动转身份。"
    ],
    "timing": [
      "PERM招聘审查与中国大陆排期均会使实际进度存在显著不确定性。",
      "2026年11月EB-3中国大陆Final Action 2022-01-22，Other Workers 2019-10-01；以后每月变化。"
    ],
    "future": [
      "境外申请通常在移民签证名额可用时进入NVC及领事签证程序。",
      "身份合法维护和家属排期应按个案规划，不能先付款买工作机会。"
    ],
    "faq": [
      {
        "question": "无专业学历就一定可以EB-3吗？",
        "answer": "可能存在Other Workers类别，但仍需真实雇主、PERM、移民审查和独立的排期。"
      },
      {
        "question": "PERM成功能直接入境工作吗？",
        "answer": "不能。PERM是劳工认证阶段，并非签证或工作许可。"
      }
    ],
    "highlights": [
      "真实雇主担保",
      "PERM劳工认证",
      "区分Other Workers"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-third-preference-eb-3",
    "sources": [
      {
        "label": "USCIS EB-3",
        "url": "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-third-preference-eb-3",
        "purpose": "技术/专业及其他工人资格"
      },
      {
        "label": "DOL PERM",
        "url": "https://flag.dol.gov/programs/perm",
        "purpose": "劳工认证及雇主招聘要求"
      },
      {
        "label": "国务院当月排期",
        "url": "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-november-2026.html",
        "purpose": "EB-3及其他工人区别"
      }
    ]
  },
  {
    "id": "us-eb5",
    "name": "投资移民（EB-5）",
    "english": "EB-5 Immigrant Investor Program",
    "category": "residence",
    "summary": "通过符合联邦法律的合格商业投资及创造美国就业目标，申请美国第五优先职业移民；属于高风险真实投资而不是买签证、保证本金或自动批准绿卡。",
    "audience": "具备经合法验证资金来源、可承担投资风险、计划以合规项目创造就业并理解长期排期的投资人。",
    "requirements": [
      "现行法条对标准项目一般要求至少105万美元、符合目标就业地区或基础设施项目通常至少80万美元；具体生效时点和未来通胀调整需官方确认。",
      "必须证明投资资金合法来源和资金转移路径、实际承担投资风险，符合对应就业岗位创造与项目规则。",
      "区域中心与直接投资在申请表、就业计算及项目证据方面不同，不得把项目市场宣传等同USCIS政府批准。",
      "中国大陆出生投资人的名额受EB-5有保留与无保留类别影响；2026年11月中国大陆无保留Final Action Date为2016年12月1日，而部分保留类别显示Current，未来可能变化。"
    ],
    "documents": [
      "合法资金来源、税务、资产交易与实际银行资金流证据",
      "项目商业计划、投资协议、风险披露、实体文件和就业创造计划",
      "区域中心/商业项目相关合规备案或申报证明",
      "申请人及家属身份材料、I-526/I-526E及后续移民文件"
    ],
    "steps": [
      "先核查投资是否符合法定投资额和目标就业地区等门槛。",
      "由独立合格专业机构核查项目、区域中心、失利风险及募集文件，不相信所谓保本返签。",
      "完成资金来源、银行轨迹与商业项目尽调，明确就业岗位创造规则。",
      "依适用类型提交I-526或I-526E，并按照监管与投资程序办理。",
      "密切核对当月Visa Bulletin，获签/调整完成后还需按有条件绿卡规定处理后续I-829等要求。"
    ],
    "fees": [
      "本金投资通常最低80万美元或105万美元，依法调整前以USCIS、法律文本及申请时间为准；这是风险资本，不是政府手续费。",
      "政府I-526E/I-829及其他表格、区域中心管理、法律、审计与运营费用另算，投资损失风险真实存在。"
    ],
    "rights": [
      "只有完成相应移民程序并满足所有条件后才可能取得相应永久居民身份。",
      "许多投资人先获得有条件居留，随后还需符合规定的解除条件手续。"
    ],
    "risks": [
      "任何宣称政府保本保绿卡或保证项目回购的说法都应高度警惕。",
      "即使部分保留类别排期显示Current，也不保证当年签证额度持续充足。",
      "EB-5金融与移民双重风险极高，尤其不建议把全部流动资金押入未经独立尽调项目。"
    ],
    "timing": [
      "2026年11月中国大陆EB-5无保留Final Action 2016-12-01；农村、高失业和基础设施预留类别当前标记C，但随时可变。",
      "获得I-526类批准不代表免除NVC、签证排期、身份审查或解除绿卡条件程序。"
    ],
    "future": [
      "投资项目如实履行就业创造与合规运营义务，保存完整文件。",
      "出现运营问题或移民政策变化，应寻求独立的法律和受监管金融意见。"
    ],
    "faq": [
      {
        "question": "80万美元是不是交给美国政府买绿卡？",
        "answer": "不是，这是投向符合要求、承担商业风险的项目资本，官方政府申请费另算。"
      },
      {
        "question": "预留类别显示Current就可马上获绿卡吗？",
        "answer": "不能。还需移民申请审批、材料审查、签证程序和可能的身份调整。"
      }
    ],
    "highlights": [
      "80万/105万美元",
      "就业创造与资金来源",
      "高风险非保本"
    ],
    "officialUrl": "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-fifth-preference-eb-5",
    "sources": [
      {
        "label": "USCIS EB-5",
        "url": "https://www.uscis.gov/working-in-the-united-states/permanent-workers/employment-based-immigration-fifth-preference-eb-5",
        "purpose": "EB-5项目资格和具体表格"
      },
      {
        "label": "美国移民法第8编1153条",
        "url": "https://uscode.house.gov/us/usc/119-118/t8/s1153/",
        "purpose": "当前最低投资额条款"
      },
      {
        "label": "国务院2026年11月排期",
        "url": "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin/2027/visa-bulletin-for-november-2026.html",
        "purpose": "中国大陆EB-5有保留/无保留状态"
      }
    ]
  }
];
