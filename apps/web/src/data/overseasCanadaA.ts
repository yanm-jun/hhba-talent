/* Canada federal 2026: verified after the 2026-11-03 Express Entry CRS reform.
 * Immigration advice is time-sensitive; source URLs refer to IRCC official pages.
 */
import type {OverseasCategory,OverseasPathway} from './overseasNewZealand';
export const caVerifiedOn='2026-11-04';
export const caOfficial={
 express:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply.html',
 fsw:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/federal-skilled-workers.html',
 cec:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/canadian-experience-class.html',
 fst:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/who-can-apply/federal-skilled-trades.html',
 category:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations/category-based-selection.html',
 reform:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html',
 jobOffer:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/job-offer.html',
 crs:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html',
 language:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html',
 funds:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/proof-funds.html',
 pnp:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees.html',
 pnpEE:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees/express-entry/get-confirm-nomination.html',
 aip:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/atlantic-immigration/how-to-immigrate.html',
 aipEligibility:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/atlantic-immigration/how-to-immigrate/eligibility.html',
 rcip:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-franco-pilots/rural-immigration.html',
 fcip:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/rural-franco-pilots/franco-immigration.html',
 employer:'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/employer-specific.html',
 francophone:'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/special-instructions/francophone-mobility/eligibility.html',
 study:'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/apply.html',
 studyMoney:'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents/financial-support.html',
 pal:'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents/provincial-attestation-letter.html',
 pgwp:'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation/eligibility.html',
 pgwpField:'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation/eligibility/field-of-study.html',
 quebec:'https://www.quebec.ca/immigration/permanente/travailleurs-qualifies/programme-selection-travailleurs-qualifies',
 quebecInvites:'https://www.quebec.ca/immigration/permanente/travailleurs-qualifies/programme-selection-travailleurs-qualifies/invitation/2026',
 peqClosed:'https://www.quebec.ca/immigration/permanente/travailleurs-qualifies/programme-experience-quebecoise',
 noc:'https://noc.esdc.gc.ca/',
 canadaJobBank:'https://www.jobbank.gc.ca/',
 startup:'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/start-visa.html'
};
export type CaGuideLine=[string,string,string];
export type CaGuideRoute={
 id:string;name:string;english:string;category:OverseasCategory;summary:string;audience:string;
 thresholds:CaGuideLine[];documents:CaGuideLine[];steps:CaGuideLine[];budget:CaGuideLine[];
 timeline:CaGuideLine[];rights:CaGuideLine[];next:CaGuideLine[];
 faq:[string,string][];risks:string[];sourceKeys:(keyof typeof caOfficial)[];terms:string[];highlights:string[];
 occupationTrack?:'express'|'pnp';
};
const P=(a:string,b:string,c:string):CaGuideLine=>[a,b,c];
export const caRoutesA:CaGuideRoute[]=[
{id:'ca-fsw',name:'联邦技术移民 FSW · 海外工作经验',english:'Express Entry Federal Skilled Worker Program',category:'residence',
summary:'加拿大永久居民的联邦技术工人项目，适用于满足连续1年TEER 0–3有薪技能工作、英语/法语至少CLB7、有效学历/ECA和67/100初筛条件的人；资格合格不保证收到ITA。',
audience:'在中国或其他海外有正规全职专业工作、已准备官方语言测试和学历评估、希望在魁北克以外定居的申请人。',
thresholds:[
P('职业：先找到真实NOC 2021','经验通常必须属于TEER 0、1、2或3，并证明完成该NOC职业描述的核心与多数主要职责，不按简历中文职位名称猜。','进入加拿大官方NOC网站搜索实际工作任务，记录5位代码、TEER、主要职责与自己的岗位文件对照。'),
P('连续一年与1,560小时','过去10年内至少1年连续、带薪、同一个主要NOC职业经验；每周最多计入30小时，相当于1,560小时，零碎跨职业工作不能随意拼。','把每份工作开始结束日、周工时、工资单、雇主信和职责按日历整理成一张核验表。'),
P('语言CLB 7和学历ECA','首门英语或法语四项均须至少CLB/NCLC7；海外教育通常需要被指定机构进行移民用途ECA，同时FSW初选分须至少67/100。','预约IRCC接受的语言考试，核对4项CLB换算和2年有效期；再选官方认可ECA机构办理。'),
P('67分合格不是CRS录取分','FSW先过67分初筛，然后Express Entry还有另一个CRS排名机制；2026-11-03新规对加拿大经验和高薪职业offer另行调整积分。','用IRCC FSW官方评分与CRS计算器分别计算两次，不要只拿中介报价的CRS分数当批准结论。'),
P('2026-11-03工作offer LMIA改革','符合条件的FSW工作offer用于项目资格和EE评分自2026-11-03不再需要LMIA；但必须真实，CRS高薪岗位加分有额外条件；与申请雇主工作许可的LMIA不能混用。','查IRCC最新“2026 changes”并更新offer雇主、NOC、开始日期；按官网过渡说明填写尚未更新的旧表单。')
],
documents:[
P('有效的语言考试成绩','需要IRCC认可的英语或法语成绩，单项达到CLB7；申请EE个人资料和正式PR时成绩必须都未过2年。','保存完整成绩单编号、考试日期和各单项分数，不用雅思学术成绩冒充移民类别考试。'),
P('海外学历的ECA','中国毕业证要按IRCC指定机构申请移民用途学历评估，不是学校盖章就自动相当于加拿大学历。','按官网指定机构提交学位及认证材料，保存ECA编号、签发日和学历对应等级。'),
P('有薪技能工作职责证据','雇主推荐信应包含岗位、实际职责、工时、工资、日期、联系人，必要时辅以社保、税务、工资流水。','确保主要职责与NOC 5位代码一致，不改编工作事实。'),
P('资金、体检、无犯罪及家庭','FSW通常需安家资金证明，个别持合法工作许可且有合规offer者适用例外；家庭成员也有身份和背景材料。','按IRCC当年家庭人数资金表准备可支取资金，另列警方证明及体检办理时效。')
],
steps:[
P('1. 查NOC并判断FSW 67分','先确认经验属于EE允许的技能职业并符合连续性，再算语言、学历、年龄等初选分。','建立“NOC职责—我的证据—评分项目”的逐行证明表。'),
P('2. 考语言、办ECA、核资金','分清最低资格与能否获得邀请的CRS竞争分；先处理耗时的语言和学历。','取得有效考试号与ECA报告，查政府资金标准和官方申请费。'),
P('3. 创建Express Entry档案','使用IRCC账户真实填写工作、学历、语言、家属及如适用的真实工作offer。','进入官方IRCC账户，核查新2026高薪offer积分规则、信息一致性和档案有效期。'),
P('4. 收到ITA后才可申正式PR','获邀请后按指定期限提交在线永久居留申请、材料和费用；没有ITA只有入池记录，不是审批结果。','根据IRCC邀请信整理并及时递交，跟进补件与体检请求。')
],
budget:[
P('语言与ECA','考试、补考、学历评估和合法翻译均按机构实际收费；不必向中介购买不存在的“EE入池资格”。','先查IRCC认可考试、ECA指定机构收费，不通过个人购买名额。'),
P('安家资金与政府费','安家资金证明不是交给政府的申请费用，属于申请人需可用的资金；移民申请、工卡和生物识别费用另算。','按家庭人数与签发日期核对官方资金表及适用例外。'),
P('落地预算','租房、机票、医疗过渡保险和家庭迁移开销各省不同。','按目的地城市和是否已有工作另做至少数月收入为零的预算。')
],
timeline:[
P('入池时间','语言、ECA齐备才便于提交完整个人资料，CRS会随年龄、政策和职位更新变化。','随时检查语言有效期、ECA有效期和资料真实性。'),
P('邀请轮次不保证发生','EE不保证每种类别按固定周期发ITA，新2026加分规则的CRS重算窗口还有暂停邀请。','跟踪IRCC公开抽签历史和本人实际账户状态，不按预测分数支付保证费。'),
P('获邀后才进入正式PR审核','审理时间因类别、背景核查及材料完整性变化。','遵守邀请期限，使用IRCC实时processing times工具，不买不可退机票。')
],
rights:[
P('入池不代表可在加工作','Express Entry档案只是移民意向，不会授予加拿大临时工作权。','已申请PR但需要先入境工作时，另查雇主工作许可或合法开放工签。'),
P('获永久居民后与临时工签不同','PR获批后原则可在加拿大长期生活和合法工作，需遵守居民居住义务，魁北克另有移民选拔制度。','读获批COPR与首次入境手续，保存实际在加居住记录。'),
P('配偶与子女资格要分别申报','婚姻、同居和受抚养子女身份按IRCC当期家庭规则确认。','真实申报随行与不随行家属，准备关系证据及背景审查。')
],
next:[
P('被邀请后提交电子PR','只有实际收到ITA才进入正式PR审核，过期语言和未经核实学历可能导致拒签。','核对申请表各字段与证明文件的时间线和职业编码。'),
P('如CRS不足','可改善语言、法语、合法加拿大经验或研究省提名，注意2026工作offer加分和雇佣条件有新规则。','先用IRCC CRS官方计算器做真实差距分析，不购买假LMIA。'),
P('其他项目','有加拿大实际工作经验者可研究CEC，特定技工研究FST，省提名和大西洋计划都有独立要求。','只在满足对应前置条件时才切换申请项目。')
],
faq:[
['FSW的67分是不是拿到永久居民？','不是，67/100是FSW项目前置筛选，之后需要进入EE按CRS排名并被IRCC发ITA，满足正式PR审查才可能获批。'],
['中国的全职工作可以算吗？','有可能。必须在最近10年同一个主要NOC的连续一年带薪TEER 0–3经验，工时、职责和工资真实可验证。'],
['2026年11月3日之后有LMIA会自动加分吗？','不会。EE在2026年11月3日改变了CRS工作经历及高薪工作offer加分机制，LMIA本身不再带来旧式额外CRS分；雇主专属工签是否要LMIA需另查。'],
['没有加拿大offer可以入FSW池吗？','可以存在不要求offer的情况，但仍要满足FSW资格与安家资金等要求。是否被抽选取决于个人CRS和轮次。']
],risks:['2026-11-03新规已生效，旧攻略称“买LMIA就有50/200分”已不符合当前IRCC规定。','不要混淆FSW项目67分、EE CRS排名分数和职业类别筛选。'],
sourceKeys:['fsw','express','reform','jobOffer','crs','language','funds','noc'],terms:['Express Entry','FSW','CRS','ITA','NOC','TEER','CLB','ECA','LMIA','安家资金'],highlights:['近10年连续1年TEER0–3','CLB7及ECA','67分≠CRS分']},
{id:'ca-cec',name:'加拿大经验类 CEC · 境内有薪技能工作',english:'Canadian Experience Class · Express Entry',category:'residence',
summary:'已在加拿大合法取得技能工作经验者申请永久居民的EE项目。通常要求申请前3年累计至少1年1,560小时TEER0–3合法有薪加拿大工作，语言按TEER分别要求CLB7或CLB5。',
audience:'在加拿大取得正规专业工作经历的留学生毕业者或外国临时工作者，计划在魁北克以外永久定居。',
thresholds:[
P('必须在加拿大境内合法工作','TEER0、1、2、3的受雇工作通常需在最近3年内累计1年，1,560小时，每周只按最多30小时计；不是只要有加拿大雇主名称。','核对当时的工签/有效工作许可、实际工作地点、雇佣合同、工资和NOC职责。'),
P('全职学习期间的工作通常不计','全职学生时期获得的普通兼职和co-op实习通常不算CEC经验；自雇工作一般不计，部分医师存在例外。','将毕业前后的工作分开统计，避免把留学期间所有兼职计入1年经验。'),
P('语言分职业TEER','TEER0/1工作要求英语CLB7或法语NCLC7；TEER2/3要求CLB5或NCLC5，均要求听说读写四项达线。','以真实NOC和TEER核定语言门槛，核查语言证书是否为IRCC认可考试。'),
P('没有统一学历最低门槛','CEC没有统一的最低学历要求，但学历和有效ECA可提升EE排名；有加拿大经验不代表会被邀请。','按2026 CRS改革计算加拿大合法工作经验分，清楚区分职业资格与评分优势。')
],
documents:[
P('加拿大合法工作许可','相应时期工签和入境/工作身份文件能证明你有权为加拿大雇主工作。','逐段核对合法工作资格与有效期，学签期间兼职与毕业后工签要分别列出。'),
P('加拿大工资与税务','工资单、T4、税务Notice of Assessment、正式雇主信等用于佐证工资、工时与NOC职责。','从CRA和雇主取得可核验的年度及月度记录。'),
P('语言测试结果','TEER0/1与TEER2/3要求不同，成绩仍须在EE与正式申请时有效。','准备IRCC接受的CELPIP、IELTS General或相应法语考试证据。'),
P('家庭与背景资料','永久居民申请需要按IRCC条件准备护照、体检、无犯罪及家庭资料。','如携家属，提前确定其关系证据与体检、背景审核要求。')
],
steps:[
P('1. 计算近3年工时','将工作按日期、雇主、实际加拿大工作地点与NOC分组。','累计至少1560小时，每周计入不超过30小时，排除不合资格的学生、自雇、无薪经历。'),
P('2. 按TEER考语言并查CRS','先达到具体CLB门槛，再计算2026改革后的CRS排名。','使用官方IRCC工具而非旧版加分表。'),
P('3. 进入EE候选池','填报加拿大雇主与职责、合法工作资格、学历/语言、配偶等信息。','上传或待邀准备完整证明材料，定期更新合法工作年限。'),
P('4. 获ITA后正式PR申请','收到邀请后提交证据和背景资料、缴费，等待审理。','不要因为进入候选池就辞职或认为工签自动延长。')
],
budget:[
P('有薪加拿大经验需要证据','T4和税务/工时证明属于真实性文件，不是可在市场购买的“移民分数包”。','向雇主和CRA取得记录，拒绝买加拿大经验的违法交易。'),
P('语言/体检/PR申请费','移民语言考试、体检、无犯罪、翻译与联邦PR处理费分项核算。','以申请时IRCC官网收费为准。'),
P('生活与现有工作许可','从工签到PR可能有空档，要保证始终具备合法身份及现实生活资金。','另核查是否符合bridging open work permit，不能默认为任何EE申请人都可申请。')
],
timeline:[
P('近3年工作经验时间窗','从正式申请日倒推近3年内满足的合法就业，太早的经历可能不计。','做滚动经验表，记录每周最多30小时。'),
P('2026 CRS重新计分','2026年11月3日起加拿大经验及高薪offer加分规则调整，系统可能暂停抽选完成重算。','查看账户实际最新CRS分及IRCC轮次公告。'),
P('工作许可到期风险','入池或获邀并不自动令已有工签延长。','在许可到期前了解合法延期、桥梁工签的严格资格。')
],
rights:[
P('CEC属于移民筛选而不是工签','处于CEC候选池没有额外在加工作的权利。','依据自己当时拥有的工签或其他合法工作许可判断。'),
P('永久居民须另外获批','申请和批准PR是独立阶段，不能仅凭1年工作获得移民身份。','收到正式确认后办理PR入境/在境内确认手续。'),
P('通常应计划魁北克以外生活','联邦CEC申请人一般需要表明在魁北克以外居住的计划。','如果计划定居蒙特利尔或魁北克，核查魁省移民选拔程序。')
],
next:[
P('CEC邀请到来时','确认最初工作经验时间、语言考试、职业编码均可被证明。','按邀请信提交完整材料和证据。'),
P('工作年限不足时','继续合法工作并按真实TEER计入经验，同时考虑合法PGWP期限。','向雇主及时获取工资证明。'),
P('其他路径','有省提名或合格雇主的申请人也可能考虑PNP、AIP等。','核查省份意愿和真实工作条件。')
],
faq:[
['加拿大留学时的兼职算CEC一年工作吗？','通常不算。全职学生时期的工作和co-op一般排除，毕业后合法、符合TEER的有薪加拿大经验才按标准计。'],
['CEC是不是需要加拿大大学学位？','没有统一最低学历门槛，但真实语言、合法加拿大工作经验必须符合。加拿大或有ECA的海外学历有机会影响排名。'],
['在加拿大远程为中国公司工作可以算CEC吗？','通常要求人实际在加拿大并为加拿大雇主工作，需核查IRCC关于远程工作的具体规定。'],
['我有PGWP是否保证最后拿PR？','不保证。PGWP只是符合条件毕业生可申请的临时工作许可，CEC还需合法经验、语言和竞争性ITA。']
],risks:['不要把全职学生期间的实习、普通兼职当作CEC经验。','2026新CRS加分不等于符合CEC即自动邀请。'],
sourceKeys:['cec','express','language','reform','crs'],terms:['CEC','NOC','TEER','CLB','CRS','PGWP','ITA','T4'],highlights:['近3年合法工作≥1年','TEER0/1 CLB7','TEER2/3 CLB5']},
{id:'ca-fst',name:'联邦技工类 FST · 有资格的熟练技工',english:'Federal Skilled Trades Program · Express Entry',category:'residence',
summary:'联邦熟练技工永久居民项目。通常需要近5年两年共3,120小时符合规定的有薪技工工作，满足英语/法语分项门槛，还需要有效至少一年全职工作offer或加拿大主管部门出具的技工资格证。',
audience:'有焊接、电工、机修、建筑等特定NOC技能职业经历，希望申请加拿大永久居民的真实技术工人。',
thresholds:[
P('职业限规定的熟练技工NOC组','只覆盖加拿大联邦FST列明的特定TEER2/3技能技工组，非所有“制造业/工厂”都算。','在IRCC FST官方清单中查具体NOC五位编码及工作任务。'),
P('近5年2年和3,120小时','至少近5年两年有薪熟练技工工作，计时上限按每周30小时计算。','整理可核验工作合同、技工证、工时及工资；跨行业的普通工作不可以拼凑。'),
P('必须有offer或加拿大技工资格证','需至少1年有效全职工作offer，或省/地区/联邦主管机构发的Certificate of Qualification，海外国内技能证不能自动替代。','若选资格证路线，先确认省级行业管理部门是否接受海外经验评估及考试。'),
P('语言听说CLB5、读写CLB4','英语听说至少CLB5，读写至少CLB4（法语按相应NCLC），每一项都需要官方测试证据。','查IRCC接受的语言考试，并按四项实际分数分别换算。'),
P('2026 LMIA规则与工签不要混','2026-11-03 EE项目中的合格offer不再以LMIA为必要条件，但FST本身的真实offer/技能证前置条件仍然存在。','检查IRCC最新改革与真实签证类别，办理临时雇主工签仍有自己的LMIA规则。')
],
documents:[
P('真实技工经验证明','证明近5年技能工作年限、工时、薪资、职责及雇主真实性。','按主要技工NOC职责逐项对照。'),
P('加拿大offer或官方技工证书','加拿大省/地区/联邦出具的合格技能认证或真实至少一年全职offer。','核对发证主体和有效性；不购买虚构job offer。'),
P('合格英语或法语成绩','指定语言考试听说、读写分别满足CLB5和4。','保存成绩单原件和考试日期。'),
P('家庭与资金文件','签证资格、安家资金、无犯罪和健康检查按类别准备。','如果已有加拿大合法工作及有效offer，核对是否享有资金证明例外。')
],
steps:[
P('1. 在官网核准NOC技工组','建筑、焊接、机械等类别的实际职责必须对应政府五位代码。','保存官方职业描述与本人合同对照表。'),
P('2. 统计3120小时真实工作','过去5年内累积两年工作且遵守每周计入工时限制。','以税务、工资、雇主信佐证。'),
P('3. 选择offer或资格证路线','有一年以上有效offer或加拿大官方资格证方可满足关键前置条件。','查具体省份是否有职业技能考核和持证门槛。'),
P('4. 语言达标、入EE、等待ITA','符合FST后参与EE CRS竞争，受邀才递交正式PR。','按2026官方CRS评分和岗位offer政策更新资料。')
],
budget:[
P('技工资格评估与考试','省级技工证评估、实践考试可能收费，金额和可报考条件因省份而异。','先向省官方资格主管机构查证。'),
P('语言与PR费用','考试、翻译、体检、背景资料与联邦PR申请费分别列出。','以IRCC实时申请费为准。'),
P('安家资金不是“买省提名”费用','FST一般按PR资金规则核对，符合具体加拿大合法工作安排者可能豁免。','根据家属数和资格例外查当前IRCC资金表。')
],
timeline:[
P('技能资格考试期限','某些省会先评估培训和实践资格，再安排理论/实操考试。','不要先交中介“保证技工资格证”费用。'),
P('就业offer真实时限','至少一年真实全职有效offer，日期和雇主情况应符合IRCC当期规定。','在EE资料和PR申请时更新工作offer具体信息。'),
P('CRS竞争和邀请','技能职业满足FST最低条件不自动受到优先邀请。','同时关注2026技工类别筛选与当期邀请要求。')
],
rights:[
P('FST本身不给工作许可','进入FST候选池不允许无工签在加拿大合法受雇。','另行申请雇主专属工签或其他合法工作身份。'),
P('技工职业还可能受省级监管','省技工证及相关职业许可可以影响能否在当地独立执业。','到实际工作省份官方确认职业许可证。'),
P('获批PR后的长期发展','永久居民身份与工签不同，仍须遵守合法定居和其他规定。','保留正式确认与入境居留信息。')
],
next:[
P('找不到offer时','考虑官方技工资格考核路径，不能用国内任意等级证代替。','联系准备落脚省的行业主管机关。'),
P('有技工offer时','可核查是否还符合临时雇主工签、各省技能类PNP。','分别审查工作许可的LMIA与永久居民的EE规则。'),
P('其他EE类别','具体职业如符合2026技能类别筛选，可能在满足EE前置条件后参与类别抽签。','不要误将职业上榜视为保证获邀。')
],
faq:[
['FST需要加拿大本科文凭吗？','FST没有统一学历最低门槛，但工作经验、语言和工作offer或加拿大官方技能资格证要求必须符合。'],
['中国焊工证就是加拿大Certificate of Qualification吗？','不是。FST要求的是加拿大省、地区或联邦主管机构认可颁发的技能资格证，应查如何评估海外工作和报考资格。'],
['2026取消LMIA是不是找任何雇主offer都可以？','不是。FST仍必须拥有符合规定的真实offer或加方职业资格证，且EE申请和临时工作许可的规则完全不同。'],
['只有1年技工经历可以进FST吗？','通常不可以。该项目要求最近5年累计至少2年、3120小时的合格熟练技工经验。']
],risks:['FST只涵盖官方列明的技工NOC，不是任意工厂工作。','海外职业证书并非自动等同加拿大主管机构的技工资格证。'],sourceKeys:['fst','express','category','jobOffer','reform','language','noc'],terms:['FST','NOC','TEER','LMIA','CLB','ITA','CRS'],highlights:['近5年技工2年','听说CLB5读写CLB4','offer或加拿大技工资格证']},
{id:'ca-express-categories',name:'2026 EE职业/法语类别邀请 · 不是独立签证',english:'Express Entry Category-Based Selection 2026',category:'residence',
summary:'这是对已满足FSW/CEC/FST至少一项最低条件的Express Entry候选人实施的分类邀请办法，不是独立签证。2026类别包括法语、医疗、STEM、技工、教育、运输，以及在加医生、高管、研究人员等特定人群。',
audience:'已经满足至少一种EE基础项目，并拥有IRCC 2026指定职业NOC工作经验或法语NCLC7等证据的候选人。',
thresholds:[
P('必须先满足FSW/CEC/FST之一','类别邀请只是EE池内的另一种邀请方式，职位在名单上也不能跳过联邦项目资格。','先确定自己的EE主项目、NOC、语言与工作经历是否合格。'),
P('2026职业分类与具体NOC名单','医疗社会服务、STEM、技能技工、教育、运输等都是按官方2026表的具体NOC，不是所有软件、所有护士或所有工厂都自动符合。','进入IRCC实时类别表按5位NOC对照岗位主要职责、TEER与工作场所。'),
P('多数职业类近3年需12个月经历','大多数职业类别要求最近3年某单一列明NOC至少12个月可累计全职或等值兼职经验，可以在加拿大或海外；医生/高级管理/研究类具体要求在加拿大。','逐类别查看IRCC说明，区分工作经验发生在加拿大还是海外。'),
P('法语类别须NCLC7四项','法语类通常要求官方法语考试听说读写全部至少NCLC7，不能用英语CLB7或仅法语口语替代。','取得IRCC接受的TEF Canada或TCF Canada等法语考试证明。'),
P('不同类别不保证年度有抽签','IRCC明确类别轮次是补充，不保证每个类别都一定发ITA；邀请仍按具体轮次分数排名。','持续查看类别轮次公告和自己的CRS，按11月3日新规则更新EE资料。')
],
documents:[
P('官方NOC类别与职责','确定五位NOC及2026分类表属于哪个类别，实际职责符合职业定义。','保存官方类别清单页面及个人雇主证明。'),
P('相应12个月专业经历','职位、日期、工时、地点、工资证据必须符合该类别。','按某一符合类别的单个NOC累计证据，不将多个不相干NOC拼凑。'),
P('法语测试或加拿大特殊类别经历','法语类别须NCLC7四项，特定在加医师、高管、研究人员类别须有加拿大本地经验。','整理考试成绩或加拿大合法工作证明。'),
P('主EE项目材料','仍需FSW、CEC或FST项目所需语言、学历、资金及家属资料。','根据主项目逐项准备，不能只上传职业类别截图。')
],
steps:[
P('1. 先确认符合某一EE联邦项目','判断FSW、CEC或FST的法定最低要求。','未满足者不应因为在“紧缺职业表”中就认为能直接申请PR。'),
P('2. 选择对应2026类别','根据官方十项类别清单核对特定NOC、工作时间和地点。','使用站内职业筛选并进入IRCC官方表核对实时变化。'),
P('3. 创建/更新EE档案','填写NOC、经验、语言、薪资及当期CRS规则。','保存真实工作的工资税务和雇主职责记录。'),
P('4. 关注邀请并正式申请','仅符合类别不会自动收到ITA，IRCC可能按不同轮次及分数邀请。','获邀后根据相应主项目提交完整PR材料。')
],
budget:[
P('类别邀请本身不出售名额','不存在个人向IRCC购买医疗、STEM或法语类别抽选名额的合法程序。','拒绝所谓“保证抽中某类别邀请”的出售服务。'),
P('语言和职业核验成本','法语考试、学历评估及职业资格可能产生实际个人费用。','不要在未验证职业NOC前支付虚假岗位认证费。'),
P('主项目申请与安家资金','按FSW/CEC/FST相应规定另做PR和居住预算。','根据主项目的真实资金规则与适用例外判断。')
],
timeline:[
P('职业经验时间窗为最近3年','大多数2026职业类别要求最近3年累积12个月合格NOC工作，需核对类别细则。','以计划轮次日期倒推实际经验期。'),
P('IRCC类别可逐年改变','本页面核验日期2026-11-04，2027可能增删职业。','正式入池或获邀前重新查看官方表。'),
P('新CRS规则影响排名','2026-11-03起工作邀请和加拿大经验评分改变，抽选可能因重算短暂暂停。','参考本人账户实际CRS而不是中介旧表。')
],
rights:[
P('类别筛选不是签证','入EE类别不赋予加拿大工作、学习或永久居留权。','按目前有效加拿大临时身份守法居留。'),
P('获邀也不是获签','ITA只允许在规定期限内提交正式PR申请。','继续保留真实职业证据以供审查。'),
P('特殊职业通常另有执照','护士、医师、工程师等在部分省从业需要监管执照，PR类别符合不等于可以执业。','提前核对工作地省级职业监管机构。')
],
next:[
P('类别不符合时','仍可能按适用主EE一般邀请或研究省提名。','不造假NOC或借用他人工作经历。'),
P('加拿大工作经验提升CRS','合法加拿大工作年限可能影响新2026劳动力市场融入评分。','只计算有实际工资及合法工作许可的加拿大经历。'),
P('法语真实达标','法语官方成绩符合要求可研究法语类别，具体邀请仍按规则竞争。','用IRCC官方换算表核查听说读写四项。')
],
faq:[
['职业在2026类别名单上就会被直接发邀请吗？','不会。必须先符合FSW/CEC/FST之一，在EE池中符合类别规则并达到相关轮次的竞争分数。'],
['12个月职业经验可以是在中国做的吗？','多数2026普通职业类允许加拿大或海外相同NOC经验，需最近3年累计至少12个月；专门的在加医师、高管、研究类别则有加拿大经验要求。'],
['计算机程序员一定在2026 STEM列表里吗？','不能这样推断。2026 STEM类按官方具体NOC代码列示，例如网络安全专家21220、土木工程师21300、机械工程师21301；未列出的编程职位不自动入选。'],
['法语只需要能说几句就行吗？','法语类别通常要求IRCC认可成绩四项均达到NCLC7，并且还要满足一条EE基础项目资格。']
],risks:['不能以某省招聘广告中的“缺人”自动推断NOC已进入2026EE类别表。','2026-11-03新的CRS/offer评分规则应优先于旧版50/200分口径。'],sourceKeys:['category','express','reform','crs','language','noc'],terms:['Express Entry','NOC','TEER','CRS','ITA','CLB','NCLC','CEC','FSW'],highlights:['必须先符合FSW/CEC/FST','2026十类官方分类','NOC与工作年限核验'],occupationTrack:'express'},
{id:'ca-pnp-express',name:'省提名 PNP · Express Entry快速通道',english:'Enhanced Provincial Nominee Program · Express Entry',category:'residence',
summary:'符合某省/地区的有效省提名类别且符合FSW、CEC或FST项目要求的人可走EE衔接通道，接受有效省提名后可获得额外600分，但必须真正满足提名省的定居意愿和工作等条件。',
audience:'愿意在指定省份生活、满足该省现行开放流及联邦EE最低标准的申请人，不包括“随意买省提名”的人。',
thresholds:[
P('先确定具体省和申请流','省提名不是全国统一资格。安大略、BC、阿尔伯塔、曼尼托巴等各有工作、专业、邀请及居住要求，部分只邀请特定职业。','先按省份筛选并进入省移民局官方stream页面查是否开放、职业和评分条件。'),
P('同时满足EE联邦项目','增强型PNP通道要求有符合资格的Express Entry档案，且符合至少一个FSW/CEC/FST项目。','提供准确EE Profile Number和Job Seeker Validation Code供省份核对。'),
P('收到省提名后须接受','有效EE省提名在IRCC账户中确认，通常30天内接受或拒绝；接受后增加600额外CRS分。','查IRCC官方账户省提名消息，并在期限内回应。'),
P('真实在该省定居的意愿','省提名通常基于在该省生活工作意愿，购买虚假offer或申请后马上故意离省可能影响诚信审查。','准备真实城市、工作、生活与家庭联系计划。')
],
documents:[
P('该省具体类别资格文件','不同省流需要雇主支持、职业证、工作经验、教育或法语英语；不可套用一个省的规则给另一个。','到省官网查独立移民stream的材料清单。'),
P('有效EE档案及编号','EOI与EE是不同系统，需要按省要求提供EE Profile Number及job seeker validation code。','直接从个人IRCC账号提取真实编号。'),
P('工作offer及省居住联系','若省流要求工作邀请或同省工作经验，应有可核实的正式雇主和税务证据。','不向个人购买“担保名额”或假地址。'),
P('联邦PR及家属材料','省提名证书并不是联邦PR批文，仍要申请IRCC永久居民及背景核验。','按受邀通知提交语言、学历、无犯罪、体检及家庭材料。')
],
steps:[
P('1. 选省和具体有效stream','加拿大魁北克和努纳武特没有PNP，其他参与省区每个stream开放状态可能不同。','进入省政府官网逐项记录报名条件、是否抽选、截止日。'),
P('2. 准备基础EE与省份申请','先满足联邦项目，再提交所选省份的EOI或省提名申请，具体先后顺序按省要求。','不要把省官网付款与IRCC联邦PR付款混成一笔。'),
P('3. 接受PNP提名增加600分','省提名通过后在EE账户中通常30天内接受/拒绝。','核对省提名证号和有效期，及时接受并检查CRS更新。'),
P('4. 等IRCC邀请提交正式PR','省提名加600分有助排名但不自动发放永久居民身份。','收到ITA后递交联邦阶段文件、费用和背景审查。')
],
budget:[
P('省政府申请费','不同省/stream费用有差异，有的会变动，不能声称所有省都是同一个收费标准。','查看所选省政府申请页面及正式收款平台。'),
P('联邦阶段费用另算','省提名通过后仍须向IRCC支付实际PR申请及适用生物识别费。','区分省申请费、联邦PR费、资金证明。'),
P('安家资金与实际搬迁','部分PNP需资金与当地住房、租房预算，依联邦项目及省stream判断。','在计划定居城市计算实际家庭开支。')
],
timeline:[
P('不同省stream开放时间不同','部分省按邀请轮次而非全年接受申请，配额或职业名单会随时变化。','只使用当前官方开放状态，不把去年轮次当成2026正在开放。'),
P('IRCC接受提名的时间窗','有些省提名信息在EE账户通常需30日内接受。','记录提名有效期，别因遗忘接受导致失效。'),
P('联邦PR审理另计','省批准并不代替联邦健康/品行和其他条件审核。','使用IRCC实时处理时间查询，避免对客户保证固定月份拿卡。')
],
rights:[
P('获提名不等于有工签','省提名或EOI不能让境外申请人无需合法许可直接赴加工作。','如需提前工作应单独核查工作许可和雇主支持条件。'),
P('提名建立在省份定居意愿之上','需要有真实在该省生活与工作计划。','申报时不要虚构地址、劳动合同或家庭关系。'),
P('获得联邦PR后仍须维护身份','最终PR由IRCC决定，正常居住义务和当地法律适用。','妥善保存签证和在加居住资料。')
],
next:[
P('省提名到EE PR','省提名接受后更新CRS等待邀请，提交正式PR材料。','持续更新职业/家庭和语言资料避免过期。'),
P('不符合EE时','可能存在非EE基础型省提名，但要求和联邦申请流程不同。','研究该省base PNP，不假定同样能获600 CRS。'),
P('省提名流关闭时','不能向中介购买已经关停的stream名额。','选择另一个真实开放省份和符合自身条件的流。')
],
faq:[
['每个省提名拿到后都有600分吗？','600额外CRS分属于与EE衔接、本人接受确认的有效省提名；不通过EE的基础型PNP不适用同一CRS积分过程。'],
['魁北克也能申请PNP吗？','魁北克不参加联邦PNP；有自身的PSTQ/Arrima及省选拔制度。努纳武特也没有PNP。'],
['省提名是不是意味着马上获得加拿大永久居民？','不是。提名由省批准，最终永久居民仍由IRCC审查并正式决定。'],
['省提名一定需要雇主offer吗？','各省不同stream差异大，有些要求offer或省内经历，有些依人力需求采用其他标准，必须以具体2026省官网为准。']
],risks:['不得把“省提名申请意向”当作“已获600分”。','各省stream的政策、职业、配额变化频繁，页面不能保证所有省流均常年开放。'],sourceKeys:['pnp','pnpEE','express','reform','crs'],terms:['PNP','Express Entry','CRS','ITA','EOI','NOC','TEER','IRCC'],highlights:['省提名成功增加600分','同时符合EE主项目','需要真实定居意愿'],occupationTrack:'pnp'}
];
