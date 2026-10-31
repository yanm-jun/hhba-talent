/* HHBA Study Abroad: University of South Dakota deep-dive, checked 2026-10-31.
 * School-level rates and deadlines are not guaranteed for a particular applicant.
 */
export const usdSources={
 facts:{label:'大学官方概况、历史、规模及认证',url:'https://www.usd.edu/About/At-a-Glance'},
 campus:{label:'校园与地区',url:'https://www.usd.edu/About/Vermillion-Campus-and-Community'},
 admissions:{label:'国际研究生完整招生与申请说明',url:'https://www.usd.edu/Admissions-and-Aid/International-Admissions/Applying-for-International-Graduate-Admission'},
 checklist:{label:'国际生录取后手续与资金证明',url:'https://www.usd.edu/Admissions-and-Aid/International-Admissions/International-Graduate-Student-Checklist'},
 tuition:{label:'大学研究生年度预算与成本口径',url:'https://www.usd.edu/Admissions-and-Aid/Tuition-and-Costs/Graduate-Tuition-and-Costs'},
 rates:{label:'南达科他州校董会 2026–27 收费标准',url:'https://sdbor.edu/cost-aid/south-dakota-tuition-rates/'},
 assistant:{label:'研究生助教申请与资格',url:'https://www.usd.edu/Admissions-and-Aid/Financial-Aid/Types-of-Aid/Graduate-Assistantships'},
 mba:{label:'MBA 官方项目说明',url:'https://www.usd.edu/Academics/Graduate-Programs/Business-Administration'},
 analytics:{label:'商业分析硕士官方项目页',url:'https://www.usd.edu/Academics/Graduate-Programs/Business-Analytics'},
 computer:{label:'计算机科学硕士官方项目页',url:'https://www.usd.edu/Academics/Graduate-Programs/Computer-Science'},
 housing:{label:'学生住宿与餐饮',url:'https://www.usd.edu/Student-Life/Housing-and-Dining'}
} as const;
export const usdFacts=[
 {label:'创校年份',value:'1862 年'},
 {label:'主校区',value:'Vermillion'},
 {label:'2026 秋季学生',value:'10,040 人'},
 {label:'师生比例',value:'16 : 1'},
 {label:'校园面积',value:'274 英亩'},
 {label:'认证',value:'HLC'}
];
export type UsdPhoto={id:string;file:string;title:string;description:string;creator:string;year:string;license:string;licenseUrl:string;sourceUrl:string;changes:string};
export const usdPhotos:UsdPhoto[]=[
 {id:'aerial',file:'usd-campus-aerial.jpg',title:'Vermillion 主校区 · 航拍',description:'2023 年 9 月 24 日拍摄，能够真实看到南达科他大学在 Vermillion 的校园建筑布局；不是其他学校的航拍图。',creator:'anup khanal（Akhanal47）',year:'2023',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:Aerial_view_of_University_of_South_Dakota_Vermillion_Campus.jpg',changes:'显示时按页面比例裁切；未进行 AI 合成'},
 {id:'old-main',file:'usd-old-main-habs.jpg',title:'Old Main · 历史主楼',description:'1976 年由美国国家公园管理局历史建筑调查项目拍摄的校园主楼档案影像，反映当年的真实建筑面貌，不冒充现今校园新照。',creator:'Jack Boucher / Historic American Buildings Survey',year:'1976 · 历史档案',license:'美国联邦公务作品 · 公共领域',licenseUrl:'https://www.usa.gov/government-works',sourceUrl:'https://commons.wikimedia.org/wiki/File:Old_Main,_University_of_South_Dakota.jpg',changes:'历史照片，页面自适应裁切'},
 {id:'belbas',file:'usd-belbas-center.jpg',title:'Belbas Center · 校园建筑',description:'2015 年拍摄的 Belbas Center 南侧实景。与 Old Main 和航拍照片是不同的校园拍摄对象。',creator:'Ammodramus',year:'2015',license:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:University_of_South_Dakota_Belbas_Center_from_S_1.JPG',changes:'等比例裁切；未生成虚假校园实景'}
];
export const usdOverview=[
 {title:'学校历史与地理位置',body:'南达科他大学成立于 1862 年，位于美国南达科他州东南部的 Vermillion。学校官方介绍它是南达科他州历史最悠久的大学之一；主校区分布在约 274 英亩的校园内，邻近密苏里河沿岸地区。对希望在美国中小城市攻读线下硕士的申请者来说，学校位置、冬季气候、住房和交通与课程本身一样值得考察。',source:usdSources.facts.url},
 {title:'教学、科研与大学认证',body:'学校官网公布 2026 年秋季总在校人数 10,040，研究生约 2,159，师生比 16:1。大学由 Higher Learning Commission 持续认证。Beacom School of Business 的商科项目另有 AACSB 认证信息，但大学认证、商学院认证和具体专业职业资格不能混为一谈。学校并非只有硕士教育，当前库内只深度开发了三项代表性课程。',source:usdSources.facts.url},
 {title:'校区与学习空间',body:'Vermillion 是商业分析和计算机科学硕士的官方校园授课地点；MBA 同时有 Vermillion、Sioux Falls 以及在线选项，但不同选修方向的校区和上课方式应分别检查。大学还拥有 I.D. Weeks Library、Beacom School of Business 等学术设施。照片展示的是经过核验的校园真实建筑，不能据此推定某一专业的所有课堂都在同一楼内。',source:usdSources.campus.url},
 {title:'城市生活与个人适配',body:'Vermillion 的体验与大型都市不同。打算长期线下学习的国际学生，应在申请前分别核实当地租房渠道、交通工具、冬季天气、国际学生服务、校内就业与医疗保险。官方年度预算中的住房餐饮、交通和个人开销只是计算模型，并非所有学生都会花同样的钱；研究生宿舍数量有限，学校明确建议考虑校外住宿。',source:usdSources.tuition.url}
];
export const usdAdmission={
 languages:[
  'TOEFL iBT：现行国际研究生申请页写明最低 79；同时列出 2026 年起的新评分口径 4，需要按考试版本核对。',
  'IELTS Academic：总分最低 6.0；Duolingo English Test：最低 110。',
  'PTE Academic：最低 53；Cambridge English：最低 169。不同学院、专业可能要求更高。',
  '可接受的英语成绩类型、豁免资格及有效期以学校正式审查为准，不保证凭最低成绩录取。'
 ],
 steps:[
  '先选定具体研究生项目，在学校官方学术目录中核对本科先修课、GPA、推荐信数量和可能的 GRE/GMAT 条件；不同项目并不统一。',
  '从 USD 专属申请系统或学校接受的 GradCAS 提交，不通过未知第三方代填入口；申请时核对当前页面收费金额。',
  '准备官方本科成绩单、毕业及学位证明；非英语材料需要正式译文。学校可内部审核部分国际成绩，也可能要求 TEC/WES/ECE 等第三方学历认证。',
  '提交学习目的陈述（Statement of Purpose）与个人简历；推荐信通常通过申请系统邀请推荐人独立提供，具体数量按项目要求。',
  '提交学校认可的英语成绩。学校允许在某些材料尚为非官方副本的情况下先提供有条件录取，但正式录取仍须补交全部官方材料。',
  '录取后根据学校 International Office 要求提交护照和资金能力证明，证明至少覆盖一学年的学费、生活费等；学校审核后才可能签发 I-20 或 DS-2019。',
  '根据签发的 I-20/DS-2019 及个人情况办理相应签证、SEVIS 费用、到校注册和国际生迎新。拿到学校录取不代表签证一定获批。'
 ],
 feeNote:'国际研究生申请页面目前显示不可退还 US$38；州校董会 2026–27 服务费表另列研究生申请费 US$40。两份官方来源存在差异，因此本平台不把任何一个数称为最终支付价格，应以实际提交申请时学校系统收取金额为准。',
 deadlineNote:'以下日期来自 USD 当前国际招生页“2027 年春/秋”说明；部分专业或研究方向可能有更早截止日期、限制春季招生，务必再次核对项目目录。'
};
export const usdCost=[
 {label:'2026–27 非居民研究生基础学费（每学分）',value:'US$689.15',note:'南达科他州校董会公布的 USD Nonresident Graduate 每学分基础学费；不是带费用的课程最终报价。'},
 {label:'校内一般活动费（每学分）',value:'US$57.55',note:'州校董会公布的 USD General Activity Fee 口径；课程或学院附加费另计。'},
 {label:'全年学费测算口径',value:'18 学分 / 学年',note:'USD Graduate Cost of Attendance 官方说明使用 18 学分计算年度学费；你的修课学分可能不同。'},
 {label:'食宿、保险、交通及生活费',value:'按个人情况',note:'学校按居住地点分别列年度预算；研究生校内住宿优先级和空余床位必须单独核实。'},
 {label:'全部硕士课程完成总费用',value:'未确定',note:'不能简单用每学分学费乘学位总学分就当作签证/I-20 预算或整个学位实际总成本。'}
];
export const usdProgramDetails={
 'usd-business-analytics-ms':{
  id:'usd-business-analytics-ms',
  title:'商业分析理学硕士',
  english:'Master of Science in Business Analytics',
  label:'Beacom 商学院 · Vermillion 校园 · STEM',
  summary:'学校介绍该硕士围绕商业数据管理、统计分析、可视化、优化以及基于数据的决策展开，并列出 Ellis Finance & Analytics Lab、SAS 开发工具生态等教学资源。官方明确这是 STEM designated 项目，但仍需核实你的 I-20 与 CIP 分类。',
  background:'课程同时涉及商业背景、统计与计算机知识。是否允许完全没有商科、数学或编程先修课的申请人入学，必须以项目当年目录中的 admissions requirements 为准；官网没有授权我们将它标成无条件跨专业。',
  chapters:[
   {name:'分析、统计与数据管理',content:'课程说明强调把统计方法、业务领域知识与计算机工具结合，用于清理、组织、解释数据和构建业务场景的量化论证。实际课程名称、学分和选修方向以学术目录为准。'},
   {name:'可视化、预测和优化',content:'项目聚焦商业数据可视化、短期与长期预测、优化和经营表现评估，帮助学生理解模型如何服务企业决策；这些是大学描述的能力方向，不代表每名学生都将参加同一实习。'},
   {name:'实践资源与行业联系',content:'官网提到 Beacom 商学院 Ellis Finance & Analytics Lab、SAS 工具和面向真实企业问题的 Coyote Business Consulting Group 资源；能否选修、参与或获得带薪岗位需与院系确认。'},
   {name:'就业方向与 STEM 风险提示',content:'适合进一步研究业务分析师、数据分析与经营预测相关方向，但学校标注 STEM 不等于自动获得 OPT、STEM OPT 或美国就业机会；签证资格依个人 I-20、专业 CIP 代码及当时政策而定。'}
  ],
  intake:[{term:'2027 春季',deadline:'2026-12-05'},{term:'2027 秋季',deadline:'2027-08-01'}],
  source:usdSources.analytics.url,stem:'学校官方列为 STEM designated；不是个人 STEM OPT 资格承诺。'
 },
 'usd-mba':{
  id:'usd-mba',
  title:'工商管理硕士',
  english:'Master of Business Administration (MBA)',
  label:'Beacom 商学院 · Vermillion / Sioux Falls / Online',
  summary:'USD 官方 MBA 介绍以批判性思维、经营分析、商业决策、伦理责任和领导能力为核心。可在不同地点或在线完成部分路径，金融、经济、AI、商业分析等专项必须单独核实是否在你选定的校区提供。',
  background:'申请人应核对具体 MBA 层次对本科背景、商科基础课、成绩、工作经验以及可能的 GRE/GMAT 要求，官网展示 MBA 有灵活学习方式不等于任何学位背景都自动符合入学标准。',
  chapters:[
   {name:'战略决策和组织领导',content:'理解企业目标、资源限制和跨部门协作，把决策模型与组织管理结合。项目介绍强调分析不同经营行动方案的影响和在不确定条件下的管理判断。'},
   {name:'会计、金融与商业分析',content:'学校 MBA 提供金融和经济等不同专项，相关学习可能涉及财务报表、风险、经营分析和市场判断；学生必须以申请年份对应专项的课程要求为准。'},
   {name:'授课形式和校区选择',content:'学校明确提供 Vermillion、Sioux Falls、Online 三种选择，但不同专项并非全部在三个渠道同时开放；计划 F-1 赴美留学者不能直接按纯网课路径规划线下学生身份。'},
   {name:'职业发展和限制',content:'MBA 面向商业、政府和各类管理组织的领导与分析职位。学校国际生页面仅列出带特定 STEM 专项的 MBA 可能符合 STEM OPT 范畴，普通 MBA 不应被统一打上 STEM 标签。'}
  ],
  intake:[{term:'2027 春季',deadline:'2026-12-05'},{term:'2027 秋季',deadline:'2027-08-01'}],
  source:usdSources.mba.url,stem:'普通 MBA 不自动视为 STEM；只有符合要求的特定专项应再由学校确认 CIP 与身份。'
 },
 'usd-cs-ms':{
  id:'usd-cs-ms',
  title:'计算机科学理学硕士',
  english:'Master of Science in Computer Science',
  label:'Vermillion 校园 · 30 学分 · STEM',
  summary:'USD 官方页面确认计算机科学硕士在 Vermillion 主校区开设，30 学分，分为论文与非论文方向。学校还展示 AI 等相关方向，学习内容面向计算机科学、人工智能、机器学习和信息安全。',
  background:'这是一门需要计算机基础与数学能力的研究生学位，不能把“研究生可以申请”误解成“完全没有计算机背景也可直接录取”。具体先修课、专业成绩和补课安排须咨询计算机系并查看当前目录。',
  chapters:[
   {name:'计算机基础与软件能力',content:'该学位强调理解计算问题、计算系统及解决方案的专业能力。因其属于计算机科学进阶项目，非计算机本科背景申请者要认真核对数学与程序设计先修条件。'},
   {name:'人工智能与数据方法',content:'学校官网展示可关注人工智能、机器学习及跨学科应用的计算机科学发展方向，但不同方向的课程与导师资源、招生条件及论文课题需分别确认。'},
   {name:'论文与非论文路径',content:'30 学分项目提供 thesis 与 non-thesis 两类修读安排。课程数、毕业研究或项目工作、所需的导师安排，以研究生课程目录和院系导师说明为准。'},
   {name:'国际学生与职业计划',content:'学校将 M.S. Computer Science 列为 STEM 指定项目之一；是否具备后续 OPT 申请资格取决于个人学籍、CIP、签证身份和美国政府最新规定，不能作为雇佣保证。'}
  ],
  intake:[{term:'2027 春季',deadline:'2026-12-05'},{term:'2027 秋季',deadline:'2027-07-15'}],
  source:usdSources.computer.url,stem:'学校官网明确把计算机科学 MS 列入 STEM 项目；不是自动获得工作许可。'
 }
} as const;
export type UsdProgramId=keyof typeof usdProgramDetails;
export const usdFaqs=[
 {q:'南达科他大学与南达科他州立大学是同一所吗？',a:'不是。University of South Dakota（USD）主校区位于 Vermillion；South Dakota State University（SDSU）位于 Brookings。我们这里所有学校照片、申请资料与专业链接都对应 USD，不能与 SDSU 混用。',source:usdSources.facts.url},
 {q:'如果我的本科是文科，能直接转计算机或商业分析吗？',a:'不能直接承诺。学校确认这些硕士存在，但对于跨专业背景，先修课、数学能力、GPA 和申请附加要求须逐项目审查。MBA 的灵活方向也不代表所有申请者免除商科先修条件。',source:usdSources.admissions.url},
 {q:'申请费为什么官网和州收费表不同？',a:'国际研究生申请页列 $38，州校董会 2026–27 收费表列 $40。两项官方数字存在差异，所以应以真正提交项目申请时系统显示的金额为准，不能把任何一个称作确定最终费用。',source:usdSources.admissions.url},
 {q:'官网所列学费就是我两年读完的总费用吗？',a:'不是。研究生收费可能按学分、课程和居住/身份类别变化；学校的年度预算是建立在 18 学分和指定生活假设上的估计，不能直接作为完整学位和 I-20 资金证明金额。',source:usdSources.tuition.url},
 {q:'2027 年的研究生截止日期对所有专业通用吗？',a:'不一定。学校特别说明可能存在较早的项目截止、部分专业不招收春季入学。这里仅引用官方国际研究生招生页对 MBA、商业分析和计算机科学等专业列出的日期。',source:usdSources.admissions.url},
 {q:'STEM 项目是不是毕业就有三年工作签证？',a:'不是。校方将商业分析、计算机科学等项目列作 STEM，但学生需根据当时法律、本人毕业要求、F-1 身份、I-20 专业代码和雇主条件申请 OPT 或延长，绝不保证工作许可或美国就业。',source:usdSources.admissions.url},
 {q:'能否依靠助教岗位把学费降下来？',a:'USD 确有 GTA/GRA/GAA/GCA 等研究生助教岗位并有潜在学费减免及津贴，但需要获得研究生正式录取、保持 GPA、满足当期最低学分以及部门选拔。学校明确岗位有限，多数硕士生不应假设入学即有助教资助。',source:usdSources.assistant.url}
];
