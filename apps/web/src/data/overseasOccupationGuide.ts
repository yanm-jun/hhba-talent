/** HHBA overseas occupation samples: verified job titles/codes, non-exhaustive.
 * 2026-11-04. No simulated vacancies or promise of visa eligibility. */
export type OccupationRecord={
 id:string;country:'nz'|'au';pathwayId:string;tier:string;group:string;
 name:string;english:string;code:string;intro:string;
 qualification:string[];registration:string;wage:string;wageAsOf:string;
 experience:string;proof:string[];actions:string[];sources:{label:string;url:string}[];
 warning:string;verifiedOn:string;
};
export const nzGreenListUrl='https://www.immigration.govt.nz/work/requirements-for-work-visas/green-list-occupations-qualifications-and-skills/green-list-roles-jobs-we-need-people-for-in-new-zealand/';
export const nzWageUrl='https://www.immigration.govt.nz/live/resident-visas-to-live-in-new-zealand/skilled-residence-pathways-in-new-zealand/work-to-residence-wage-rates/';
export const nzIqaUrl='https://www.immigration.govt.nz/work/requirements-for-work-visas/green-list-occupations-qualifications-and-skills/check-if-you-need-an-international-qualification-assessment/';
export const nzRegistrationUrl='https://www.immigration.govt.nz/work/requirements-for-work-visas/green-list-occupations-qualifications-and-skills/check-if-you-need-occupational-registration-for-your-job/';
const greenSources=[{label:'新西兰移民局 Green List 实时职业查询',url:nzGreenListUrl},{label:'新西兰移民局居留工资表',url:nzWageUrl},{label:'海外学历 IQA 官方判断方法',url:nzIqaUrl}];
const base={
 country:'nz' as const,pathwayId:'nz-green-tier1',tier:'Tier 1',verifiedOn:'2026-11-04',
 wageAsOf:'2026-03-09 起实施的移民局工资表；申请前复核',
 experience:'Tier 1 不等于一律要求同样年数的经验；须核实职业专项要求、合同类型和申请人真实工作经历。',
 proof:['护照及中文、英文姓名一致的学历证明','可核实的工作邀请：雇主法定名称、职位职责、工资、工作地点、保证工时','涉及海外学历时检查 IQA 或评估豁免','按职业要求提供执业注册或许可（如适用）'],
 sources:greenSources
};
const engineerQualification=[
 '可选途径之一：被认可的华盛顿协议（Washington Accord）工程本科学位；必须确认毕业年份及具体项目获得认证。',
 '其他列明途径包括符合要求的新西兰工程荣誉学士学位（NZQCF 8级）、工程专业认证评估或新西兰特许专业工程师（CPEng）注册。',
 '中国“工程专业本科”并不自动等于符合上述途径。须核对学校、专业、毕业届别及工程教育认证，必要时参考 Engineering New Zealand 评估。'
];
function engineering(id:string,name:string,english:string,code:string,focus:string):OccupationRecord{
 return {...base,id,group:'工程技术',name,english,code,
 intro:'官方职业代码 '+code+' 的 '+english+'。核心是实际从事的工程职责和招聘岗位匹配，不是仅因毕业证上有“工程”二字就自动符合。',
 qualification:engineerQualification,
 registration:'工程职业并非统一强制先取得 CPEng；CPEng 注册是绿名单认可的可选资格途径之一。若从事受监管工程职责，还需另查当地执业要求。',
 wage:'这组工程师职业若没有单独更高的绿名单工资门槛，Straight to Residence 当前一般至少 NZD 35.00/小时；最终以该职业在现行官方清单及薪资表为准。',
 experience:'没有适用于所有此组职业的统一“必须 N 年”说明；实际职位要求、学历认证路径和合约要求仍需满足。',
 proof:[...base.proof,'个人工程项目经历、岗位任务、相关图纸/设计说明或经雇主确认的职责文件'],
 actions:['用 ANZSCO '+code+' 在官方 Green List 精确查 '+english+' 是否为 Tier 1。','查本人学历是否属于被认可的工程教育项目（包括授予年份），不符合时核查工程师认证途径。','让认证雇主在合同中写明 '+focus+' 职责、工资、工作时间，再确认个人签证资格。'],
 warning:'学历专业名称接近、岗位名称相似，不代表实际职业任务符合 ANZSCO '+code+'；工程学位认证按具体毕业项目和年份判断。'};
}
function healthcare(id:string,name:string,english:string,code:string,degree:string,body:string,link:string):OccupationRecord{
 return {...base,id,group:'医疗健康',name,english,code,
 intro:'这是受职业监管的 '+english+'，不仅要获得工作邀请，还要能证明相应的新西兰职业登记资格。',
 qualification:[degree,'海外学历是否满足执业资格由相应职业监管机构判断；IQA 不能直接取代本地执业注册。'],
 registration:'必须确认能取得 '+body+' 的适用职业注册/执业证明；准确注册类别以该机构及 Green List 现行要求为准。',
 wage:'若该职业未列专门更高工资门槛，Straight to Residence 当前一般至少 NZD 35.00/小时；某些岗位或雇佣安排仍需核对最新规则。',
 experience:'职业注册机构可能审查受训、执业经验与临床能力，但不宜将其他签证的统一经验年数直接套用本职业。',
 proof:[...base.proof,'职业监管机构的注册或适用准注册证明','学历课程、临床实习与现有执照证明（如机构要求）'],
 actions:['在 Green List 按代码 '+code+' 查询 '+english+' 的 Tier 和注册条件。','在 '+body+' 核对海外学历、语言与执业注册流程，取得机构认可的证据。','核实雇主的职位与执业范围一致，随后按 Straight to Residence 官网办理。'],
 sources:[...greenSources,{label:body+'（职业注册机构）',url:link}],
 warning:'国内医护执业证、毕业证不等于已获得新西兰执业许可；未经注册不得从事受监管专业工作。'};
}
function tech(id:string,name:string,english:string,code:string):OccupationRecord{
 return {...base,id,group:'信息技术',name,english,code,
 intro:'这一职业按真实软件或信息系统职责认定，雇主的岗位描述要对应 ANZSCO '+code+'。',
 qualification:['该职业的 Tier 1 公开工资条件十分关键，不能单靠计算机本科学位或某种培训证书直接获得居民签证。','雇主应有与职业代码相符的技术岗位，移民局按实际职责及其他居留要求审查。'],
 registration:'该职业在所查官方 Green List 信息中没有与医护同类的统一强制执业注册要求；仍应查看岗位是否另有专业许可证。',
 wage:'从 2026-03-09 起，移民局 Straight to Residence ICT 类别工资表列示 NZD 72.80/小时。若以合同提供服务而非普通雇佣，可能适用 NZD 109.20/小时及至少10年相关工作等更严格条件；请按具体合同与当期清单核验。',
 experience:'普通雇佣和“contract for services”不能混淆；后者在相关规则中可能要求至少10年相应经历。',
 proof:[...base.proof,'实际开发、系统运维或数据工作职责说明及可核实的工作经历','说明报酬结构是雇员工资还是合同服务费用'],
 actions:['用代码 '+code+' 在 Green List 中查真实岗位而非岗位宣传名称。','对照移民局 2026 年工资表及合同薪酬结构，明确是否有合同服务的额外门槛。','核验认证雇主身份、至少30小时保证工时与居民签证全部要求。'],
 warning:'软件技术岗位上榜并不保证获居留。尤其不可直接套用过期 ICT 工资数字；不同合同安排的门槛不同。'};
}
export const nzTier1Occupations:OccupationRecord[]=[
 engineering('nz-civil-engineer','土木工程师','Civil Engineer','233211','土木设计、施工或结构计算'),
 engineering('nz-mechanical-engineer','机械工程师','Mechanical Engineer','233512','机械系统设计、设备工程和技术问题解决'),
 engineering('nz-electrical-engineer','电气工程师','Electrical Engineer','233311','电力系统、电气设计及工程技术'),
 engineering('nz-electronics-engineer','电子工程师','Electronics Engineer','233411','电子系统和硬件设计'),
 engineering('nz-structural-engineer','结构工程师','Structural Engineer','233214','结构设计与分析'),
 {...base,id:'nz-construction-manager',group:'建筑工程',name:'建筑工程项目经理',english:'Construction Project Manager',code:'133111',
  intro:'建筑工程项目经理（ANZSCO 133111）是按真实项目管理工作职责而非单纯“经理”头衔认定的 Tier 1 职业。',
  qualification:['官方列有工程荣誉学士（NZQCF 8级）、工程技术学士或建筑学士（NZQCF 7级）等途径。','其他途径包括满足专业学分要求的建筑管理、土木工程等相关学士/文凭、认可工程学位或工程师专业评估；必须逐条核对。','中国土木或工程管理本科不能只凭专业名称推断符合，需核对课程内容和海外资格评估要求。'],
  registration:'不应宣称所有建筑项目经理都必须持有工程师注册；官方允许符合要求的学历、评估或注册等不同路径。',
  wage:'若未适用职业专属更高工资门槛，Straight to Residence 一般至少 NZD 35.00/小时；仍须满足岗位实际薪资要求。',
  experience:'绿名单强调合规资格与职位内容。雇主可对大型项目管理经历提出进一步要求，不应把岗位招聘条件误作统一签证法定最低年数。',
  proof:[...base.proof,'项目管理职责、工程项目类型、参与阶段和真实雇主证明'],
  actions:['在移民局 Green List 搜索 133111，展开不同认可资格的详细选项。','核对毕业证与建筑管理/工程课程内容，必要时进行 IQA 或专业认证。','确认认证雇主提供的真实全职施工项目管理岗位并准备合同证明。'],
  warning:'项目经理、工地主管和 Project Builder 等名称相似但职业代码不同；不能把任意管理职位归到此代码。'},
 {...base,id:'nz-quantity-surveyor',group:'建筑工程',name:'工程造价师',english:'Quantity Surveyor',code:'233213',
  intro:'工程造价、预算和工程计量相关职业。必须核实真实职责对应 ANZSCO 233213。',
  qualification:['官方列明包含工料测量或建设经济学重点内容、符合 NZQCF 7级和所需学分的学士资格等途径。','也可能通过新西兰工料测量师协会 NZIQS 所列会员或认可海外学位路径；不能仅凭中国“造价员”称号判定合格。'],
  registration:'核对 NZIQS 适用的学历认可或会员途径；官方列出的 NZIQS 路径是资格选择之一，不意味着所有人必须已有该会员。',
  wage:'如该岗位无独立更高门槛，Straight to Residence 一般至少 NZD 35.00/小时。',
  experience:'工作内容和个人资格需匹配；没有可信依据不能称“任何造价工作两年就够”。',
  proof:[...base.proof,'工程清单计量、造价预算、合同计价等实际工作证明'],
  actions:['对照 233213 职业描述核对工作职责。','检查学位课程是否含造价或建设经济学要求；需要时联系 NZIQS 核查学历。','验证认证雇主报价、合同工资和职位任务。'],
  warning:'“预算员、估价师、建筑项目经理”不是可以互相替换的移民职业代码。'},
 tech('nz-software-engineer','软件工程师','Software Engineer','261313'),
 tech('nz-analyst-programmer','分析程序员','Analyst Programmer','261311'),
 tech('nz-systems-administrator','系统管理员','Systems Administrator','262113'),
 healthcare('nz-registered-nurse-medical','注册护士（内科）','Registered Nurse (Medical)','254418','官方注册资格对照 Bachelor of Nursing 等护理学历条件。','Nursing Council of New Zealand','https://www.nursingcouncil.org.nz/'),
 healthcare('nz-registered-nurse-critical','注册护士（急诊/重症）','Registered Nurse (Critical Care and Emergency)','254415','官方注册资格对照 Bachelor of Nursing 等护理学历及适用临床执业要求。','Nursing Council of New Zealand','https://www.nursingcouncil.org.nz/'),
 healthcare('nz-physiotherapist','物理治疗师','Physiotherapist','252511','职业资格列明 Bachelor of Physiotherapy 或 Bachelor of Health Science (Physiotherapy) 等途径。','Physiotherapy Board of New Zealand','https://physioboard.org.nz/'),
 {...base,id:'nz-external-auditor',group:'商业与审计',name:'外部审计师',english:'External Auditor',code:'221213',
 intro:'外部审计师（ANZSCO 221213）在绿名单 Tier 1，要求实际从事符合职业定义的审计工作，不等于所有会计岗位都可用。',
 qualification:['此职业的 Green List 专项门槛为明确工资标准；学历、英语及职位职责仍需分别符合居民签证的一般要求。'],
 registration:'需对照实际审计职责与当地行业执业规则；不宜把会计学位直接视为取得审计执业资格。',
 wage:'2026-03-09 起适用的绿名单工资要求至少 NZD 45.50/小时，40小时工作周的税前年薪示意为 NZD 94,640；实际按每小时工资和合同核算。',
 experience:'不应把“曾做过会计”与“外部审计师真实职业经历”直接等同。',
 proof:[...base.proof,'审计报告相关职责、客户项目及雇主证明（不得泄露客户机密）'],
 actions:['用 ANZSCO 221213 检查真实职位和职业责任。','按当前工资表复核税前时薪是否至少 NZD 45.50。','核实认证雇主的合同职位、保证工时与一般居留条件。'],
 warning:'工资门槛是移民规则，不是最低行业工资；即使工资达标，假冒审计职位或缺乏真实资格也不能符合。'},
 {...base,id:'nz-secondary-teacher',group:'教育行业',name:'中学教师',english:'Secondary School Teacher',code:'241411',
 intro:'新西兰中学教师（241411）在所查 Green List Tier 1 职业范围内，重点是 Teaching Council 职业注册及有效任教证书。',
 qualification:['政府清单列示 Bachelor of Education、Bachelor of Teaching 等教师学历途径；其他等同资格要由教师注册机构依具体课程判断。','中国教师资格证、教育学或学科本科学历并不会自动变成新西兰有效任教资格。'],
 registration:'须核对 Teaching Council of Aotearoa New Zealand 的注册，以及 provisional 或 full practising certificate（临时或完整任教证书）要求。',
 wage:'无特定更高门槛时 Straight to Residence 一般至少 NZD 35.00/小时；具体职位仍应核对当前薪资规则。',
 experience:'具备本地认可的教育背景、任教证书和学校职位至关重要；任教经历要求取决于注册评估及职位。',
 proof:[...base.proof,'教育学历课程内容、实习/教学记录和教师资格','Teaching Council 注册及适用执业证书'],
 actions:['在 Green List 搜索 241411 并确认当前 Tier。','查看 Teaching Council 海外教师注册流程、学历和语言要求。','找到认证雇主的合规学校全职岗位，分别核对教师注册与居民签证条件。'],
 sources:[...greenSources,{label:'新西兰教师理事会',url:'https://teachingcouncil.nz/'}],
 warning:'不要把 Early Childhood Teacher（幼儿教师）与 Secondary School Teacher（中学教师）混为一谈，它们的 Tier 及申请条件可能不同。'}
];
