/* HHBA 海外发展·澳大利亚，官方签证类别和公开条件，2026-11-04核验。
 * 所有路线均为信息介绍，并非对个人获签资格的裁定。 */
import type {OverseasPathway} from './overseasNewZealand';
export const auVerifiedOn='2026-11-04';
export const auOfficialSource='https://immi.homeaffairs.gov.au/';
export const auPathways:OverseasPathway[]=[
 {
 id:'au-482',name:'雇主担保：Skills in Demand（482）',english:'Skills in Demand (subclass 482)',category:'work',
 summary:'合格澳大利亚雇主提名具备对应技能的海外员工，在指定职业和符合薪资门槛的岗位上临时工作；需区分 Core Skills、Specialist Skills 等具体通道。',
 audience:'有合规雇主的真实职位提名，具备对应职业技能、相关经验及所需英语能力的人。',
 requirement:['先取得经批准雇主的真实提名，核对职位是否属于适用的 482 签证通道，不能把普通旅游签当工签。','Core Skills 通道须符合 Core Skills Occupation List、相应市场薪资及最低收入门槛；收入门槛会随年份调整。','通常须至少有12个月相关工作经验，并满足英语、职业注册和职业评估等适用要求。','不同通道对职业列表和薪资要求不同，依提交时的官方规则核查。'],
 documents:['雇主提名、雇佣合同、工作内容与工资证明','护照、学历与不少于12个月相关工作经验证据','职业评估、职业注册或英语成绩（如适用）','健康检查和品行证明'],
 steps:['根据真实职业核对移民局 482 通道和工资门槛。','核实雇主担保资格、真实提名与工作邀请。','完成所需的英语、职业认证、健康和品行材料。','由雇主完成提名后通过 ImmiAccount 按官方要求递交签证申请。'],
 fees:['2026-11-04 官方 482 页面核心技能通道主申请人起价 AUD 4,015；不同通道/家庭成员费用另计。','还可能涉及英语考试、体检、职业认证、翻译、机票与初期安家费用。'],
 rights:['Core Skills 通道通常可在澳大利亚为提名雇主工作最长4年（特殊护照及个别情况除外）。','工作权限可能受雇主和提名职业约束，变更雇主或职位须核对签证条件。','满足另一个签证类别要求时才可能申请永久居留，482 本身不是永居。'],
 risks:['不要向中介购买“482 名额”或支付伪造工作邀请费用。','雇主提名不等于签证获批，工资与职业要求每年可能更新。'],
 officialUrl:'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skills-in-demand-visa-subclass-482',
 secondaryUrl:'https://immi.homeaffairs.gov.au/employer-subsite/Pages/compare-sponsored-skilled-visa-options.aspx',
 highlights:['雇主提名','通常需12个月相关经验','临时工作'],availability:'check-official'
 },
 {
 id:'au-186',name:'雇主提名永久居留（186）',english:'Employer Nomination Scheme (subclass 186)',category:'residence',
 summary:'获得合格澳洲雇主提名并满足技能、英语、年龄以及适用通道要求后，可以申请永久居留；直接申请与临时居留转永居的规定不同。',
 audience:'已获得符合要求的澳大利亚雇主长期提名，具备工作技能和相应签证背景的申请人。',
 requirement:['必须获得澳大利亚雇主的有效提名并满足职位技能要求。','Direct Entry 与 Temporary Residence Transition 等通道有不同的工作经历、职业评估及当前签证要求。','通常需要满足年龄、英语、职业注册、健康及品行要求，具体豁免看通道。','雇主工作岗位须符合相应的持续雇佣承诺和法定薪资要求。'],
 documents:['雇主提名与完整雇佣合同','相关工作经验证据、职业技能评估与执照（如适用）','英语、身份、健康及品行文件','已有签证和雇主工作记录（转永居通道适用）'],
 steps:['区分 Direct Entry 与 Temporary Residence Transition 通道，判断适用条件。','核对雇主担保资格、岗位以及提名申报材料。','办理职业评估、英语和其他资格证明。','经官方 ImmiAccount 申请并等待审理。'],
 fees:['186 申请费及家属附加费用以官网实时估算为准，可能随年度调整。','职业评估、英语考试、体检、翻译及搬迁为额外成本。'],
 rights:['186 获批后属于永久居民签证，可在澳洲长期生活、工作和学习。','申请永久居留与入籍不是一回事，入籍须满足独立条件。'],
 risks:['并非持有 482 一定能转 186；需单独符合对应通道规则。','雇主担保中的欺诈、虚假工作记录或收费安排具有严重风险。'],
 officialUrl:'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/employer-nomination-scheme-186',
 highlights:['雇主提名','永久居留','通道条件各不相同'],availability:'check-official'
 },
 {
 id:'au-494',name:'偏远地区雇主担保（494）',english:'Skilled Employer Sponsored Regional (Provisional) (subclass 494)',category:'work',
 summary:'由指定区域的雇主提名合格技能人员，持有5年临时签证并在允许的地区就业。符合条件后可能进入另一个永久居留申请阶段。',
 audience:'愿意在澳大利亚政府指定区域工作、获得当地雇主提名、有相应技能和经验的申请人。',
 requirement:['须由指定区域的合格雇主提名，并满足职位与职业清单要求。','Employer Sponsored 通道通常要求至少3年相关全职工作经验及适用职业评估。','一般要求未满45岁，满足英语、薪资、健康及品行规定；部分情况有豁免。','需在指定区域工作，区域范围以官方定义为准，并非所有城市均符合。'],
 documents:['区域雇主的提名与合同、工作所在地证明','职业评估与至少3年相关工作经历文件','英语、学历、身份和职业许可（如适用）','健康和品行材料'],
 steps:['确认用工地区是否被澳大利亚规定为 designated regional area。','核实担保雇主、岗位工资和相应职业清单。','准备职业评估、相关工作经历及英语材料。','完成雇主提名与签证申请，并遵守获签后区域工作限制。'],
 fees:['2026-11-04 官方页面主申请人起价 AUD 6,140，家庭申请人另计。','语言考试、职业评估、体检和实际安家费用均需额外准备。'],
 rights:['通常为5年临时签证，仅限规定区域的居住与工作安排。','符合条件且持有签证3年后，可检查 191 类别永久居留资格；不是自动转永居。'],
 risks:['494 与 491 同为地区路径，但一个主要由雇主提名，另一个侧重州担保或合格家庭成员支持。','签证岗位、工资及指定地区可能发生变化。'],
 officialUrl:'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-employer-sponsored-regional-494',
 highlights:['区域雇主提名','一般至少3年相关经验','临时5年'],availability:'check-official'
 },
 {
 id:'au-189',name:'独立技术移民（189）',english:'Skilled Independent (subclass 189)',category:'residence',
 summary:'不需要雇主或州政府提名的积分制技术移民签证，但需要有符合条件的职业和职业评估，经 SkillSelect 邀请后才能申请永久居留。',
 audience:'职业在适用技术职业清单上，达到技能评估及英语要求，并具有竞争力积分的申请人。',
 requirement:['必须符合对应的技术职业名单并取得有效职业评估。','积分制通道通常要在受邀时不满45岁，且具备相应英语能力。','通过 SkillSelect 提交 EOI，最低通常需65分才具备邀请资格；达到65分不保证收到邀请。','邀请后的签证申请须提交能够证明 EOI 所有积分声明的材料。'],
 documents:['职业技能评估结果与职业职责证据','语言考试、学历与完整工作经历证明','EOI 积分依据及获邀记录','护照、健康及品行材料'],
 steps:['先核实本人职业是否在 189 适用职业列表及评估机构。','完成职业评估和英语考试，依据官方积分表计算分数。','提交 SkillSelect EOI，等待可能的邀请。','收到有效邀请后按规定时限通过 ImmiAccount 申请。'],
 fees:['2026-11-04 官方页面主申请人起价 AUD 6,135，具体以移民局支付页面为准。','职业评估、英语、体检、翻译和随行家属费用另计。'],
 rights:['获批后拥有澳大利亚永久居民身份，可在符合签证规则的范围内长期工作和居住。','没有“65分必定移民”的保证，邀请与获签是不同程序。'],
 risks:['积分和职业名单会变化；虚假职业经历与夸大英语结果可能使申请无效。'],
 officialUrl:'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189',
 secondaryUrl:'https://immi.homeaffairs.gov.au/visas/working-in-australia/skillselect/expression-of-interest',
 highlights:['无需雇主担保','职业评估+积分','需获邀请'],availability:'check-official'
 },
 {
 id:'au-190',name:'州或领地提名技术移民（190）',english:'Skilled Nominated (subclass 190)',category:'residence',
 summary:'在符合职业评估、英语及积分条件之外，还需要获得澳大利亚州或领地政府提名，获邀后申请永久居民签证。',
 audience:'符合某州或领地的职业与本地提名标准，希望以技术移民路径申请永久居留的人。',
 requirement:['必须获得州或领地政府提名，州担保政策和配额分别由当地政府制定。','通常需要对应技术职业的有效职业评估，并在获邀时未满45岁。','SkillSelect 技术移民最低通常为65分，州政府提名会给予5分，但达到最低分仍不保证被提名。','须符合英语、健康、品行及所有受邀条件。'],
 documents:['有效职业评估和英语成绩','EOI及对应州/领地提名申请材料','学历、工作经验和积分依据','护照、体检和无犯罪证明'],
 steps:['对比各州职业名单与额外提名条件，不把联邦标准等同州标准。','完成职业评估和英语证明，提交 SkillSelect EOI。','按目标州要求申请或等待提名，并确认邀请。','获得有效邀请后按官网程序递交190签证申请。'],
 fees:['联邦签证、州担保、职业评估和语言考试费用需要分别核对。','州政府可能有单独申请费；未确认前不能将其写为固定收费。'],
 rights:['获批为永久居民签证；应遵守州或领地提名承诺。','提名不等于获邀或获批，真正签证由澳大利亚政府裁定。'],
 risks:['各州职业和开放窗口与移民局政策不完全相同，不应宣传“买州担保名额”。'],
 officialUrl:'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-nominated-190',
 secondaryUrl:'https://immi.homeaffairs.gov.au/visas/working-in-australia/skillselect/expression-of-interest',
 highlights:['州/领地提名','通常65分起','永久居留'],availability:'check-official'
 },
 {
 id:'au-491',name:'偏远地区技术移民（491）',english:'Skilled Work Regional (Provisional) (subclass 491)',category:'residence',
 summary:'适用于有州或领地地区提名、或符合资格的家庭成员支持的技术人才；签证为临时性质，之后需另外满足永久居留资格。',
 audience:'具备技术职业技能并愿意在规定偏远地区长期生活和工作的申请人。',
 requirement:['必须获得符合要求的州/领地政府提名或合格家庭成员支持。','须有相关技术职业的有效职业评估、英语能力和邀请。','适用技术移民积分制度，通常须满足至少65分门槛及年龄限制。','必须遵守指定区域居住、工作和学习等签证条件。'],
 documents:['职业评估结果、语言成绩、学历和工作记录','州/领地提名或合格家庭支持证据','SkillSelect EOI与正式邀请','身份、健康和品行材料'],
 steps:['核对候选职业清单和地区要求，确认州/家庭支持路径。','准备技能评估、英语及积分材料，完成EOI。','依相应提名程序取得提名或合格支持并等待邀请。','收到正式邀请后在 ImmiAccount 申请签证并遵守区域限制。'],
 fees:['2026-11-04 官方主申请人起价 AUD 6,140，另有可能的州担保、职业评估及语言费。'],
 rights:['获批后通常可在指定偏远地区居住、工作和学习5年。','符合另行适用条件者可在持签3年后申请191永久居留签证，但不是自动转换。'],
 risks:['不是所有州、城市或工作岗位都符合指定地区规定。','提名及积分门槛满足后仍可能没有邀请或签证批准。'],
 officialUrl:'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-work-regional-provisional-491/',
 secondaryUrl:'https://immi.homeaffairs.gov.au/visas/working-in-australia/skillselect/expression-of-interest',
 highlights:['州担保或合格家庭支持','偏远地区','5年临时签证'],availability:'check-official'
 },
 {
 id:'au-500',name:'留学学生签证（500）',english:'Student visa (subclass 500)',category:'study',
 summary:'获得符合要求的澳大利亚教育机构正式入学确认并具备资金、保险及真实学习目的后，可申请学生签证；不等于毕业自动能工作或移民。',
 audience:'有真实课程录取、能够负担学费和生活成本，计划赴澳全日制学习的人。',
 requirement:['必须持有符合要求的 Confirmation of Enrolment（CoE）或适用例外情况。','符合 Genuine Student（GS）要求，以及足额资金、OSHC 保险、英语与健康品行等适用条件。','2026-10-02 起对多数在澳境内提交新的500签证申请实施更严格限制，须检查当前申请地点要求。','在读工作通常每两周最多48小时，研究型硕士和博士等有特殊规则；以签证条件为准。'],
 documents:['正式 CoE、学校费用及课程资料','英语、学历、真实学习目的说明','资金和OSHC保险证明','护照、健康、品行等材料'],
 steps:['先核查学校课程是否具有 CRICOS 注册信息及真实学费。','获得录取和 CoE，综合核算学费、住宿、生活和保险费用。','准备 GS、语言、资金和健康品行材料，并确认可否境内申请。','通过 ImmiAccount 申请、缴费及按要求补充文件。'],
 fees:['2026-11-04 官方学生签证主申请人起价 AUD 2,500；符合特定条件者可能有费用优惠。','学费、OSHC保险、住宿、交通和生活费另算，不应把签证费当出国总预算。'],
 rights:['符合签证许可可在澳大利亚修读合格课程并按许可条件从事部分工作。','留学并不保证毕业工作签证、雇主担保或永居。'],
 risks:['务必注意 2026-10-02 生效的境内申请限制，旅游签转学生签的宣传尤其需要核实。','警惕收款后不提供合法 CoE 或保证后续移民的中介。'],
 officialUrl:'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500',
 highlights:['真实CoE课程','学费+生活费核算','工作小时受限'],availability:'check-official'
 },
 {
 id:'au-485',name:'毕业后临时工作签证（485）',english:'Temporary Graduate (subclass 485)',category:'work',
 summary:'部分完成合格 CRICOS 澳洲课程的毕业生，可以在满足签证历史、英语和年龄条件后申请指定通道的临时工作签证。',
 audience:'已在澳大利亚完成符合要求的学历且通常在境内申请、希望毕业后合法工作的国际学生。',
 requirement:['须完成符合要求的 CRICOS 注册课程，符合相应 Post-Higher Education Work 等通道资格。','通常需35岁或以下，少数学历或护照类别有例外。','须在规定窗口内持有过符合要求的 Student visa，符合英文、健康保险和品行规定。','主要申请人通常需要在澳大利亚境内申请；已持有某些历史签证者可能不再符合首签资格。'],
 documents:['完成课程的证书/学位和成绩单、CRICOS课程及学习要求证据','现有及历史学生签证和合法在澳身份资料','英语结果、AFP无犯罪申请证据、健康保险','护照及所需健康/品行材料'],
 steps:['在选择澳洲课程之前就先核实该课程是否可能满足毕业签证条件。','毕业时及时确定正确通道及签证期限，不要混用旧版政策。','准备课程完成、语言、保险、AFP证明并确认申请地点。','在合法停留期内按移民局流程提交485申请。'],
 fees:['485 官方费用会因通道、家属及年份变化；必须在申请前通过移民局 Visa Pricing Estimator 核实。','额外准备英语、健康保险、澳洲无犯罪、生活费和求职费用。'],
 rights:['Post-Higher Education Work 通道通常可暂时在澳大利亚生活、学习和工作2至3年，具体根据学历和当前政策。','获签不保证岗位，也不直接产生永久居民资格。'],
 risks:['不是所有澳洲学校、证书或网课都符合485条件，课程和签证历史必须查明。'],
 officialUrl:'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/temporary-graduate-485',
 highlights:['毕业后临时工作','须符合澳洲学习条件','年龄通常≤35'],availability:'check-official'
 },
 {
 id:'au-462-china',name:'中国公民打工与度假（462）',english:'Work and Holiday (subclass 462) — China',category:'experience',
 summary:'面向符合条件的中国护照持有人，可申请最多12个月赴澳工作与旅行。2026—27年度首次申请须先登记抽签；本年度登记窗口已关闭。',
 audience:'持中国护照，通常18—30岁，满足教育、英语、资金和其他签证条件，且愿意接受抽签安排的申请人。',
 requirement:['2026—27年度面向中国首签申请人的抽签登记时段为2026-06-04至2026-06-25，官方已标记 Closed。','中国护照持有人通常须在18至30岁（含）区间内完成有效登记。','需满足学业、英语、资金、健康、品行等更详细的签证条件，不能仅凭年龄申请。','只有获得官方随机抽选通知后，才可在通知后规定窗口内申请首个462签证。'],
 documents:['有效中国护照及中国身份证等官方要求的证件','符合要求的学历和英语证明','生活资金、返程/离境资金及健康保险','有效抽签登记及入选通知（首签）'],
 steps:['首先到移民局官方抽签页核对中国当前登记开放状态。','开放时通过 ImmiAccount 注册并支付登记费，不接受私下购买名额。','如被选中，通常在通知后28个日历日内按规定从澳大利亚境外递交首签申请。','获签后按批准条件旅行及临时工作，不能把它当成永居签证。'],
 fees:['2026—27年度抽签登记费 AUD 25，登记不保证中签且与签证申请费不同。','2026-11-04 官方462签证页面主申请人收费 AUD 840，另须考虑资金、保险、交通和生活费。'],
 rights:['首次签证通常允许在澳大利亚停留12个月并从事符合规定的工作与旅行。','通常有同一雇主工作时间等限制；达到特定工作要求可能有第二次申请途径。'],
 risks:['中国2026—27年度首签登记已关闭，不要显示“现在立即登记”或鼓励购买所谓官方名额。','抽签被选中只是获得申请资格，不等于获签。'],
 officialUrl:'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-462/',
 secondaryUrl:'https://immi.homeaffairs.gov.au/what-we-do/whm-program/latest-news/new-work-and-holiday-subclass-462-visa-pre-application-process',
 highlights:['18—30岁','2026—27登记关闭','先抽签后申请'],availability:'closed'
 }
];
export const auCategoriesCount=Object.fromEntries(Object.entries({work:'海外工作',residence:'技术移民/居留',study:'留学深造',experience:'工作与旅行'}).map(([key])=>[key,auPathways.filter(p=>p.category===key).length]));
