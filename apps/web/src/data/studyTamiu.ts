/* HHBA / TAMIU evidence dossier — reviewed 2026-10-31.
 * One actual MBA degree and officially documented concentrations; online delivery
 * does NOT establish eligibility for an F-1 campus-based course of study.
 */
export const tamiuSources = {
 university:{label:'大学官网及学校介绍',url:'https://www.tamiu.edu/'},
 business:{label:'A.R. Sanchez 商学院（含校区与线上说明）',url:'https://www.tamiu.edu/arssb/'},
 accreditation:{label:'商学院认证及研究生专业目录',url:'https://catalog.tamiu.edu/graduate-information/a-r-sanchez-jr-business/'},
 degree:{label:'MBA 2026–27 学术目录与课程结构',url:'https://catalog.tamiu.edu/graduate-information/a-r-sanchez-jr-business/master-business-administration-mba/'},
 mbaIntl:{label:'MBA 国际商务方向课程',url:'https://catalog.tamiu.edu/graduate-information/a-r-sanchez-jr-business/master-business-administration-concentration-international-business-mba/'},
 admission:{label:'研究生院申请指南、语言标准及截止日期',url:'https://www.tamiu.edu/gradschool/admissions.shtml'},
 catalogAdmission:{label:'2026–27 研究生官方招生规则',url:'https://catalog.tamiu.edu/graduate-information/admissions/'},
 program:{label:'MBA 与其他研究生项目入学要求',url:'https://www.tamiu.edu/gradschool/programrequirements.shtml'},
 graduate:{label:'研究生院完整项目目录',url:'https://www.tamiu.edu/gradschool/'},
 costs:{label:'2026–27 大学官方学年费用预算',url:'https://www.tamiu.edu/finaid/26-27-cost-of-attendance.shtml'},
 tuition:{label:'2026–27 官方学分学费及其他费项目',url:'https://catalog.tamiu.edu/student-services/student-fees/'},
 funding:{label:'研究生财政资助、助教与奖学金资格',url:'https://www.tamiu.edu/gradschool/financialassistance.shtml'},
 intlFunding:{label:'国际学生资助资格说明',url:'https://www.tamiu.edu/finaid/international-students.shtml'},
 scholarship:{label:'奖学金入口 Fund$Finder',url:'https://www.tamiu.edu/finaid/scholarships.shtml'},
 campusPhotos:{label:'学校官方虚拟校园导览',url:'https://www.tamiu.edu/prospect/virtualtour.shtml'}
} as const;

export type TamiuPhoto={id:string;file:string;fileName:string;title:string;description:string;creator:string;date:string;license:string;licenseUrl:string;sourceUrl:string;note:string};
export const tamiuPhotos:TamiuPhoto[]=[
 {id:'canseco',file:'canseco-hall.jpg',fileName:'Dr. F.M. Canseco Hall, TAMIU, Laredo, TX IMG 5425.JPG',title:'Dr. F. M. Canseco Hall',description:'德州农工国际大学 Canseco Hall 实景，校园教学建筑，不是其他学校的照片。',creator:'Billy Hathorn',date:'2012-09-26',license:'摄影者自愿释出公共领域（PD-self）',licenseUrl:'https://commons.wikimedia.org/wiki/Commons:Licensing#Public_domain',sourceUrl:'https://commons.wikimedia.org/wiki/File:Dr._F.M._Canseco_Hall,_TAMIU,_Laredo,_TX_IMG_5425.JPG',note:'本地网页按容器尺寸显示，可能裁切边缘；未用 AI 生成内容。'},
 {id:'killam',file:'killam-library.jpg',fileName:'Sue and Radcliffe Killam Library, TAMIU, Laredo, TX IMG 5427.JPG',title:'Sue & Radcliffe Killam Library',description:'2012 年拍摄的 TAMIU Killam 图书馆建筑实景，并不代表其今天的内部装修。',creator:'Billy Hathorn',date:'2012-09-26',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:Sue_and_Radcliffe_Killam_Library,_TAMIU,_Laredo,_TX_IMG_5427.JPG',note:'按比例裁切展示并标明授权，未以照片暗示课程所在教室。'},
 {id:'trade',file:'trade-center.jpg',fileName:'Western Hemispheric Trade Center, TAMIU, Laredo, TX IMG 5432.JPG',title:'Western Hemispheric Trade Center',description:'学校 Western Hemispheric Trade Center 的真实建筑影像，与另外两张校园照片并非同一建筑。',creator:'Billy Hathorn',date:'2012-09-26',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:Western_Hemispheric_Trade_Center,_TAMIU,_Laredo,_TX_IMG_5432.JPG',note:'保留来源、摄影者和许可；页面仅展示本地静态影像。'}
];

export const tamiuFacts=[
 {label:'学校简称',value:'TAMIU'},
 {label:'所在城市',value:'Laredo, Texas'},
 {label:'办学性质',value:'公立大学'},
 {label:'大学体系',value:'Texas A&M System'},
 {label:'商学院认证',value:'AACSB'},
 {label:'首批详解',value:'MBA · 1 个学位'}
];

export const tamiuOverview=[
 {heading:'学校定位与所在城市',body:'Texas A&M International University 位于美国得克萨斯州 Laredo，是 Texas A&M University System 下的一所公立大学。Laredo 临近美国与墨西哥边境，其城市经济与跨境贸易、物流和多语言商业活动具有较强联系。对申请商科硕士的学生来说，这种地理环境可能为理解国际商务提供观察视角，但不能把城市产业特点直接等同于保证实习或就业。',source:tamiuSources.university.url},
 {heading:'A. R. Sanchez, Jr. 商学院',body:'TAMIU 的 A. R. Sanchez, Jr. School of Business 提供 MBA、MPAcc、信息科学硕士以及国际工商管理博士等项目，研究生商科专业获得 AACSB International 认证。学校公布了国际贸易、银行与金融、管理、国际商务等 MBA 方向。各方向的课程学分与授课形式有差异，应以具体专业目录、研究生院和院系确认结果为准。',source:tamiuSources.accreditation.url},
 {heading:'学习设施与校园实景',body:'校园内有 Sue & Radcliffe Killam Library、Dr. F. M. Canseco Hall、Western Hemispheric Trade Center 等可核实的建筑。我们选用 2012 年的真实建筑照片以辨认校园景观，并在图库明确注明年份。大学官方虚拟校园导览可帮助了解其他建筑与位置，但不会把网页上的照片冒充今年的课堂现场。',source:tamiuSources.campusPhotos.url},
 {heading:'跨专业与线下申请的关键区别',body:'学校 MBA 学术目录会根据本科所学专业确定需要选修的不同商科基础课程，这说明非商科背景需要逐项接受学术评估，而不是无条件豁免全部先修。商学院虽同时提供线上 MBA 课程，但有线上学习形式不等于国际申请人可以仅靠这个项目获发 F-1 所需 I-20。正式选择线下课程之前，必须核实具体方向、该学期的校内授课、全日制注册要求以及国际办公室的 I-20 政策。',source:tamiuSources.degree.url}
];

export const tamiuMbaCurriculum=[
 {name:'商业研究与战略管理',course:'BA 5310 / BA 5390',detail:'学术目录列出 Business Research Methods 与 Strategic Management，涉及研究设计、判断商业问题、组织决策与战略取舍。课程编号以 2026–27 目录为准，修读顺序及实际开课时间由学校决定。'},
 {name:'财务报表、经济与财务管理',course:'ACC 5310 / ECO 5310 / FIN 5310',detail:'MBA 核心课程候选包括财务报表分析、管理经济学与财务管理。学校会根据学生本科背景确定四至五门基础课程的组合；不是每位学生都照抄相同的课程清单。'},
 {name:'管理、市场与组织分析',course:'MGT 5310 / MKT 5310',detail:'管理概念研讨和营销管理研讨帮助申请者理解组织运营、市场竞争和商业管理语境。具体学科深度、先修与选课限制以商学院逐学期的课程安排为准。'},
 {name:'国际商务与贸易物流方向',course:'BA 5320 / BA 5330 等',detail:'国际商务方向目录收录全球商业环境、国际商法、国际金融市场等课程；相关方向还覆盖国际贸易与物流。不要把不同 concentration 混成一张“所有学生必修”的课程表。'}
];
export const tamiuMbaConcentrations=[
 {name:'国际银行与金融',en:'International Banking and Finance',note:'适合关心国际金融市场、金融管理及相关跨境业务的申请者。实际课程与数学准备仍需单独核实。'},
 {name:'国际商务',en:'International Business',note:'学校有英语与西语相关的国际商务方向；申请者需核实自己选择的是哪种语言与授课形式。'},
 {name:'国际贸易与物流',en:'International Trade and Logistics',note:'强调跨境贸易、物流与国际经营的方向，课程和选课方式应以对应项目目录为准。'},
 {name:'管理学',en:'Management',note:'关注组织、管理分析和企业运营；官网列表存在在线学习选项，不能默认可以线下办理学生签证。'},
 {name:'医疗管理',en:'Healthcare Administration',note:'官方商学院列为 MBA 方向之一，部分页面明确标注在线形式；须另核实线下可行性。'},
 {name:'刑事司法管理',en:'Criminal Justice',note:'MBA 跨学科应用方向，不等于法学硕士或刑事司法职业资格。部分路径标注 online。'}
];
export const tamiuAdmission={
 exam:[
  '研究生最低英语参考：TOEFL iBT 79；IELTS Academic 6.5；PTE Academic 53。学校当前 2026–27 学术目录另列 Duolingo 115；招生网页未完整列出 Duolingo，需要以申请年份研究生院确认为准。',
  '商学院规定：若本科高年级 GPA 达到 3.00 或已获得认可的进阶学位，可能免交 MBA 申请使用的 GRE/GMAT；不符合该规则的申请人不能直接认为免考。',
  '不同申请项目及特殊背景可能有更高要求；语言成绩发送渠道与有效期必须由校方核对。'
 ],
 tasks:[
  '在研究生院确认当前招生的 MBA concentration、线下或在线授课形式；需要 F-1 的学生首先向校方询问该专业是否可签发 I-20。',
  '根据官方研究生院网页进入 ApplyTexas，准备国际研究生正式申请；国际生费用在 2026–27 学术目录中列为 US$50，支付前仍核实系统实际金额。',
  '由原就读学校按要求发送全部正式大学成绩单与学位/毕业证明；非英语原件按学校要求译制和进行学历等同评估。',
  '核对本科高年级 GPA 是否达到 3.00 的 GRE/GMAT 豁免条件；若不满足，按项目当前政策补足必需考试或申请材料。',
  '提供达到招生要求的官方语言成绩；TOEFL/IELTS/PTE 以研究生招生说明为准，Duolingo 需要特别复核当年目录。',
  '如项目要求，准备学生陈述、推荐信、简历或学术背景说明；以当年 MBA 项目表单和申请系统为准，不虚构统一的推荐信数量。',
  '提交申请后查看学校申请状态及缺件通知；国际生学校网页公布首选截止日，并非所有专项方向一定按该时间招生。',
  '在录取及国际办公室确认学生身份后，准备资金证明、护照与校方要求的 I-20 申请材料；学生签证需由美国主管机构独立审批。'
 ],
 deadlines:[
  {name:'秋季国际研究生申请',month:'6 月 1 日',note:'学校研究生院当前公布的 preferred deadline；注意目标入学年份。'},
  {name:'春季国际研究生申请',month:'10 月 1 日',note:'学校研究生院当前公布的 preferred deadline；不代表仍接受该年申请。'},
  {name:'Summer I 国际申请',month:'3 月 1 日',note:'该学期 MBA 是否有适合 F-1 线下学生的开课安排，需特别确认。'},
  {name:'Summer II 国际申请',month:'4 月 1 日',note:'实际 MBA 开课方向与最新截止须核验。'}
 ]
};
export const tamiuCost=[
 {name:'研究生学杂费',value:'US$10,778',note:'2026–27 非居民研究生校内住宿年度 COA 估算，秋季＋春季，按每学期 6 学分假设。'},
 {name:'教材/课程材料',value:'US$648',note:'官方 COA 年度预算，不等于个人必然购买的金额。'},
 {name:'生活开支',value:'US$13,394',note:'官方 On-Campus 预算的生活项目，不代表所有住宿房型的真实价格。'},
 {name:'交通',value:'US$572',note:'官方年度估算，出入境机票和个人差异可能另外增加成本。'},
 {name:'个人杂费',value:'US$2,980',note:'官方年度估算，并非学校保证能够覆盖全部个人支出。'},
 {name:'学校年度预算合计',value:'US$28,372',note:'官网 Graduate Non-Resident On-Campus 对应参考总额；不是整段 MBA 学位总成本或 I-20 官方最低资金保证。'}
];
export const tamiuFunding=[
 {name:'研究生 Assistantship',amount:'最高 US$15,000 / 9 个月',note:'官网列明兼职约 20 小时/周、需要录取、GPA 3.250 与每学期 9 研究生学分，明确“不代缴学杂费”；不是人人自动获得。'},
 {name:'研究生 Fellowship',amount:'最高 US$9,000 / 学年',note:'官网列明约 10 小时/周、GPA 3.250 与每学期 6 研究生学分，明确“不代缴学杂费”；须按项目申请。'},
 {name:'研究生 Scholarship',amount:'最高 US$3,000 / 学年',note:'官网列明最低 GPA 3.500、每学期 6 研究生学分；资格需独立核实。'},
 {name:'Business Fellowship',amount:'金额与资格按院系公布',note:'商学院为符合要求的 MBA 等研究生开设机会，具体年度、是否接收国际生及名额需核验。'}
];
export const tamiuFaq=[
 {q:'TAMIU 与 Texas A&M University 主校区是同一所大学吗？',a:'不是。TAMIU 是位于 Laredo 的 Texas A&M International University，属于 Texas A&M University System；不能把 College Station 主校区的校园照片、学校排名或费用转用到 TAMIU。',url:tamiuSources.university.url},
 {q:'MBA 有线上项目，我能用线上 MBA 申请 F-1 去美国吗？',a:'不能直接这样理解。必须与 TAMIU Graduate School 和国际办公室书面确认所申请 MBA concentration 的校内授课、全日制身份及是否具备 I-20 资格；在线可报读不等于可以以该路径取得学生签证。',url:tamiuSources.business.url},
 {q:'非商科本科能申请吗？',a:'2026–27 MBA 课程目录说明先修商科核心课的选课组合会随本科专业调整，但仍须由学校核实等同学历、专业基础及成绩。不能在没有个人背景评审时承诺所有跨专业申请人必定符合条件。',url:tamiuSources.degree.url},
 {q:'不参加 GMAT 就可以直接申请吗？',a:'不是。官方 2026–27 研究生规则规定部分商学院硕士申请人在本科高年级 GPA 达 3.00 或已拥有认可进阶学位时可免 GRE/GMAT，其他申请人必须根据目标专业招生要求核查是否要考试。',url:tamiuSources.catalogAdmission.url},
 {q:'年度 US$28,372 就是整个硕士读完的钱吗？',a:'不是。学校给出的是 2026–27 秋春两个学期、每学期 6 学分且校内住宿等假设条件下的费用预算；MBA 学位可能修读不同学分、学期或收费方案。',url:tamiuSources.costs.url},
 {q:'国际学生能拿助教、奖学金吗？',a:'学校研究生财政资助和国际生资助页面列出可申请机会，但资格、GPA、学分、竞争名额、具体身份限制和截止日须逐项审查。不能把“最高资助金额”直接从自己的预算中减掉。',url:tamiuSources.funding.url},
 {q:'什么是 I-20？学校录取是否一定能获签？',a:'对于计划申请 F-1 的申请人，I-20 是学校根据合法身份、课程和资金审核等条件发出的文件；学校录取、I-20、签证批准是不同流程，任何一项都不能自动保证下一项。',url:tamiuSources.admission.url}
];
