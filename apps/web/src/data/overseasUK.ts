/* 2026-11-06 UK Home Office / GOV.UK verified, independently searchable routes.
 * Editorial material only: immigration rules, fees, lists and decisions can change.
 * A sponsor licence is not proof of a live vacancy or a visa guarantee.
 */
import type {OverseasPathway,OverseasCategory} from './overseasNewZealand';
export const ukVerifiedOn='2026-11-06';
export const ukOfficial={
 skilled:'https://www.gov.uk/skilled-worker-visa',
 salary:'https://www.gov.uk/skilled-worker-visa/your-job',
 english:'https://www.gov.uk/skilled-worker-visa/knowledge-of-english',
 rates:'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-skilled-occupations',
 sponsors:'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers',
 occupation:'https://www.gov.uk/government/publications/skilled-worker-visa-eligible-occupations/skilled-worker-visa-eligible-occupations-and-codes',
 skilledFees:'https://www.gov.uk/skilled-worker-visa/how-much-it-costs',
 care:'https://www.gov.uk/health-care-worker-visa',
 careJobs:'https://www.gov.uk/health-care-worker-visa/your-job',
 careFees:'https://www.gov.uk/health-care-worker-visa/how-much-it-costs',
 careClosed:'https://www.gov.uk/government/publications/applying-for-health-and-social-care-jobs-in-the-uk-from-abroad/part-1-applying-for-health-and-social-care-jobs-in-the-uk-from-abroad',
 student:'https://www.gov.uk/student-visa',
 money:'https://www.gov.uk/student-visa/money',
 dependants:'https://www.gov.uk/student-visa/family-members',
 studentEnglish:'https://www.gov.uk/student-visa/knowledge-of-english',
 graduate:'https://www.gov.uk/graduate-visa',
 graduateFees:'https://www.gov.uk/graduate-visa/how-much-it-costs',
 global:'https://www.gov.uk/global-talent',
 globalArts:'https://www.gov.uk/global-talent-arts-culture',
 globalDigital:'https://www.gov.uk/global-talent-digital-technology/eligibility',
 hpi:'https://www.gov.uk/high-potential-individual-visa',
 hpiList:'https://www.gov.uk/government/publications/high-potential-individual-visa-global-universities-list',
 hpiEligibility:'https://www.gov.uk/high-potential-individual-visa/eligibility',
 hpiFees:'https://www.gov.uk/high-potential-individual-visa/how-much-it-costs',
 scale:'https://www.gov.uk/scale-up-worker-visa',
 scaleSalary:'https://www.gov.uk/scale-up-worker-visa/your-job',
 scaleExtend:'https://www.gov.uk/scale-up-worker-visa/extend-your-visa',
 founder:'https://www.gov.uk/innovator-founder-visa',
 founderBody:'https://www.gov.uk/government/publications/endorsing-bodies-innovator-founder-and-scale-up-visas',
 founderSettlement:'https://www.gov.uk/indefinite-leave-to-remain-innovator-founder-visa',
 seasonal:'https://www.gov.uk/seasonal-worker-visa',
 seasonalRules:'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-temporary-work-seasonal-worker',
 creative:'https://www.gov.uk/creative-worker-visa/overview',
 creativeEligible:'https://www.gov.uk/creative-worker-visa/eligibility',
 creativeConcession:'https://www.gov.uk/creative-worker-visa/creative-worker-concession',
 exchange:'https://www.gov.uk/government-authorised-exchange',
 schemes:'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-government-authorised-exchange-schemes',
 senior:'https://www.gov.uk/senior-specialist-worker-visa',
 graduateTrainee:'https://www.gov.uk/graduate-trainee-visa',
 graduateTraineeEligibility:'https://www.gov.uk/graduate-trainee-visa/eligibility',
 family:'https://www.gov.uk/uk-family-visa/partner-spouse',
 familyMoney:'https://www.gov.uk/uk-family-visa/proof-income-partner',
 youth:'https://www.gov.uk/youth-mobility',
 youthCountries:'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-youth-mobility-scheme-eligible-nationals',
 fees:'https://www.gov.uk/government/publications/visa-regulations-revised-table/home-office-immigration-and-nationality-fees-8-october-2026',
 ihs:'https://www.gov.uk/healthcare-immigration-application/how-much-pay',
 tb:'https://www.gov.uk/government/publications/tuberculosis-test-for-a-uk-visa-clinics-in-china'
} as const;
export type UkLine=[string,string,string];
export type UkRoute={
 id:string;name:string;english:string;category:OverseasCategory;summary:string;audience:string;highlights:string[];
 requirements:UkLine[];documents:UkLine[];steps:UkLine[];costs:UkLine[];time:UkLine[];rights:UkLine[];next:UkLine[];
 risks:string[];faq:[string,string][];sourceKeys:(keyof typeof ukOfficial)[];availability?:'closed'|'check-official';
};
/** Each point is "title¦explanation¦what the reader must actually do". */
const lines=(data:string):UkLine[]=>data.trim().split('\n').map((row)=>{const a=row.split('¦');if(a.length!==3||a.some(x=>!x.trim()))throw new Error('Invalid UK guide point: '+row);return a as UkLine;});
export const ukRoutes:UkRoute[]=[
{
id:'uk-skilled-worker',name:'技术工作签证：Skilled Worker',english:'Skilled Worker visa',category:'work',
summary:'已获得英国持牌雇主真实职位与CoS的专业人才路径。2026年新申请通常须同时达到年薪£41,700及该SOC职业going rate中较高者；部分法定例外和职业表单独适用。',
audience:'有可验证的英国雇主、达到岗位技能和薪资标准、能提交有效B2英语证明的境外专业求职者。',
highlights:['通常£41,700与职业标准取高','新申请英语B2','需有效CoS'],
requirements:lines(`持牌雇主与CoS¦英国企业需持与Skilled Worker匹配的有效sponsor licence，并为实际符合资格的岗位签发Certificate of Sponsorship；CoS只是电子记录编号，不是可买卖的offer。¦分别查官方担保名单、雇主法定名称、岗位合同和CoS信息，拒绝私人账户售卖编号。
SOC 2020四位代码¦按岗位真实主要职责确定SOC代码；2025年7月后多数新增岗位要求RQF6或以上，低于该级别通常仅在临时短缺/薪资清单或过渡规定下可申请。¦用官方eligible occupations与Appendix Skilled Occupations核对工作内容、技能层级及是否在当前例外清单。
工资双重门槛¦一般需达到£41,700和该职业going rate中的较高值；新入行者、相关PhD、卫生教育或过渡申请有特定条件，不能简单统一打八折。¦读取SOC对应表格的年薪和标准工时，按雇佣合同实际有保证的工资核算，特殊情况另核Appendix。
英语与个人条件¦2026年1月8日起首次申请等情形通常须证明CEFR B2四项能力；部分原有持签者续签可适用过渡B1规定。¦选择符合规定的SELT或Ecctis学历证明，先检查自己是否符合豁免，不用普通英语培训结业证代替。`),
documents:lines(`岗位证据¦确认雇佣合同、工资、工作时间、真实SOC职责、CoS编号、雇主有效资质。¦把合同字段逐条与申请表和官方职业代码对照；向HR问清工资、工时和工作地点。
语言学历¦提供通过认可英语考试、合格英文授课学位及Ecctis核验等适用的证据。¦核对B2有效证明及学历评估结果，保存编号而不是只上传照片。
身份与资金¦提供有效护照、如适用的中国TB体检结果、未豁免时的£1,270维持资金以及家属材料。¦检查28天持有、31天结束窗口和译本要求，按官方指定诊所办理TB。`),
steps:lines(`1. 判断职位能否担保¦SOC职业资格、going rate、雇主许可、工资与英语必须同时合格。¦做职业代码、薪资、雇主、个人语言四栏检查表。
2. 核实雇佣与分配CoS¦雇主签发CoS并载明正式职位、实际工资与工作日期；担保不保证签证批准。¦仅通过持牌雇主正规招聘渠道确认offer和编号，留存正规联系方式。
3. 整理证明并线上递交¦按申请地选择Skilled Worker官方在线表，提交护照、语言、资金、必要体检和真实任职资料。¦在gov.uk进入申请界面并用UKVI账户提交，逐字段复核。
4. 缴费并等待官方决定¦按境外或境内申请、签证年限和IHS计算费用，可能需要签证中心身份验证。¦记录申请编号、付款收据和补件通知，在正式许可前不要擅自就业。`),
costs:lines(`政府申请费¦2026境外申请普通Skilled Worker：不超过3年£819、超过3年£1,618；境内通常为£943或£1,865，薪资清单另有收费标准。¦申报时以gov.uk实时fees核算，区别境内外及主申请人、家属。
IHS与到达资金¦一般IHS每年£1,035，另通常需要证明£1,270可支配资金（如雇主在CoS担保维持资金可例外）。¦按签证实际长度算IHS，资金证明不能作为已支付签证费。
其他开支¦英语考试、Ecctis、TB检查、翻译和机票住宿另算；不应向雇主购买CoS或受雇资格。¦单列法定签证费用与私人服务费用，拒绝所谓“包担保”。`),
time:lines(`岗位与证明准备¦找真实职位、语言考试、学历或职业注册耗时因人而异。¦优先处理雇主真实性和SOC匹配，不按中介“7天出签”安排。
最早申请节点¦一般最早在CoS所示英国工作开始日期前3个月申请，按官方申请页执行。¦确认CoS签发和职位生效时间，妥善安排离职与机票。
审批和补件¦标准处理时间、优先服务与个案核查可能改变。¦以gov.uk实时processing times及自己的UKVI通知为准，勿先订不可退行程。`),
rights:lines(`雇佣与附加工作¦主许可主要围绕被担保的雇主和具体职位，补充工作有严格条件。¦查看获批eVisa及Skilled Worker附加工作规则，变更雇主前判断是否需更新签证。
家属与公共资金¦伴侣和子女是否能随行受职业等级、签证时点和单独资格限制，通常不能领取公共福利。¦为每位家属独立查条件、签证费、IHS与资金。
居留不是自动获得¦这类路线存在按现行法规评估定居的可能，但永居不是满年份自动发放，未来改革须以已生效规则为准。¦保存合法居留、实际出入境与工资记录，临近时查询实时ILR规则。`),
next:lines(`升职或换雇主¦新职责、工资或雇主发生重大变化，可能需要新CoS及更新签证。¦在变更前查Skilled Worker update your visa，确保新岗位仍合规。
工资不达标¦不要用提成、未保证加班或虚假合同弥补最低薪资。¦先核对是否属于法定豁免；否则考虑其他合法签证或真实不同岗位。
长期定居规划¦应定期关注移民规则与实际认可居留时段。¦不承诺5年必得永居，依据未来有效的ILR官方要求申请。`),
risks:['英国合法担保雇主名册是许可记录，不等于该企业正在招聘或愿意提供CoS。','工资通常要同时满足£41,700与对应SOC going rate；销售签证和虚构职位属于高风险行为。','2026首次Skilled Worker申请通常要求英语B2，不可套用旧B1攻略。'],
faq:[['只有offer，没有CoS能直接办吗？','通常不能。需要有效的英国持牌担保雇主与CoS及其他个人资格。'],['薪资£41,700就一定符合吗？','未必，若SOC going rate更高就按更高金额；部分特殊折扣有额外严格资格。']],
sourceKeys:['skilled','salary','english','occupation','rates','sponsors','skilledFees','ihs','tb']
},
{
id:'uk-health-care',name:'卫生与医疗专业工作签证',english:'Health and Care Worker visa',category:'work',
summary:'面向有资格的医生、护士、医疗及适用社会照护专业人员，需有合规NHS/医疗领域持牌雇主的真实工作邀请。2025年7月22日起护理工与高级护理工不再接受新的海外直接招募申请。',
audience:'持有符合监管机构要求的资格、准备与NHS或合规机构签约的医学及健康专业人才；不适用于从国外直接买护理员担保岗位。',
highlights:['医生护士等合格职业','特定岗位有NHS薪资表','海外护理工新申请关闭'],
requirements:lines(`医学岗位与监管职业¦医学、护理等必须有对应合格SOC类别，部分职位需要先取得GMC、NMC或HCPC相关注册；学位不自动取代当地执业许可。¦明确职业监管机构、职业代码、执照认证和英语测试要求。
海外护理员封闭规定¦从2025年7月22日起care workers与senior care workers新增海外担保渠道关闭；某些英国境内转换设置有严格过渡条件。¦若人在中国，不能相信“2026从海外直接办护理员签证”的宣传；先查官方公告。
真实医疗雇主和薪资¦需合资格NHS、NHS服务机构或其他合规医疗/照护雇主给出CoS，工资遵守相应最低薪资或NHS工资表。¦核对雇主资质、SOC、实际薪水和监管牌照。
英语及个人条件¦通常需满足现行英语门槛；专业监管机构认可的测试对某些医疗专业可使用特定豁免。¦分别查UKVI工作签证语言和职业监管机构的英语标准，避免考试类型错误。`),
documents:lines(`雇佣与职业资质¦完整CoS、雇佣合同、实际工作职责、护理或医学注册证明。¦把职业名与GMC/NMC/HCPC等实际适用监管机构对应，检查许可状态。
语言与履历¦所需英语证明、职业资格、实习工作经历、必要背景和无犯罪材料。¦严格按医疗行业官方及签证官方双清单准备。
身份与维持资金¦有效护照、£1,270资金证明或合格雇主担保豁免、适用的TB检查。¦如带家人，先核实工种是否允许家属以及个人材料，不假设全都允许。`),
steps:lines(`1. 找到具体可申请医疗职业¦将资格对应至官方健康签证职业表、英国监管注册要求和当前招聘。¦先核对真实医院部门或专业诊疗机构的岗位代码。
2. 取得真正的工作邀请¦核查NHS或其他医疗雇主担保资质、工资和岗位，取得CoS。¦与机构官方HR沟通，不给招聘中介转账购买工作机会。
3. 办好注册及语言¦在需要时办理职业资格注册、语言、背景审核，再准备签证资料。¦保留监管机构注册编号与证书来源。
4. 提交健康签证¦在英国政府相应页面申请并缴纳实际适用的费用。¦身份核验后等待移民局决定，不要将职业牌照视为签证批准。`),
costs:lines(`较低签证费¦2026官方健康签证：不超过3年£324，超过3年£628（每人），实际以最终申请表为准。¦区别健康签证与普通Skilled Worker费率。
IHS豁免¦符合Health and Care Worker类别的本人和合格家属通常免交Immigration Health Surcharge。¦先核验真实签证类别，不因工作地点在医院就推定必然免IHS。
职业资格开支¦NMC/GMC/HCPC相关注册及语言考试、体检、机票住宿仍可能收费。¦逐项从监管机构官网取价，不向个人购买工作邀请。`),
time:lines(`专业注册前置¦有监管要求的职业可能需要考试、学历审核或注册。¦先确认注册周期，再协调真实雇主工作开始日。
CoS与正式申请¦获得真实CoS后准备英国医疗签证表与个人资料。¦按CoS日期和官方规定判断何时可以申请。
审理时间不保证¦文件、背景和监管资格可能导致补件。¦使用官方实时审理时间；不上述时间作获签承诺。`),
rights:lines(`医疗岗位的工作权限¦可以在获批范围内工作，变更担保雇主或岗位可能需更新许可。¦检查eVisa条件和职业注册有效期。
家属与福利¦特定护理/社会照护岗位的家属限制尤其严格，医疗岗位亦需按工种判断。¦带配偶子女前逐条查官方签证家属要求。
未来转签或定居¦需满足适用居留签证的现行条件，并非从业一定时间自动获永居。¦保留连续工作、有效许可、工资和出入境记录。`),
next:lines(`医疗岗位深造¦提高执业资质可以扩大合法岗位范围，但可能需新职业注册。¦向对应监管机构查看更高职级资格。
雇主变更¦若雇主、工作代码或职业活动变化，先查是否需新CoS。¦申请更新签证后再按许可就业。
受限制的护理员路径¦不将英国境内过渡条款当作中国境外可直接申请的途径。¦如在海外应转查其他真正合规的健康专业职位。`),
risks:['2025年7月22日护理工及高级护理工海外新申请关闭，避免2026骗局。','职业注册及从事岗位的资格必须独立审核，不能购买所谓NHS聘书。'],
faq:[['我在国内做养老护理可以直接申请吗？','2025年7月22日起，care worker/senior care worker新海外申请关闭；境内过渡适用人群与条件另查。'],['健康签证是否免IHS？','符合Health and Care Worker签证的本人及合格家属通常可豁免，但不能以普通医疗行业工作代替签证资格。']],
sourceKeys:['care','careJobs','careFees','careClosed','sponsors','tb']
},
{
id:'uk-student',name:'英国大学与研究生留学签证',english:'Student visa',category:'study',
summary:'取得持牌教育机构的真实课程录取及CAS后，按照学历、英语、学费和生活费证明申请。2026年伦敦生活资金£1,529/月、非伦敦£1,171/月，最多按9个月核算。',
audience:'准备攻读英国本科、硕士、博士或合格其他课程，希望清楚计算申请与生活成本的国际学生。',
highlights:['真实CAS与持牌学校','伦敦£1,529/月','家属资格严格'],
requirements:lines(`学校与CAS¦取得有Student sponsor资格的教育机构录取和有效Confirmation of Acceptance for Studies（CAS），并确认课程符合签证允许的等级。¦查学校学生担保资质、课程级别、录取要求及CAS编号。
英语要求¦学位课程通常要求CEFR B2，低于学位的课程通常B1；部分高等教育机构可自行评估英语能力。¦按CAS上的学校要求和UKVI认可渠道验证，不简单认为所有学校都要统一雅思分。
留学资金证明¦学费按CAS列明的首学年费用；生活费按伦敦每月£1,529、非伦敦每月£1,171，至多9个月计算。¦把CAS学费减去合格已付款，再按校区位置核算生活费，注意28天持有与证明期规则。
家属限制与ATAS¦2024年后多数新授课型硕士不再自动可带家属；通常仅符合资格的研究型研究生、博士或政府资助学生等例外可考虑。部分敏感学科须有ATAS。¦在定校前查研究型课程性质、政府担保和ATAS及家属条件。`),
documents:lines(`录取与课程材料¦CAS编号、学校录取及学费缴纳记录、课程所在城市、必要ATAS证明。¦核对CAS的姓名、课程、学校、开始结束日和付款。
资金与语言¦银行资金证明、奖学金或官方允许的贷款/担保、符合CAS的语言证明。¦按英国官方Financial Evidence说明核实持有期限、币种及资产可用性。
身份与翻译¦护照、受要求的中国TB体检和合规英语翻译；低龄或特殊专业另有证明。¦检查护照有效期、TB指定诊所及非英文原件翻译。`),
steps:lines(`1. 选真正认可的学校与课程¦比较学校sponsor status、学费、毕业后目标及城市生活成本。¦先拿到真实课程信息与招生部门官方确认，拒绝伪造CAS。
2. 获录取及正式CAS¦向学校完成录取条件、押金及学历要求后，由学校签发CAS。¦核对CAS有效性及课程开始日期后再申请。
3. 计算资金与材料¦把首学年学费、九个月生活费、IHS、签证费、租房机票分开算。¦分别保存学费收据、银行流水与奖学金文件。
4. 官方在线申请¦按境内外规则完成Student visa申请、支付£558及IHS，完成身份验证。¦在收到签证批准与eVisa信息后，按入境日期安排实际行程。`),
costs:lines(`签证费与IHS¦2026 Student visa申请费£558，学生IHS通常£776每年；实际缴费按签证准许的期限计算。¦不要只按课程12个月计算IHS，也不能用录取押金抵签证费。
资金最低额¦伦敦最多£13,761（£1,529×9），非伦敦最多£10,539（£1,171×9），还需CAS显示的合格学费。¦根据真实校址和付款记录做英镑表，注意学校已收款与资金要求例外。
真实留学总成本¦学费、租房押金、生活、交通及考试或ATAS相关材料开支因学校和城市而异。¦制作按学校分别计算的税费和现金流预算，不宣称统一低价。`),
time:lines(`申请时点¦境外通常可在课程开始前最多6个月申请；CAS通常需要在签发后6个月内用于签证申请。¦以官网和CAS实际日期制定考试、存款、签证时间线。
资金证明时间¦多数需满足连续28天持有，资金期末距申请通常不超过31天，可能有例外。¦保留银行流水和必要的贷款/奖学金证据。
行程与入境¦准许提前入境的时间取决于课程长度，未获准不得凭录取信入境工作。¦以实际签证起始日和课程开学日为准买机票。`),
rights:lines(`学期间工作¦符合条件的学位全日制学生学期中一般最多每周20小时，假期规则另有规定，职业和自雇亦有限制。¦严格检查eVisa限制、学校考勤与课程性质。
家属与福利¦多数授课型硕士新生没有一般性的带家属资格，持Student签证一般不能领取公共福利。¦如家庭计划重要，先查research-based或政府资助例外。
毕业后路径¦持Student完成合资格课程并由学校向Home Office报告成功完成后，可能符合Graduate visa。¦在选课程之初核实Graduate条件，不能保证毕业必有工作。`),
next:lines(`毕业时间衔接¦Graduate visa的2027年1月起新18个月规则可能影响择校与就业准备。¦根据真实毕业和实际Graduate申请日期规划招聘，而不是沿用旧两年预期。
企业担保路线¦毕业后可能申请Skilled Worker，但雇主、薪水、SOC及语言重新审查。¦就读中按官方担保企业名单研究真正岗位。
更高学历研究¦读博或研究可涉及ATAS、额外资金与家属资格差异。¦逐条验证学校CAS和英国政府签证要求。`),
risks:['授课型硕士不能一般性地假定有携带配偶子女权利。','奖学金、资金余额、CAS与课程是否在英国境内必须真实对应。'],
faq:[['非伦敦一年只需£10,539吗？','不是。这是通常最多9个月的生活资金证明部分，仍需CAS上的首学年学费、签证费、IHS及实际生活开支。'],['读完硕士自动给两年工签吗？','不是。须满足Graduate签证条件且在Student签证到期前申请；2027年起非博士新申请仅18个月。']],
sourceKeys:['student','money','studentEnglish','dependants','graduate','ihs','tb']
},
{
id:'uk-graduate',name:'英国毕业生工签：Graduate Visa',english:'Graduate visa',category:'work',
summary:'仅限英国境内符合条件且大学已向Home Office报告成功完成课程的Student毕业生；2026年12月31日前申请通常2年，2027年1月1日起通常18个月，博士3年。',
audience:'已经在英国完成合规高教课程、持有效Student/Tier4签证、准备在英国求职的毕业生。',
highlights:['须在英国境内申请','2027起一般18个月','不是永居签证'],
requirements:lines(`英国境内合法Student身份¦必须在英国申请，当前持有Student或原Tier 4 General，且在合法许可到期前提出申请。¦核对目前eVisa过期日，不要离境后才试图申Graduate。
课程与完成证明¦合格学位或符合规定的课程须达到规定学习时长，大学已告知Home Office完成课程。¦从大学国际学生办公室取得成功完成并完成报告的确认。
毕业工签期限改革¦在2026年12月31日或之前递交的符合条件非博士申请通常2年；2027年1月1日起递交通常18个月；博士仍3年。¦明确按实际递交申请日期判断，不按毕业日期或学校宣传。
不能无限申请或续签¦Graduate不允许直接延长，也不是所有网课、交换生或语言学校都符合要求。¦在当前签证有效期内核对资格，不要盲目续签。`),
documents:lines(`当前Student许可与身份¦有效护照、BRP/eVisa或UKVI身份信息，以及当前Student签证的相关CAS。¦确认本人处于英国境内且没有超期停留。
课程成功完成记录¦学校通过官方系统通知Home Office，申请人通常无需等待毕业典礼。¦向大学确认“successful completion reported”，保存学校通知。
家庭成员和费用¦家属可申请的范围受已有身份和规则限制，不能任意增加新随行人。¦独立确认每位现有家属是否符合转换资格。`),
steps:lines(`1. 提前确认学校报告¦先问大学是否向Home Office确认合规课程完成。¦不要仅凭预计毕业或论文提交就提前申请。
2. 核查日期与当前许可¦在英国境内、Student到期前申请，并明确2026/2027期限交界。¦把申请日期与2027年1月1日分界点登记清楚。
3. 官方网上申请及费用¦UKVI Graduate在线申请，支付£937及按获批年限计算的IHS。¦核对UKVI账户身份、家属和付款记录。
4. 等候获批并择业¦申请过程中遵守现有合法状态及规则，获得批复后再以Graduate权利工作。¦持续保留合法身份及雇主合同。`),
costs:lines(`官方申请费¦2026年Graduate申请费£937，和学费、学校毕业费用无关。¦在gov.uk确认提交时的适用费用。
医疗附加费¦18个月期官网显示IHS £1,552.50；2年£2,070；博士3年£3,105。¦按实际准许的签证时长计算，不只看每年£1,035。
求职及搬迁¦伦敦及其他城市住宿押金、搬迁和面试交通另行估算。¦确保没有职位也能维持合理生活，别将毕业工签视为就业保证。`),
time:lines(`校方报告前不能盲申¦预计毕业与Home Office收到校方完成报告存在时间差。¦询问大学国际学生办公室报告节点。
新期限生效日¦2027年1月1日是一般18个月期限的递交日期分界，而不是大学开学日期。¦保存实际递交凭证、日期与签证有效期。
审批过程¦签证处理速度随申请量和身份核查变化。¦在审批期间查看UKVI消息，不先承诺开始工作日期。`),
rights:lines(`工作与求职¦获签后一般可在英国求职、多数工作及自雇，职业运动员等受限制。¦对照获批条件，必要时另查受监管职业执照。
不能续Graduate¦Graduate本身不能延期，也不直接作为某些常见定居路线的年限计算。¦提前研究下一步Skilled Worker或其他合法长期路线。
家属资格¦一般只有符合条件的既有Student家属能续为Graduate家属。¦按照申请时的家属清单核实。`),
next:lines(`转Skilled Worker¦拿到符合职业、工资和担保要求的英国工作邀请后可在符合条件时转换。¦优先寻找真实持牌雇主岗位并确认SOC与薪资。
进一步进修¦如要读新课程须查看Student签证条件及转换限制。¦不要把Graduate身份自动当成新的Student许可。
合法离境计划¦在Graduate许可到期前获得新签证或离境，防止超期。¦将所有求职和签证截止日纳入日历。`),
risks:['Graduate Visa只能在英国境内由合格的Student毕业生申请，海外毕业证不可直接申。','2027年新申请一般18个月，旧攻略的“两年”已不通用。'],
faq:[['2026年毕业但2027年1月申请是多少个月？','非博士通常18个月，关键是申请日期而不是毕业日期。'],['毕业就能申请不需要学校确认吗？','须由教育机构先向Home Office成功报告课程完成，且其他资格齐备。']],
sourceKeys:['graduate','graduateFees','student','ihs']
},
{
id:'uk-global-talent',name:'全球人才签证：科研、科技与艺术',english:'Global Talent visa',category:'work',
summary:'面向学术科研、数字技术、艺术文化中的杰出人才或潜力人才；通常需经指定认可机构背书，或持官方认可的特定著名奖项。不能买所谓人才证书。',
audience:'能提供已认可成果、推荐信和行业证据的研究者、科技创新者、设计师及艺术创作者。',
highlights:['科研/数字科技/艺术','一般需要endorsement','不要求普通雇主担保'],
requirements:lines(`专业领域限额¦Global Talent覆盖学术研究、艺术文化与数字技术，所涉资格和证明标准不同。¦根据科研/艺术/数字科技选择真正适用的官方分轨。
背书或特定奖项¦多数申请人先获得授权机构endorsement；只有列名的获奖者才可能免背书。¦对照官方endorsing body及eligible prestigious prizes，不买假背书。
实际成果证据¦数字科技需证明创新和影响力；艺术领域按Arts Council及指定协会要求提交代表作和相关资历；学术按各机构制度。¦把每项出版、媒体、项目、获奖、行业推荐与官方标准逐条映射。
年龄与个人签证资格¦通常申请人至少18岁，仍须符合身份、适用健康/品行及签证要求。¦核验自己是exceptional talent还是promise或其他特定项目。`),
documents:lines(`行业推荐与官方认可¦按分轨整理推荐信、代表作、雇佣/行业资历、认证信或可接受奖项证明。¦使用每个认可机构自己的最新材料数量与格式。
身份文件¦护照、适用TB证明、非英语文件翻译及家庭申请证明。¦检查申请地点与所需证件，不把LinkedIn展示当作官方证书。
背书申请结果¦有endorsement须保存有效官方背书编号及要求；奖项免背书则需证明本人获指定奖项。¦在签证申请前逐项核对官方要求。`),
steps:lines(`1. 先确定申请分轨¦选择学术、数字科技或艺术文化；各自具体标准不同。¦研究该领域真正认可的endorsing body和标准。
2. 准备证明材料¦整理专家推荐、成果、影响力、奖项及领域内同行认可记录。¦按证据清单做文件索引，杜绝假奖项或购买推荐。
3. 申请背书或验证奖项¦需要背书者提交官方endorsement评估；可免背书的列明奖项持有人走其他流程。¦留存申请和裁决材料，不混用科研及艺术类标准。
4. 完成正式签证程序¦获得可用背书后通过GOV.UK申请Global Talent并按要求交费和IHS。¦检查背书有效期限及家庭成员不同材料。`),
costs:lines(`政府申请费¦总申请费£766；需要背书通常分£561背书+£205签证两个阶段，免背书奖项申请直接付£766。¦区分背书失败风险与后续签证申请费。
IHS和生活费¦多数申请人仍需按英国移民健康附加费规则缴费，通常£1,035/年。¦按真实签证年限、本人家属分别计算。
成果与翻译成本¦可能涉及作品整理、合法认证翻译等费用，但不应购买奖项。¦只支付实际需要的官方流程或合规服务费用。`),
time:lines(`资料与评审¦成果背书申请往往比填写签证表更耗时；没有统一保证时长。¦先按官方最新文件清单计划推荐信与资料。
背书与签证两个阶段¦endorsement不代表签证已获批准，提交应留意背书有效期。¦分别记下背书申请及签证申请状态。
境外/境内审理¦各类申请有不同标准处理时间，官方通常给出境外约3周、境内约8周参考但不可保证。¦以政府实时审理信息和个案通知安排。`),
rights:lines(`工作方式灵活¦此签证一般允许自由受雇、自雇或创办业务，具体以获签条款为准。¦在开展工作前确认职业监管要求。
家属与续签¦符合规则的家属可申请，通常一次最多可申请5年并可续签。¦独立核验家属费用、IHS、工作权。
定居资格因分轨不同¦部分Global Talent持有人可在3年或5年时考虑ILR，必须同时满足实际规则。¦按签证路径、合法居住和具体证明规划，不承诺保证拿永居。`),
next:lines(`行业影响力积累¦申请中的获奖/项目/科研成果应持续真实、可验证。¦保存工资、合作合同、媒体、研究成果的原始证据。
定居评估¦合格Global Talent特定分轨与年限可申请ILR。¦临近时根据最新GOV.UK移民规则逐条核对。
不合格时替代¦缺少背书基础可考虑正规雇主担保工作或进一步研究深造。¦不要借假奖项快速申请。`),
risks:['“全球人才卡”“买一张艺术背书证”均不是英国官方路径。','研究、艺术、科技三条分轨不可混用同一个资格清单。'],
faq:[['普通舞蹈设计专业毕业即可办吗？','仅有专业学位通常不足；须证明对应领域的国际行业影响力、潜力或其他官方条件，并满足认可机构标准。'],['不需要英国雇主吗？','该路径通常不以普通Skilled Worker雇主担保为前置，但仍需背书或指定奖项等法定资格。']],
sourceKeys:['global','globalArts','globalDigital','fees','ihs']
},
{
id:'uk-hpi',name:'世界优秀大学毕业生：HPI',english:'High Potential Individual visa',category:'work',
summary:'毕业学位授予时所属学校须列在对应年度英国Global Universities List，且学位在申请前5年内取得；通常无需英国工作offer，但有年度申请上限8000人。',
audience:'过去5年从英国认可的全球大学获本科及以上学位，愿意自行承担赴英求职成本的人。',
highlights:['无需英国工作offer','必须查授予学位当年名单','年度上限8000'],
requirements:lines(`按学位授予日期查学校¦2026名单只适用于2026年11月1日到2027年10月31日授予的学位，不可用于2023或2025年毕业资格。¦选择政府官方对应毕业年度Global Universities List，而不是拿今天榜单倒推。
5年、学历和Ecctis¦合格海外学士/硕士/博士水平学位须申请前5年内获得并由Ecctis核定学历等级。¦核对学位证实际授予日及学校在对应名单，并准备Ecctis证明。
语言B2与资金¦通常需英语B2及£1,270维持资金（符合12个月合法在英许可的例外另查），加护照及适用体检。¦提前核实认可SELT或Ecctis语言证明和28天存款期。
年度限额与不可重复¦2026年规则对HPI设定每年度8000申请上限；此前已经获HPI、Graduate等身份者可能不符合。¦提交前查看当前年度配额、过往签证与有效资格。`),
documents:lines(`学校名单和学位¦真实海外院校学位证、授予日期、官方适用年份名单和Ecctis评估。¦至少保存官方名单与Ecctis出具的电子认证。
英语与资金¦B2证明、£1,270维持资金证明（如适用）、有效护照及TB证书。¦核对证明有效日期和资料原件。
家属信息¦符合条件的配偶子女分别准备关系、资金及身份材料。¦以各人当前HPI规则确定是否能同行。`),
steps:lines(`1. 准确选择毕业年份清单¦先证明毕业学校在“授予学位那段日期”对应官方名单。¦用学位证上的授予日匹配正确官方清单。
2. 办理Ecctis及英语¦查学校合规后再投入评估费用，不是大学排名较高就有资格。¦准备学位材料和必要英语证明。
3. 核对配额和签证历史¦一年8,000名额限制、过往Graduate/HPI使用情况可能决定能否申请。¦进入官方申请系统检查实时上限状态。
4. 在线递交与就业规划¦无需先拿offer，但仍要承担找工作和生活成本。¦支付申请费与IHS后跟踪结果，不承诺可在英国找工作成功。`),
costs:lines(`官方金额¦2026年Ecctis学历检查£252（含税）、HPI申请费£880，分项收费。¦以官方在线价格为准，评估失败可能不能退款。
IHS¦HPI两年通常£2,070 IHS，博士三年通常£3,105。¦按真实签证期限在提交前准备现金流。
生活启动金¦通常需要£1,270维持资金；赴英寻找工作的实际租房和生活成本很可能更高。¦估算至少数月无收入开支。`),
time:lines(`毕业5年截止¦以学位授予日期和正式申请日比较，而不是入学时间。¦把本人5年期限标记清楚。
年度配额¦年度从每年11月1日至下一年10月31日，须查实时名额。¦不要支付所谓预约配额或包名额费用。
审批与签证期限¦符合条件的学士/硕士签证通常2年，博士3年；不支持延期HPI本身。¦在有效期内规划下一签证。`),
rights:lines(`通常无需雇主担保¦HPI获得批准后一般可以在规定范围求职、工作与自雇，个别职业限制另查。¦获批后查看eVisa完整工作条件。
不能延长与定居计时¦HPI不得直接延期，HPI时间不计入其对应的定居资格年限。¦尽早规划后续Skilled Worker、Global Talent等可行合法路径。
可携带家属需单核¦家属按移民局规则申请并支付相关费用。¦别仅凭主申请人获批就默认家属入境。`),
next:lines(`找到合适工作¦真实岗位若符合SOC、薪资、雇主许可可考虑转Skilled Worker。¦提前查雇主合法担保状态与工资。
转其他有效签证¦HPI本身通常不可续，因此到期前需合法转换或离境。¦规划时间避免出现身份空档。
不符合学校资格¦可考虑传统Student签证或具备真实雇主担保的路线。¦不要篡改毕业日期或学校所属校区。`),
risks:['2026全球大学名单不能追溯覆盖全部毕业年份。','2026年度配额8000不保证任何个人一定能申或获签。'],
faq:[['英国大学毕业能申请HPI吗？','HPI适用于名单中的境外大学；英国合格大学毕业生应研究Graduate等其他制度。'],['HPI需提前找到英国公司吗？','HPI通常无需工作邀请，但必须符合学校、学位、英语、资金、年度配额和签证历史等条件。']],
sourceKeys:['hpi','hpiList','hpiEligibility','hpiFees','ihs']
},
{
id:'uk-scale-up',name:'高成长企业工作签证：Scale-up',english:'Scale-up Worker visa',category:'work',
summary:'需英国获准的Scale-up高成长企业提供至少6个月真实工作并签发CoS，2026新申请薪酬通常为£39,100与该岗位going rate取高。',
audience:'已获英国Scale-up许可雇主职位，具备专业技能、英语和合格薪资条件的人。',
highlights:['企业需Scale-up许可','工资通常≥£39,100与going rate取高','前6个月需履约'],
requirements:lines(`特殊持牌高成长企业¦雇主必须具备Scale-up签证相应许可，不是所有快速成长公司都可以。¦向雇主确认其获批担保类别及职位签发的CoS。
工资与职业¦年薪至少£39,100或该SOC职业going rate二者较高；职位属于合格专业职业。¦查公司CoS、岗位SOC与最新职业薪资表。
最初六个月¦入境后通常需在被担保职位工作至少6个月，之后变动规则与一般Skilled Worker不同。¦逐月保存工资单和雇佣记录。
英语与个人资格¦须符合现行英语、资金及健康身份等规定。¦在申请前核实适用B2及获批文件，勿复用过期语言。`),
documents:lines(`Scale-up CoS和工资¦真实企业、获批准担保类别、职位与薪资合同。¦对照政府名单和企业注册地址。
英语及职业经历¦所需语言、学历或经验、职业代码资料。¦让HR给出实际SOC和going rate。
护照资金TB¦有效身份和英国规则要求的资金、TB及翻译。¦以最新官方申请列表准备。`),
steps:lines(`1. 核实许可类型¦确认企业有Scale-up路线担保资格。¦查看相应官方资格与雇主证明。
2. 核对工资与CoS¦职位真实可担保、£39,100或going rate取高，合同至少满足六个月要求。¦保存CoS编号与薪资证据。
3. 通过官方递交¦按UKVI要求提供语言、身份证明、财务等文件并付款。¦不借用普通Skilled Worker程序替代。
4. 留存工作与收入记录¦获批后记录前6个月工作及以后延签所需PAYE收入证明。¦核对工资单和税务申报是否准确。`),
costs:lines(`签证及IHS¦Scale-up申请费和IHS按官网对应签证期限核算，IHS多数为£1,035/年。¦申请当日查看Scale-up官方收费和家属费用。
资金要求¦通常需要£1,270或适用雇主担保等例外。¦按官方28天财务证据规则准备。
落地费用¦住房押金、机票、语言与翻译并非签证费。¦按税后工资规划6个月以上现金流。`),
time:lines(`最初两年¦Scale-up首签一般2年，到期可在合规条件下延长。¦保存许可开始及结束日期。
雇主义务前6个月¦需在所获担保岗位工作满6个月，换雇主过早可能触发新申请。¦核对6个月条件及许可变更流程。
延签收入核算¦后续延签一般要求在最近许可期至少一半月份达到规定PAYE收入水平；有不同CoS过渡标准。¦把工资每月税前收入建表，不能只看年度平均。`),
rights:lines(`后期职业灵活度¦工作至少6个月后可能不再需新雇主CoS，但仍受其他签证条件限制。¦查UKVI当前更换工作规则。
后续延签与定居¦符合条件可延签，官网提到可能在5年满足额外资格后申请定居。¦依实际当时法规、工资及合法居留判断。
家属和福利¦符合条件的家属可申请，通常不享有公共福利。¦为家属做独立身份和预算核验。`),
next:lines(`延签收入节点¦未满足指定时间的实际PAYE收入可能无法续签。¦保存完整payslip/P60和税务记录。
雇主停业等情况¦出现企业变化或合同解除，按实际阶段判断下一签证路径。¦及时查询UKVI规则不非法工作。
其他高技能路线¦有资格也可比较普通Skilled Worker或Global Talent。¦核实不同路线的转换条件。`),
risks:['Scale-up与普通Skilled Worker雇主许可证并非完全等同。','有6个月雇主履约和续签收入门槛，不能只看宣传的“半年后自由找工”。'],
faq:[['任何新创公司都能出Scale-up担保吗？','不可以。必须是获得对应许可的合格scale-up企业。'],['6个月后还需要满足收入条件吗？','可能需要，续签会查看最近许可期中的一定月份的合格PAYE收入。']],
sourceKeys:['scale','scaleSalary','scaleExtend','rates','ihs']
},
{
id:'uk-innovator',name:'创新创业者签证：Innovator Founder',english:'Innovator Founder visa',category:'residence',
summary:'针对具备创新、可行、可扩张商业计划并获得英国授权机构endorsement的创始人，非购买公司即自动获签；官网说明符合独立要求者可能在3年后申请定居。',
audience:'有真实项目、市场验证、经营能力、资金来源和较高英语能力，愿在英国持续经营业务的创业者。',
highlights:['须获授权机构背书','B2英语及真实商业计划','不等于买公司移民'],
requirements:lines(`真正的商业创新性¦需要创新、可执行、有增长潜力的商业计划，不能把空壳注册和加盟代理包装成发明。¦撰写产品、竞争优势、市场规模、收入模式与团队执行证据。
官方认可背书机构¦初次申请须通过当前官方Business Endorsing Bodies名单的授权机构评审。¦逐一核验机构官方名称和申请条件，警惕旧版legacy名单。
英语B2和资金¦申请人通常至少18岁、英语CEFR B2，且未满足豁免时需£1,270持续持有28天。¦查看证明类型、资金来源与翻译要求。
项目投资与长期经营¦新项目需要向背书机构说明合理且真实的投入资金来源，不存在可对所有申请人保证的统一最低投资金额。¦准备可审计经营现金流、股权、团队及实际业务证明。`),
documents:lines(`正式endorsement¦认可机构出具有效背书信和被认可的商业计划、资金来源证明。¦验证背书机构及背书信有效期。
业务证据¦真实产品、技术、客户、商业模型、团队、资金、公司文件与市场成果。¦不要伪造营收合同或雇员数据。
签证身份与英语资金¦护照、B2证据、资金证明、可能需要TB检查及翻译。¦按当前GOV.UK真实材料清单递交。`),
steps:lines(`1. 检验是否符合创新标准¦用经营数据与竞品分析证明innovative、viable、scalable。¦找出项目真实优势和风险，不先购买皮包公司。
2. 联系授权背书机构¦按照机构公开流程申请评审，准备商业计划和证据。¦确认机构名在官方当前认可名单并保存反馈。
3. 申请正式签证¦获有效背书后通过GOV.UK提交申请、英语、资金与个人材料。¦区别endorsement费用和签证费用。
4. 在英国经营与接受联系检查¦持续实质参与公司管理，履行背书机构约定的后续联络节点。¦保存真实收入、客户、知识产权及合规公司文件。`),
costs:lines(`签证官方费用¦2026年10月收费表：英国境外Innovator Founder申请费£1,357，境内£1,693。¦提交当日再核对最新政府收费清单。
背书及复核¦首次授权背书费用通常£1,000（不含VAT），指定联系节点会议通常每次£500（不含VAT），另有可能服务成本。¦按被认可机构官方收费公示核算，不给个人汇“保过费”。
IHS与运营现金¦除通常IHS£1,035/年和£1,270维持资金外，还需准备真实经营资金、场地、人员与税务成本。¦区分生活证明、政府费用与实际创业成本。`),
time:lines(`背书时间¦机构评审、项目研究与复核耗时不定，可能失败。¦先把证明材料准备完整，再规划境外行程。
初次签证期限¦该签证一般授予3年，后续须符合延签、背书评审等要求。¦按真实批准文件保存每次许可和审查记录。
定居节点¦官网存在最早3年申请ILR的可能，但需另获新背书并满足发展业绩与居留要求。¦不要把3年等同自动定居。`),
rights:lines(`管理业务¦必须实际参与获认可企业的日常管理和发展，附加工作按当前规定核实。¦保持可审计经营记录。
家属及福利¦家属有独立申请资格和费用，通常不能依赖公共资金。¦按签证及家属当前规则办理。
永居绩效要求¦申请ILR除居留外须证明实际企业成绩，如投资、雇员、营收、知识产权等达到标准。¦提前按官方可用指标保存业务证据。`),
next:lines(`项目继续发展¦维持公司合法、实际营业、客户及发展记录。¦按背书条款安排定期联系人评估。
申请ILR¦达到3年条件并不自动授予ILR，还要有新的业绩背书和其他条件。¦依据官方定居申请与商业绩效核验。
退出或调整项目¦变更公司或业务方向可能影响背书和签证。¦先与背书机构、合格移民专业人士核实。`),
risks:['成立英国有限公司、租工位或购买创业项目都不能替代endorsement。','三年永居条件包含企业可核验经营绩效，并非持有签证满三年即可拿。'],
faq:[['创业者签证还有固定£50,000起投门槛吗？','不应机械套用旧制数字；新申请需要证明计划可行且资金真实充足，由授权背书机构评估，ILR可能有另行独立业绩指标。'],['花钱买背书就一定成功吗？','不会。只有官方名单内认可机构具备资格，支付合法审核费用不意味着获背书或签证。']],
sourceKeys:['founder','founderBody','founderSettlement','fees','ihs']
},
{
id:'uk-seasonal',name:'农业与家禽季节性工作',english:'Seasonal Worker visa',category:'experience',
summary:'适用于英国许可担保体系下的园艺季节工（通常最多6个月）或指定家禽产业季节工（当年10月2日至12月31日）。不是长期移民签证。',
audience:'愿意从事真实短期果蔬、花卉、园艺或家禽工作的申请人，并已核实合规scheme operator及CoS。',
highlights:['园艺最多6个月','不能携带家属','非定居路径'],
requirements:lines(`限定的行业和任务¦仅限合格horticulture或poultry季节工作，普通餐饮、仓储和建筑不能用农业季节签证冒名申报。¦与担保机构核对岗位行业、地点和实际工作任务。
真实scheme operator¦需有获英国政府准许的Seasonal Worker担保人签发真实CoS。¦只通过经政府确认的渠道联系，不购买所谓名额。
时间窗口¦园艺工作最长通常为任意10个月周期中的6个月；家禽只限当年10月2日至12月31日且一般须在11月15日前申签。¦按行业核对CoS开始与结束日，避免越过官方截止日期。
资金与身份¦通常须满足£1,270维持资金或可用的担保豁免，以及护照、个人资格规定。¦准备银行记录和可信申请材料。`),
documents:lines(`真实CoS编号¦职位、担保单位、工时、工作地点和期限明确的正式信息。¦查官方担保制度与合同书。
护照和资金¦有效身份及£1,270维持资金的适用证明。¦按真实28天持有期准备。
劳动合同¦合同应说明工资、住宿扣费、运输、安全、工时与申诉渠道。¦在支付路费前核实合同、休息与劳动权利。`),
steps:lines(`1. 确认行业及合法运营商¦把工作类型与官方允许范围比对。¦不接受酒店保洁假借季节工签证。
2. 核实合同及CoS¦阅读劳动合同的工资、住宿和工作地点，确认合规担保。¦拒绝向个人购买工作配额。
3. 在窗口内申请签证¦通过英国官网完成Seasonal Worker申请、支付费用并提交材料。¦家禽工作尤其检查11月15日申请期限。
4. 在有限许可期工作¦按获准指定岗位短期工作并遵守离境日期。¦留存工资记录及用人单位联系方式。`),
costs:lines(`签证费¦2026英国Seasonal Worker签证官方申请费£340。¦只按官方指定流程交费，不将中介服务列为法定费用。
生活与机票¦需支付可能的机票、住宿、保险或当地交通，合同若允许扣费须核对合法性。¦计算实际净到手工资。
资金证明¦一般要求£1,270维持资金或适用资助例外，不是向政府缴纳£1,270。¦保存符合规定的银行材料。`),
time:lines(`申请时间¦一般可在实际开工日期前最多3个月申请；按官方申办窗口操作。¦提前核对CoS工作日期。
家禽截止¦家禽季节工作通常每年须在11月15日前申请，工作期间为当年10月2日至12月31日。¦不要在年度窗口关闭后向第三方付款。
许可期满必须守法¦该路线不是无限续签或定居路径。¦提前安排离境和合法后续选择。`),
rights:lines(`仅获准工作¦只可在CoS列出的岗位范围工作，不能另找第二份永久工作。¦了解工作许可与当地劳工最低工资。
不能带家属¦Seasonal Worker官方规则不允许家属作为随行依赖签证申请。¦如计划家庭迁居，应选择其他适用路线。
不能永久定居¦季节工本身不是ILR的定居路线。¦不要向任何人支付“半年转永居”费用。`),
next:lines(`下一季申请¦需根据当年配额、工作记录、停留限制重新判定。¦保留工资单与离境记录，重新查官方方案。
如想长期工作¦需要另行符合Skilled Worker等独立签证资格。¦勿拿临时季节工合同替代合格专业职位。
劳动争议¦若工资或住宿条件存在问题，应联系合法工会、Acas或监管机构。¦保存合同、消息和工资单证据。`),
risks:['Seasonal Worker不能用于一般长期工厂、物流或酒店岗位，也不能保证转永居。','严禁售卖CoS、保证工作名额或向个人账号收取高额职位费。'],
faq:[['中国护照能考虑英国农业季节工吗？','该类别主要取决于担保、职位和签证资格，不是Youth Mobility打工度假；仍要符合每项实际要求。'],['可以带配偶孩子吗？','该季节性工作路径不允许以dependants身份携带家属。']],
sourceKeys:['seasonal','seasonalRules','sponsors','fees']
},
{
id:'uk-creative-worker',name:'创意产业短期工作签证',english:'Temporary Work – Creative Worker',category:'experience',
summary:'英国艺术团、制作公司等持牌赞助方为真实演出、舞蹈、音乐、影视剧组等项目签发CoS的短期工作签证。中国护照持有人通常不能套用免签国家的三个月concession。',
audience:'有真实英国演出合同、剧组活动或短期艺术合作安排的表演艺术、舞蹈、音乐及影视专业人士。',
highlights:['适用于舞蹈/音乐/剧组','真实创意赞助与CoS','短期工作非定居'],
requirements:lines(`真实创意项目¦工作应属于表演、音乐、舞蹈、演艺制作等合格创意行业且有独特贡献，不能把普通旅游演出当工作许可。¦准备剧目、活动、角色与真实制作方合同。
Licensed sponsor和CoS¦通常需英国认可的Creative Worker sponsor提供CoS，并满足赞助、工资和相关职业规范。¦核查制作方担保资质和合同署名。
官方职业工资规则¦某些行业应满足Equity、PACT或BECTU适用标准；模特、音乐等类别规则有例外。¦让赞助方确认适用行业协议和真实报酬。
入境方式受国籍限制¦Creative Worker三个月concession仅适用于一般不需访问签证入境的人员及其他条件；中国普通护照不能直接套用。¦按个人护照和访问签证规则核查是否必须提前申请Creative Worker签证。`),
documents:lines(`演出合同和赞助¦正式CoS、日程、制作方、工作地点、薪酬和艺术领域证明。¦向真实剧团/主办方而非中介个人获取材料。
职业证明¦艺术演出作品、专业经历、参与节目资料及可能需专业行业证明。¦如实提交履历与项目证据。
个人证件¦护照、£1,270维持资金或合规豁免、适用健康/翻译文件。¦核对个人申请地要求与相关入境时间。`),
steps:lines(`1. 明确演艺类型¦核对实际工作在Temporary Work Creative Worker定义内。¦列出演出、主办方、职责及工作日期。
2. 核实英国制作方¦主办方持牌，真实CoS和合理报酬。¦查看官方赞助名册，拒绝个人售卖CoS。
3. 按国籍办入境文件¦中国普通护照通常应按签证要求提前递交，而不能直接引用免签短期concession。¦在英国官网核查自己应走的入境流程。
4. 依CoS工作并离境¦通常首次许可最长12个月或CoS项目期加缓冲中的较短者。¦保存行程、报酬和批准条件。`),
costs:lines(`政府签证费¦2026 Creative Worker签证申请费£340；符合要求的申请人通常还需缴纳IHS。¦提交前按项目期与申请地核算。
IHS及短期特殊情况¦IHS通常£1,035每年，但英国境外6个月及以下的许可可能适用免缴规定。¦根据真实允许的停留期核查而不机械全年计费。
项目其他成本¦航班、剧组住宿、现场保险、设备、税务与经纪费用各项目不同。¦将合同中谁承担的费用书面确认。`),
time:lines(`提前拿到CoS¦项目不可无合同就提前申短期工作签证。¦在演出或开机前向赞助方核实CoS签发。
申请时间¦一般可在CoS工作开始日前最多3个月申请。¦安排护照和签证中心流程。
项目许可期限¦通常最多12个月或按CoS指定项目期决定，延期须独立判断。¦离境计划与演出排期匹配。`),
rights:lines(`工作范围¦可从事CoS内获准创意工作，第二份岗位仅在指定类别与工时条件下适用。¦查看eVisa及官方副业条款。
不能创业或拿福利¦Temporary Creative Worker不能用来任意开展个人英国商业项目，也通常不能拿公共福利。¦若计划长期创意经营，另查Global Talent等资格。
家属可单独核验¦符合要求的伴侣子女可能有资格申请随行签证，与Seasonal Worker不同。¦按家属签证条件与费用单独核实。`),
next:lines(`延续短期项目¦演出加场、延期或更换赞助方需核对签证条件。¦提前与赞助方办理合规手续。
长远艺术发展¦资历出众者可研究Global Talent Arts & Culture的严格背书要求。¦保留媒体评论、作品与行业成果。
非创意工作¦其他雇佣须考虑Skilled Worker等独立签证。¦不要拿Creative Worker身份长期从事无关职位。`),
risks:['中国普通护照通常不符合“不需英国访问签证”的3个月Creative Worker concession适用前提。','Creative Worker短期赞助与Global Talent个人成就背书不是同一种东西。'],
faq:[['舞蹈老师可以自己买创意工作签证吗？','不能。必须有真实符合条件的创意岗位、英国持牌赞助方及CoS等资格。'],['到英国参加3个月演出能免签吗？','是否适用concession取决于护照国籍和其他条件，中国普通护照不能把这种安排当普遍免签。']],
sourceKeys:['creative','creativeEligible','creativeConcession','sponsors','ihs']
},
{
id:'uk-gov-exchange',name:'官方交流实习与研究项目',english:'Government Authorised Exchange visa',category:'experience',
summary:'通过英国政府正式认可的exchange scheme在英国短期进行实习、培训、研究或fellowship；必须有对应获批计划与赞助方，不是任何企业实习offer均可办理。',
audience:'获得官方交流项目批准、研究机构或实习计划赞助，希望赴英短期专业实践的学生、毕业生或研究人员。',
highlights:['官方批准项目','必须有scheme sponsor','最长通常12或24个月'],
requirements:lines(`必须属于获批scheme¦仅政府清单所列的交流计划可支持申请，企业普通实习不等于政府授权交流。¦查Appendix Government Authorised Exchange Schemes项目名称及范围。
真实赞助与编号¦必须获得适用CoS或sponsorship reference number及官方赞助信息。¦联系计划官方项目负责人核对日期、职位和活动。
实践内容对应¦研究、培训或工作经验应与计划批准的方向和活动相符。¦将培训计划、实习内容和工作时长与方案描述对照。
资金资格¦通常需£1,270维持资金或经官方条件允许的担保豁免。¦准备资金、身份和可能的TB文件。`),
documents:lines(`计划录取与资助¦正式exchange scheme通知及赞助CoS或reference。¦验证机构、项目类别和真实活动安排。
研究实习资料¦培训计划、研究计划、导师/机构邀请、合同和预计持续时间。¦确保工作内容不超出方案许可。
身份与资金¦护照、适用存款与体检及翻译。¦使用GOV.UK逐条核对文件。`),
steps:lines(`1. 在政府清单选scheme¦比对实际职业、研究或实习目的是否属于官方批准项目。¦不信“任何公司实习都能无条件赴英”的宣传。
2. 获正式赞助编号¦由相应scheme sponsor签发真实CoS或reference。¦核对编号有效期，勿向个人购买。
3. 按计划申请签证¦英国政府Temporary Work GAE在线申请，缴费并提交材料。¦预算签证费、IHS和支持资金。
4. 按批准目的完成交流¦仅在批准的专业活动范围内工作或培训，严格遵守离境期限。¦保留阶段成果和结束证明。`),
costs:lines(`申请费¦2026 GAE官方申请费£340，家属另算。¦不要把企业内部“实习证明费”当英国政府费用。
IHS¦通常按£1,035/年计算，具体长度及费用豁免按官方规则核实。¦按许可长度做预算。
生活与交流资金¦一般£1,270维持资金门槛，项目补贴可能不足以覆盖伦敦租金。¦按照实际城市、交通、住宿估算现金流。`),
time:lines(`项目申请先于签证¦先获正式交流计划资格与sponsor，然后申请入境许可。¦将scheme报名窗口与签证办理分开排期。
许可长度¦依scheme不同，通常最多12或24个月，不能一概认为两年。¦在官方scheme表查具体类别。
审批和活动日程¦获批时间与计划开始日可能不同。¦未收到批复前不预设可合法开始实习。`),
rights:lines(`允许有限的对应活动¦主要只能从事与所担保scheme相关的研究、交流、培训等，可能有受限的附加工作。¦按正式签证附加工作条款核实。
不是永久雇佣路径¦不能借GAE签证直接接收普通长期正式职位，也不直接通向定居。¦如有长期offer另查独立工签。
家属与公共福利¦合资格家属可按规则申请，通常不可领取公共福利。¦家庭预算和签证条款分别核实。`),
next:lines(`交流结束¦取得完成证据、实际作品和学习或实习经历。¦及时按签证条件离境或获得其他合法身份。
正式就业¦另行满足Skilled Worker等职业和薪资规则。¦向真正雇主确认是否有合规岗位与CoS。
科研路径¦突出研究成果者可研究Global Talent学术分轨。¦保留论文与专业同行成果，不保证自动转签。`),
risks:['政府授权交流是封闭的scheme目录，普通私营企业实习不一定符合。','仅有实习合同没有官方scheme sponsor/reference不足以申请。'],
faq:[['拿到英国公司实习offer就能直接申请吗？','不一定，必须通过被认可的GAE计划与合格赞助。'],['允许通过交流长期在英国打工吗？','不可以把它视为一般自由工作或定居签证，必须遵守计划及许可限制。']],
sourceKeys:['exchange','schemes','sponsors','ihs']
},
{
id:'uk-senior-specialist',name:'跨国公司内部调派：高级或专业员工',english:'Senior or Specialist Worker (Global Business Mobility)',category:'work',
summary:'面向已在跨国企业组织工作的员工，由英国关联分支为合格职位办理内部调派；2026通常要求至少£52,500年薪，不能作为一般求职者的无雇主路径。',
audience:'在已建立跨国业务的公司任职、具有组织内部派遣安排和专业资历的高级或专门人才。',
highlights:['跨国集团内部调派','通常≥£52,500','非普通自由求职'],
requirements:lines(`集团内部雇佣关系¦须已受雇于有合格英国分支及对应赞助许可的组织，满足适用海外任职要求和例外。¦准备集团关联及本人劳动合同、岗位日期。
真实职位与CoS¦英国关联企业须发出真实合格职位与CoS。¦向集团HR确认英国实体身份与许可类别。
工资与SOC¦2026官网列一般至少£52,500/年，具体还须满足该职位going rate。¦对照官方跨国流动职业工资表和实际合同。
个人及财务条件¦护照、资金、TB等规则仍适用；并非企业派遣文件替代签证审查。¦按UKVI正式申请清单办理。`),
documents:lines(`集团内部关系¦境外在职证明、集团公司与英国主体关联关系、派遣协议。¦让HR提供真实任职和集团关联材料。
CoS工资职位¦英国分支的岗位代码、真实工资、工作地点、派遣时长。¦严格对照相关签证职业表。
身份资金¦护照、必要资金与中国TB证明、非英语文件译本。¦核对最新具体要求。`),
steps:lines(`1. 向集团HR核实可派遣资格¦确认当前境外雇佣、英国分支和可用GBM许可。¦不把非集团关联工作机会当内部调派。
2. 确认职位与薪资¦查真实SOC岗位、£52,500或适用going rate和CoS。¦保存两地组织的正式文件。
3. 递交签证申请¦以Senior or Specialist Worker路线而非一般Skilled Worker申请。¦核对政府正式材料、收费和签证期限。
4. 遵守派遣目的¦获签后按英国实体及批准岗位工作。¦保存境内工作与派遣时间。`),
costs:lines(`签证费用¦2026境外申请一般不超过3年£819、超过3年£1,618，境内费用可能不同。¦按申请地点和签证年限核实。
IHS与维持资金¦一般IHS£1,035/年，并可能要求£1,270维持资金（可有雇主担保例外）。¦对照CoS是否certify maintenance。
调派开支¦集团安排的住房、机票、税务、社保和差旅费用应有正式政策。¦与公司HR书面确认承担方式。`),
time:lines(`内部任职资格¦部分申请人需满足先前在海外工作时长规定或高薪豁免。¦先查UKVI当前高级及专门人员细则。
CoS与申请¦明确派遣工作开始日期后走官方签证申请。¦留出学历和跨国文件翻译时间。
有最高停留总时长¦GBM相关年限有独立累计限制，不能认为可以无限期顺延。¦跟踪自己历次GBM签证和实际出入境。`),
rights:lines(`限制为实际派遣目的¦允许按CoS为英国分支工作，不等于任意跳槽。¦工作主体变化时询问公司与UKVI。
本身通常不是定居路线¦Global Business Mobility不能直接视为可通向ILR的路线。¦若想长期定居另查合格转换途径。
家属条件¦符合要求的家庭成员可按规定申请。¦核查工作、学习、资金与IHS。`),
next:lines(`派遣结束后¦通常依集团安排返回原单位或转向其他依法申请的类别。¦在有效停留期内安排。
长期受聘¦如果英国公司愿意正规雇佣，可评估是否符合Skilled Worker等签证。¦重新核验适用SOC、工资、CoS及英文。
集团其他项目¦Graduate Trainee等GBM子类另有规则，不能混为一个签证。¦依真实企业项目选择正确类别。`),
risks:['无真实跨国集团内部雇佣与英国关联实体不能走Senior/Specialist Worker。','GBM跨国流动并非通用永居签证。'],
faq:[['中国公司员工能申请吗？','只有符合跨国组织英国关联主体、职位、薪资和担保资格等条件才可能申请。'],['这一签证能直接永居吗？','通常不是直接定居路线，必须另行研究合法转换与定居条件。']],
sourceKeys:['senior','rates','sponsors','ihs']
},
{
id:'uk-family-partner',name:'英国配偶／伴侣家庭签证',english:'Family visa – partner or spouse',category:'residence',
summary:'与符合资格的英国公民、已定居人士或其他指定身份的真实配偶/伴侣共同在英国生活的路线。2026一般最低收入£29,000/年，但部分旧申请及福利情况另有特别规则。',
audience:'与符合英国法定身份要求的伴侣存在真实稳定关系、准备共同长期生活的人。',
highlights:['必须真实婚姻/稳定关系','通常£29,000收入门槛','非工作offer签证'],
requirements:lines(`伴侣合法身份¦担保伴侣通常需英国/爱尔兰国籍、英国定居身份或其他官方认可特定身份。¦核对对方实际移民身份，不把短期访问签证视为家庭担保。
真实长期关系¦需要符合婚姻、民事伴侣或达到官方标准的长期关系，双方通常至少18岁且有共同生活意图。¦准备关系持续性与真实性记录，不办假结婚。
财务门槛¦2026通常要求合计至少£29,000年收入，个别福利领取者或2024年4月11日前的旧申请可适用例外。¦按真实工资、存款及官方附录证明规则核算。
英语和家属¦初次申请通常有A1英语等要求，续签逐步提高；子女与资金另有条件。¦按本人情形确认英语考试级别及家属身份。`),
documents:lines(`关系真实性¦结婚证、共同住址、账单、租约、双方沟通及长期往来记录等官方接受的证明。¦按官方文件要求提供，不伪造同居记录。
担保人身份和收入¦合法身份凭证、雇佣及工资银行记录、可用存款。¦按Appendix FM所需时间范围整理。
身份与语言¦双方身份证明、相应英语证书、必要TB体检与翻译。¦按申请地点准备。`),
steps:lines(`1. 确定可担保的家庭关系¦核查伴侣国籍/定居身份及两人真实关系是否符合官方标准。¦记录适用法律类别而非只说“有英国对象”。
2. 核对收入与英语¦£29,000门槛及适用历史例外、收入证据规则。¦把资金来源、工资单时间和例外资格列清楚。
3. 官方家庭签证申请¦根据境内或境外申请使用正确Family visa表格，上传真实关系与财务资料。¦支付政府申请费及适用IHS。
4. 维护真实关系与合法身份¦婚姻/伴侣状态变化可能影响签证；需遵守未来续签和居留要求。¦保存共同生活及真实收入证据。`),
costs:lines(`政府申请费¦2026通常境外配偶/伴侣家庭签证£2,064，英国境内相关申请£1,407，具体按家庭类别确定。¦避免把未婚妻和配偶、境内与境外费率混同。
IHS与家庭开支¦成年人按真实许可期限计算IHS；官方例如2年9个月£3,105。¦为配偶、孩子分别预算。
搬迁费用¦英国家庭住房、关系证明认证、翻译、TB与机票另有支出。¦与担保家庭收入和真实负担能力匹配。`),
time:lines(`关系材料准备¦证明真实长期关系可能需要整理较长时间内的共同生活及沟通记录。¦不以临时伪造材料填补时间缺口。
审批周期¦英国境外家庭签证官方通常参考约12周审理，个案或例外可能更久。¦通过gov.uk实时处理时间核对。
续签和定居¦各阶段英语、收入和真实共同生活证明有独立要求。¦为日后续签保留证据。`),
rights:lines(`家庭许可与工作权¦合格配偶/伴侣签证获批后通常可以工作，未婚夫/未婚妻类过渡许可在结婚前通常不可工作。¦看个人eVisa及获批签证具体类别。
家属与福利¦大多数情形不得领取公共资金，子女签证另有条件。¦注意子女国籍与随行身份区别。
定居评估¦通常可按有效家庭路径与实际规则申请ILR；极个别例外为10年路线。¦核对身份、英语、财务及共同生活。`),
next:lines(`婚后身份变化¦以未婚妻/未婚夫路径入境者需要结婚后按规则延签，不自动获工作权。¦按官方规定及时转换。
长期家庭居留¦依实际签证许可计划合法续签并保存共同生活证据。¦按当时生效的英国家庭移民规定申请。
关系破裂¦身份可能受影响，特定弱势人群有特殊保护途径。¦如情况发生及时查看官方程序并寻求专业帮助。`),
risks:['家庭签证不适用于“花钱买英国假婚姻/假伴侣”。','£29,000不是对所有历史或特殊个案无例外的机械门槛。'],
faq:[['普通英国工作签证持有者可以担保配偶用此家庭签证吗？','通常Family partner和工作签证dependent分属不同申请类别，要先核实担保人身份。'],['未婚妻签证入境可以直接打工吗？','在未婚夫/未婚妻临时家庭许可期间通常不能工作，结婚并获批准的新许可另看条件。']],
sourceKeys:['family','familyMoney','fees','ihs','tb']
},
{
id:'uk-youth-mobility',name:'英国青年流动签证：中国普通护照限制',english:'Youth Mobility Scheme – nationality eligibility',category:'experience',
summary:'英国Youth Mobility Scheme在2026年度仅面向规定国籍、地区或特定护照类别。中国大陆普通护照不属于2026官方直接合格名单，不能将香港护照或印度通道等同于大陆护照资格。',
audience:'计划申请英国打工度假的人，特别是需要先核实国籍与签证可用性的中国大陆普通护照持有人。',
highlights:['中国大陆普通护照不在名单','须按国籍核对','不提供虚构申请按钮'],
availability:'closed',
requirements:lines(`先看本人护照资格¦2026英国Youth Mobility法定申请国籍名单不包含中国大陆普通护照；香港特别行政区护照/BN(O)等具体规则必须分别判断。¦先在官网核对本人实际护照类别及最新eligible nationals名单。
特定配额与年龄¦计划按参与国家或地区规定设年度名额、年龄、资金以及可能的抽签/选拔。¦只有国籍实际符合名单才继续检查这些要求。
不能买资格¦中国大陆普通护照不能靠购买中介配额转换成香港或其他地区的法定国籍。¦不要购买所谓2026英国大陆打工度假名额。`),
documents:lines(`真实国籍证明¦只有本身属于合格国籍或适用特定护照类别的人员才进入材料阶段。¦按照实际护照检查2026官方名单。
申请资金与年龄¦符合国籍者再依其计划核对年龄、支持资金和是否需抽签。¦不要替其他国籍套用同一标准。
在线流程¦合格国籍申请人必须通过正确的GOV.UK官方页面申请。¦没有资格时不得伪填身份申请。`),
steps:lines(`1. 查国籍与护照¦以官网2026法定参与名单核对本人国籍和护照类别。¦若仅持中国大陆普通护照应停止此路线申请。
2. 不购买名额¦英国移民资格不可通过中介或个人出售。¦见到“中国大陆护照包获YMS”应提高警惕。
3. 改查适合的合法路线¦有雇主可查Skilled Worker，留学可查Student，短期农业可查Seasonal Worker。¦优先选择个人资格可能符合的路线。`),
costs:lines(`不适用费用¦中国大陆普通护照不符合此2026直接申请路径，不能在HHBA展示可支付签证费作为行动方案。¦先确认国籍资格，避免浪费中介款。
其他路线的费用¦改走Student/Skilled Worker/Seasonal Worker时，均按其独立申请规则收取真实费用。¦不要把别的签证费用冒充YMS费用。
防骗¦不向个人购买英国“打工度假名额”。¦检查正式政府域名与合法招聘主体。`),
time:lines(`按年度更新¦参与国籍及配额名单可能按移民规则调整。¦未来如新增大陆护照资格再核实，不能提前承诺。
选拔窗口¦部分国家或地区有特定选拔/抽签流程。¦只在本国籍真正适用时关注对应窗口。
目前不可申¦截至2026年11月6日大陆普通护照不在2026名单。¦不要在产品中呈现“立即申请中国YMS”的入口。`),
rights:lines(`没有合法签证不得工作¦不符合YMS资格者无法依YMS取得英国工作权。¦另取得合法签证后再就业。
不同护照区别¦香港有关护照或其他国籍可能有独立资格和名额，但不得类推到所有中国护照。¦仅按实际持有的证件和官方最新规则判断。
不是移民保证¦即使国籍合格，青年流动也是短期签证而非永久居民许可。¦长期工作另需合适路径。`),
next:lines(`正规找英国工作¦具备真实雇主和专业工资技能条件者查Skilled Worker。¦优先核实持牌企业及SOC。
英国高校留学¦申请合格学校和CAS时查Student。¦计算学费生活费和Graduate改革。
短期合法工作¦农业短工或有正式演艺项目者分别查Seasonal/Creative Worker。¦按各自限制申请而非套YMS。`),
risks:['英国2026 Youth Mobility名单不包括中国大陆普通护照，严禁假称开放。','不同护照种类与地区不能混淆。'],
faq:[['中国大陆普通护照能申请2026英国YMS吗？','按2026官方eligible nationals名单，不能直接凭中国大陆普通护照申请。'],['香港护照是不是代表所有中国人都能申请？','不是。具体资格必须按实际香港护照类别或其他国籍的英国政府规则独立核实。']],
sourceKeys:['youth','youthCountries','seasonal','skilled','student']
},
{
id:'uk-global-business-graduate-trainee',name:'跨国公司毕业生培训调派',english:'Graduate Trainee (Global Business Mobility)',category:'work',
summary:'在跨国公司正式graduate training programme中的员工赴英国关联企业短期管理或专业培训调派路径；需合格英国sponsor与CoS，不是普通留学生毕业工签。',
audience:'在跨国集团任职并参加正式国际轮岗或管理培养计划的毕业生/员工。',
highlights:['集团内部graduate programme','需有效GBM担保','不等同Graduate Visa'],
requirements:lines(`真实集团管理培训¦必须存在被认可的正式graduate training programme，岗位为管理或专业人才发展而临时调派。¦向集团HR核实书面培训计划与两地机构关系。
海外雇佣记录¦申请前须紧接着在同集团英国境外工作至少3个月；不可从英国境内转换或延长Graduate Trainee。¦整理最近3个月真实工资单、劳动合同和境外工作证据。
英国分支CoS与工资¦英国关联机构应持有效Graduate Trainee担保资质；一般工资至少£27,300或相应职业going rate的70%（取高），医教职位另有规则。¦对照本路线官方salary和SOC表，不用Senior Worker的£52,500门槛。
个人资格¦护照、维持资金、适用TB和家属等要求依本路线处理。¦通过GOV.UK正式Graduate Trainee材料清单核对。`),
documents:lines(`培训计划¦集团国际轮岗文件、岗位、导师、培训任务及期限。¦留存正式HR文件。
雇佣和赞助¦海外劳动关系、英国集团关联、CoS及工资材料。¦让英国HR确认合法担保类别。
身份财务¦护照、资金、适用TB与翻译。¦按申请清单提交真实信息。`),
steps:lines(`1. 确认公司培训资格¦无真实graduate programme不能申请此GBM类别。¦查雇主内部培养制度。
2. 确认GBM担保¦由英国关联企业按Graduate Trainee分轨签发CoS。¦比对培训工资和SOC代码。
3. 提交政府申请¦准备真实雇佣、培训和身份材料并支付签证费用。¦使用UKVI Graduate Trainee而非毕业生Graduate Visa申请。
4. 完成临时培训¦按许可期限参与培训并提前规划下一身份。¦保存培训记录与正式公司文件。`),
costs:lines(`政府签证费¦2026 Graduate Trainee官方申请费£340；另需按签证期限支付适用IHS。¦申请当日核对官方收费与入境条件。
IHS与资金¦通常需另行计算IHS及维持资金证明。¦区分公司报销和法律要求。
企业培养开支¦差旅、住宿、交通可能由公司承担，需看正式协议。¦与公司HR书面确认。`),
time:lines(`先满足任职时间¦入境前需要真实集团雇佣与相应时长，不能临时办假工作经历。¦核查劳动合同时间线。
临时签证期¦该签证通常最长为CoS期限加14天与12个月两者较短者，不可在英国境内延长。¦确认CoS期限、总GBM停留限制与出入境。
日后转签¦GBM属于临时跨国人才流动，长期工作需要另查可转换路径。¦在许可届满前咨询公司。`),
rights:lines(`限定集团培训¦工作活动围绕批准的graduate training职位，不能擅自换工作。¦严格按批准条款就业。
不直接定居¦本路线不能简单算作永久居留路径。¦规划长期工作其他制度。
家属另行申请¦按GBM的dependent政策确定是否可随行。¦独立核对材料与费用。`),
next:lines(`回原集团任职¦按内部培训协议和英国许可执行。¦整理培训结项文件。
英国正式工作¦若被英国企业长期录用，须符合另外的英国工作签证规则。¦尽早与HR确认新的CoS需求。
其他学习机会¦如转入英国大学课程，须符合Student独立规则。¦不要用GBM培训许可代替CAS。`),
risks:['GBM Graduate Trainee不是英国大学毕业后的Graduate Visa。','仅企业内部毕业生培训项目且符合集团赞助、经验、岗位要求者可申请。'],
faq:[['中国刚毕业能单独去英国申请吗？','一般不可以。需要真实跨国集团培训项目、海外任职与英国关联机构赞助。'],['与Graduate Visa有什么区别？','Graduate Visa要求英国合格课程完成和英国Student身份；GBM Graduate Trainee是跨国公司内部调派。']],
sourceKeys:['graduateTrainee','graduateTraineeEligibility','sponsors','rates']
}
];
export const ukPathways:OverseasPathway[]=ukRoutes.map(r=>({
 id:r.id,name:r.name,english:r.english,category:r.category,summary:r.summary,audience:r.audience,
 requirement:r.requirements.map(p=>p[1]),documents:r.documents.map(p=>p[1]),
 steps:r.steps.map(p=>p[1]),fees:r.costs.map(p=>p[1]),
 rights:r.rights.map(p=>p[1]),risks:r.risks,
 officialUrl:ukOfficial[r.sourceKeys[0]],secondaryUrl:r.sourceKeys.length>1?ukOfficial[r.sourceKeys[1]]:undefined,
 highlights:r.highlights,availability:r.availability||'check-official'
}));
export const ukRouteById:Record<string,UkRoute>=Object.fromEntries(ukRoutes.map(r=>[r.id,r]));
