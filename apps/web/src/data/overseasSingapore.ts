/* HHBA 新加坡官方出国路径。审核基准 2026-11-06；时变数值请到官方入口确认。 */
import type {OverseasCategory} from './overseasNewZealand';
export const sgVerifiedOn='2026-11-06';
export type SgPathway={id:string;name:string;english:string;category:OverseasCategory;summary:string;audience:string;officialUrl:string;requirements:string[];documents:string[];steps:string[];fees:string[];rights:string[];risks:string[];highlights:string[]};
export const sgPathways:SgPathway[]=[
  {
    "id": "sg-ep",
    "name": "就业准证（EP）",
    "english": "Employment Pass",
    "category": "work",
    "summary": "面向受雇于新加坡企业的外国专业人员、经理与行政人员。必须核对岗位工资、年龄分档、COMPASS与雇主申请程序。",
    "audience": "已获得新加坡企业专业岗位邀请的人",
    "officialUrl": "https://www.mom.gov.sg/passes-and-permits/employment-pass",
    "requirements": [
      "一般须符合依年龄递增的EP最低固定月薪门槛，金融服务行业通常另设较高门槛；工资不能只看总包或浮动奖金。",
      "大部分申请须通过COMPASS评分框架，除非符合官方豁免；其中学历、薪资、公司多元化与本地就业支持等有明确标准。",
      "由合资格雇主或指定就业代理提交申请；雇主可能需要先按公平招聘规定发布职位广告。",
      "候选人需要满足岗位适配、合法雇佣、护照及相关核验要求。"
    ],
    "documents": [
      "护照个人信息页及真实身份信息",
      "企业offer、职务职责、固定月薪及公司信息",
      "符合条件的学历核验资料（如适用）",
      "个人经历和官方要求的其他补件"
    ],
    "steps": [
      "检查MOM EP最新工资门槛及年龄区间，并确认金融行业差异。",
      "让雇主用MOM自我评估工具及COMPASS规则核对资格。",
      "由雇主/授权代理按官方程序申请，完成费用支付与材料上传。",
      "收到原则批准（IPA）后按要求入境、签发准证和办理登记。"
    ],
    "fees": [
      "EP有官方申请费与签发费，费用与调整以MOM当前表格为准。",
      "另计学历核验、搬迁、住宿及保险成本，不能把工资门槛误记成申请费。"
    ],
    "rights": [
      "EP通常允许为指定雇主从事获准工作；更换雇主通常需新雇主办理准证。",
      "符合条件时可考虑家属准证，但并非任何薪资均能担保家属。",
      "EP不自动转为永久居民。"
    ],
    "risks": [
      "固定薪资不达标，或COMPASS不通过，可能导致拒绝。",
      "未经批复不得以旅游入境身份直接就业。"
    ],
    "highlights": [
      "专业/管理岗位",
      "年龄分档工资",
      "COMPASS"
    ]
  },
  {
    "id": "sg-s-pass",
    "name": "中等技能工作准证（S Pass）",
    "english": "S Pass",
    "category": "work",
    "summary": "适合符合薪资及雇主配额、征税条件的中等技能外国雇员；与EP的COMPASS体系不同。",
    "audience": "获得新加坡合法雇主聘用的技术、服务或中等技能岗位人员",
    "officialUrl": "https://www.mom.gov.sg/passes-and-permits/s-pass",
    "requirements": [
      "申请工资门槛随年龄、行业和生效日期变化，金融行业另设门槛；必须按递交时适用标准查验。",
      "雇主受S Pass配额及征税（levy）制度限制，取得工作邀请不保证雇主有可用额度。",
      "申请由雇主或授权代理发起，候选人应符合岗位、学历或资格审核。"
    ],
    "documents": [
      "护照及身份文件",
      "工作邀请、固定月薪和岗位职责",
      "资格学历或技能证明（如被要求）",
      "雇主配额及申请所需其他资料"
    ],
    "steps": [
      "与雇主确认实际聘用主体和岗位工资。",
      "核查MOM最新S Pass薪资规则、适用日期和公司配额。",
      "由雇主向MOM递交，收到IPA后按要求入境与签发准证。",
      "保存工作合同与合法准证，依法办理延期或雇主转换。"
    ],
    "fees": [
      "申请及签发费查询MOM页面；征税是雇主责任，不应暗示求职者买配额。",
      "预算另含搬迁和初期生活费。"
    ],
    "rights": [
      "只可在符合准证条件下工作；雇主转换一般需要重新申请。",
      "家属资格另受工资等条件限制；不会自动拥有PR。"
    ],
    "risks": [
      "严禁购买雇主配额、虚假工资与虚构职位。",
      "不能把S Pass配额描述为可自行抢购的个人名额。"
    ],
    "highlights": [
      "工资及年龄要求",
      "雇主配额",
      "征税制度"
    ]
  },
  {
    "id": "sg-work-permit",
    "name": "外籍劳工工作准证（Work Permit）",
    "english": "Work Permit for migrant worker",
    "category": "work",
    "summary": "按行业、来源地、雇主配额和年龄等政策批准的外国工人工作准证，制造、建筑、海事、流程及服务等行业规则不同。",
    "audience": "拥有真实合格雇主聘用且符合行业与来源地政策的人员",
    "officialUrl": "https://www.mom.gov.sg/passes-and-permits/work-permit-for-foreign-worker",
    "requirements": [
      "雇主必须符合对应行业的外国劳工准证配额、来源国及岗位限制；中国籍是否适用需按具体行业核对。",
      "雇主负责办理准证及履行住宿、医疗保险、相关担保或征税等法定义务。",
      "雇员通常不得自行从事其他雇主的工作、接私活或超出准证范围工作。"
    ],
    "documents": [
      "有效护照",
      "真实雇佣合同及雇主主体资料",
      "MOM规定的体检、身份及相关行业资质（如需要）"
    ],
    "steps": [
      "先确认行业、岗位、雇主实体与允许的来源国家。",
      "由雇主核查配额、申请要求及其必须承担的费用。",
      "按官方步骤取得IPA、入境、体检（如要求）与准证签发。",
      "落地后核对合同、工资支付和工作场所；遇非法收费可使用MOM投诉渠道。"
    ],
    "fees": [
      "官方收费及雇主征税应区分；不承诺全部工作准证都由个人承担同一费用。",
      "劳务中介收费在新加坡受法定上限及许可监管，应核查所在地规定。"
    ],
    "rights": [
      "在准证指定雇主、岗位和期限内合法工作。",
      "Work Permit不是移民/永久居民的自动取得途径。"
    ],
    "risks": [
      "来源地、行业配额以及雇主资格变化可能导致不适用。",
      "谨防付钱购买虚构岗位、扣押护照或非法招聘费用。"
    ],
    "highlights": [
      "按行业申请",
      "雇主责任",
      "不能买岗位"
    ]
  },
  {
    "id": "sg-one-pass",
    "name": "顶尖专才通行证（ONE Pass）",
    "english": "Overseas Networks & Expertise Pass",
    "category": "work",
    "summary": "面向符合高薪或杰出成就等严格资格的高层次人才，可按政府规则拥有较灵活的工作与创业安排。",
    "audience": "高收入高管、科研及文化艺术、体育等取得杰出成就的人才",
    "officialUrl": "https://www.mom.gov.sg/passes-and-permits/overseas-networks-expertise-pass",
    "requirements": [
      "高薪路径通常涉及至少每月S$30,000固定薪资及当前或过去特定就业与雇主条件；也存在须政府审查的杰出成就路径。",
      "评审会区分海外/境内申请情形、雇主规模与成就证据，不能单靠自称优秀人才。",
      "申请人必须满足MOM指定身份、证明及其他审查条件。"
    ],
    "documents": [
      "护照及身份资料",
      "工资单、税务证明及雇主规模或工作经历证明",
      "科研、文化、体育等杰出成就证据（如走该路径）"
    ],
    "steps": [
      "按MOM官网选择高薪或成就申请条件。",
      "整理可核验的固定薪资、雇主及成果证据。",
      "按官方入口递交申请并回复核验要求。",
      "获准后逐项阅读活动和年度通知义务。"
    ],
    "fees": [
      "政府费和准证签发费以MOM申请入口为准。",
      "准备必要认证及迁居成本；高薪资格并非向政府缴纳S$30,000。"
    ],
    "rights": [
      "该准证相较普通雇主绑定工签可提供更灵活的就业及创业安排。",
      "准证效期与续签条件需另行符合，PR非自动获得。"
    ],
    "risks": [
      "不能用短期浮动收入冒充固定月薪。",
      "杰出成就豁免不是普通申请人的低门槛捷径。"
    ],
    "highlights": [
      "高薪/杰出成就",
      "严格审查",
      "灵活活动"
    ]
  },
  {
    "id": "sg-pep",
    "name": "个性化就业准证（PEP）",
    "english": "Personalised Employment Pass",
    "category": "work",
    "summary": "为符合高薪条件的外国专业人士提供较灵活的就业选择，但通常不能以此自雇或创业，且须满足持续收入要求。",
    "audience": "符合MOM现行较高固定月薪门槛的高级专业人士",
    "officialUrl": "https://www.mom.gov.sg/passes-and-permits/personalised-employment-pass",
    "requirements": [
      "现行官方薪资条件须按申请日期核对；PEP与普通EP最低薪资标准并不相同。",
      "持有人需满足持续就业、最低年收入及失业时间限制。",
      "准证通常不可续期，不能直接作为开办企业的创业通行证。"
    ],
    "documents": [
      "护照与身份材料",
      "固定月薪、过去收入及雇主相关证据",
      "就业和税务记录"
    ],
    "steps": [
      "在MOM PEP页面核查适用薪资及限制。",
      "确认本人满足薪资和就业身份要求。",
      "按官网入口提供真实收入证明并申请。",
      "持续保存实际收入与工作状态以核对准证条件。"
    ],
    "fees": [
      "官方申请与签发费以MOM实时公布为准。",
      "需考虑失业过渡资金及落地生活费。"
    ],
    "rights": [
      "可在符合条件下更灵活更换雇主。",
      "并不授予无限期居留或自动PR。"
    ],
    "risks": [
      "PEP不适用于一般低薪岗位。",
      "不能把PEP宣传成可无条件自雇的创业许可。"
    ],
    "highlights": [
      "高级专业人士",
      "非普通创业签证",
      "续期受限"
    ]
  },
  {
    "id": "sg-entrepass",
    "name": "企业家准证（EntrePass）",
    "english": "EntrePass",
    "category": "work",
    "summary": "供拟创办并经营符合创新与风险资本支持等标准的企业家研究的企业准证，不能简单凭注册公司或缴纳股本取得。",
    "audience": "有真实技术创新、投资支持或高成长创业经验的申请人",
    "officialUrl": "https://www.mom.gov.sg/passes-and-permits/entrepass",
    "requirements": [
      "拟在新加坡设立及经营符合要求的私人有限公司，申请人须属于MOM认可的创新企业家、创新者或投资者等情况。",
      "营业内容、既往融资、知识产权、孵化器或相关成就需按官方一项项匹配。",
      "特定不符合资格的传统小生意类别不能简单套用此准证。"
    ],
    "documents": [
      "商业计划书和商业模式证据",
      "企业注册或拟设立公司资料",
      "融资、知识产权、孵化或创业履历证据",
      "身份及必要附加资料"
    ],
    "steps": [
      "对照EntrePass具体资格类别与不适用业务清单。",
      "准备真实商业模式、创新及资金来源证据。",
      "核对企业成立时点和公司结构，按MOM申请。",
      "按续期标准经营，保留本地雇佣、经营开支及成效材料。"
    ],
    "fees": [
      "行政费用以MOM为准；企业成立和运营成本另计。",
      "官方没有统一买创业签的固定投资返签套餐。"
    ],
    "rights": [
      "获批后依准证条件在批准的企业开展业务。",
      "续签与企业真实经营表现有关，不自动获得PR。"
    ],
    "risks": [
      "注册空壳公司或购买商业计划不构成合格创新创业。",
      "没有实际企业运营可能影响续签。"
    ],
    "highlights": [
      "创新创业",
      "需真实经营",
      "非投资买签"
    ]
  },
  {
    "id": "sg-student",
    "name": "学生准证（Student's Pass）",
    "english": "Student's Pass",
    "category": "study",
    "summary": "赴新加坡符合规定的全日制课程学习，通常须先获得教育机构录取，再由学校与ICA规定渠道办理学生准证。",
    "audience": "已经获得合规新加坡学校全日制录取的留学生",
    "officialUrl": "https://www.ica.gov.sg/reside/STP/apply",
    "requirements": [
      "先确认学校是否属于ICA认可的可申请学生准证类别，课程、学校资质与全日制属性均须核对。",
      "持有真实录取并在官方SOLAR或适用e-Service系统完成申请。",
      "还需满足入境、身份、资金或保证金、体检等具体要求（按学校及申请情况）。"
    ],
    "documents": [
      "护照、合格课程录取函",
      "个人身份及符合要求的照片",
      "学历证明、学校要求材料与财务证明",
      "ICA要求的体检及其他文件"
    ],
    "steps": [
      "在院校官方招生页核对学校、课程和学费。",
      "接受录取后依学校提供的ICA申请信息在线申请学生准证。",
      "按ICA通知完成材料、费用、体检和必要的准证手续。",
      "持有效学生准证入学，遵守在读兼职和实习限制。"
    ],
    "fees": [
      "ICA学生准证申请费、签发费及可能的多次入境签证收费以ICA官网为准。",
      "学校学费、住宿、生活费与医疗保险应单列，不能把生活费当签证费。"
    ],
    "rights": [
      "可以按批准学校与课程在新加坡学习。",
      "兼职规则与学校是否获MOM列入许可名单、学期/假期、工时等有关，并非自动自由打工。",
      "毕业后没有自动长期工作权利，也不会因为毕业自动获得PR。"
    ],
    "risks": [
      "不应把旅游身份直接当作长期学习许可。",
      "注意私立院校课程与政府公立大学的资格、工作权利可能不同。"
    ],
    "highlights": [
      "合规学校录取",
      "ICA申请",
      "兼职条件"
    ]
  },
  {
    "id": "sg-ltvp-graduate",
    "name": "本地院校毕业生求职长期探访准证（LTVP）",
    "english": "Long-Term Visit Pass for graduates seeking employment",
    "category": "experience",
    "summary": "部分符合ICA规定的新加坡高等教育机构毕业生可申请用于求职的长期探访准证，属于求职停留，不等于工作准证。",
    "audience": "已从ICA认可本地高等院校毕业并符合申请条件的外国学生",
    "officialUrl": "https://www.ica.gov.sg/reside/LTVP/apply",
    "requirements": [
      "须核实是否属于ICA列明可申请的高等教育机构毕业生类别，不能对所有私立课程一概适用。",
      "应在合法身份有效期内按ICA要求提出申请及准备材料。",
      "LTVP主要允许按条件停留寻找工作，不直接允许无工签受雇工作。"
    ],
    "documents": [
      "毕业证明和学历文件",
      "有效护照和当前在新加坡的合法身份材料",
      "ICA要求的照片及其他支持文件"
    ],
    "steps": [
      "核对ICA LTVP毕业生求职资格与认可院校清单。",
      "毕业前确认当前Student's Pass取消及后续合法停留衔接。",
      "按ICA申请并保留审批回执。",
      "获得真实工作邀请后由雇主评估申请EP或S Pass等。"
    ],
    "fees": [
      "按ICA公布的LTVP费率和具体签发情况核算。",
      "预算包括无工资求职期生活开支。"
    ],
    "rights": [
      "满足准证条件时可以在新加坡合法停留与求职。",
      "LTVP并不自动给予就业许可或PR。"
    ],
    "risks": [
      "不是所有毕业生都有该资格。",
      "获得LTVP后直接入职工作仍须核查工作准证。"
    ],
    "highlights": [
      "特定毕业生",
      "求职停留",
      "不等于工签"
    ]
  },
  {
    "id": "sg-pr",
    "name": "永久居民身份申请（PR）",
    "english": "Permanent Residence application",
    "category": "residence",
    "summary": "符合ICA列明身份类别的人可以提出新加坡永久居民申请，ICA会综合评估；没有积分达到即获批或工作满年数自动转PR的承诺。",
    "audience": "符合官方类别的EP/S Pass持有人、与新加坡公民或PR有特定家庭关系者及其他官方合格人士",
    "officialUrl": "https://www.ica.gov.sg/reside/PR/apply",
    "requirements": [
      "ICA列明可申请类别包含EP或S Pass持有人及符合规定的家庭成员、学生、投资者等，须按身份类别核对。",
      "申请会综合考虑家庭联系、经济贡献、年龄、资格、居留时间及融入程度等因素，不存在对所有人的保证分数。",
      "男性申请人及家属须认真阅读国民服役（NS）有关义务与后果。"
    ],
    "documents": [
      "护照、出生及婚姻等身份/关系文件（按类别）",
      "学历、就业、收入、税务文件（按类别）",
      "申请表及ICA要求的认证翻译、证件照片",
      "特定类别要求的保证人及补充资料"
    ],
    "steps": [
      "在ICA官网核对当前可申请身份类别和关联申请人。",
      "按身份类别准备工资税务、学历与家庭等原始证据。",
      "通过ICA电子服务递交并支付相应费用。",
      "在等待决定期间保持现有合法准证有效，按结果办理后续手续。"
    ],
    "fees": [
      "ICA政府申请与签发费用需在递交时核实。",
      "专业咨询不是法定必经收费项目，不能购买保批名额。"
    ],
    "rights": [
      "获批后依据PR身份在新加坡长期生活工作，但需遵守再入境许可及其他管理规定。",
      "PR身份不是新加坡公民身份，也不等于护照。"
    ],
    "risks": [
      "ICA审查具有裁量性，任何固定期限或工资并不保证成功。",
      "国民服役义务对部分男性申请人具有重大影响，须提前阅读官方文件。"
    ],
    "highlights": [
      "ICA综合审查",
      "国民服役注意",
      "非自动永居"
    ]
  }
];
export const sgNotEligible=[
 {title:'中国大陆普通护照通常不符合新加坡 Work Holiday Programme 国籍/院校地区要求',detail:'Work Holiday Programme 具有特定国籍/地区及学历条件，不是任何18至25岁中国公民都能申请；请查看MOM当前资格名单。',url:'https://www.mom.gov.sg/passes-and-permits/work-holiday-programme/eligibility'},
 {title:'旅游签证与部分学生准证不代表可以直接工作',detail:'所有涉及实际雇佣或实习的活动都须核对MOM豁免条件和相应工作准证；毕业求职LTVP不是就业许可证。',url:'https://www.mom.gov.sg/passes-and-permits/work-pass-exempt-activities'},
 {title:'2026与2027工资门槛生效日期可能不同',detail:'EP、S Pass及其他准证会按照申请日期、岗位行业和申请人年龄适用不同门槛，不应混用一个固定数字。',url:'https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility'}
];