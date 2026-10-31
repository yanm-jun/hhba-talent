/* HHBA · Monash University deep school & course dossier.
 * Sources are first-party Monash course/admissions pages; reviewed 2026-10-31.
 * AUD figures are 2027 international tuition per 48 points, NOT full 72/96-point award price.
 */
export const monashSources={
 history:{title:'蒙纳士大学创办历史',url:'https://www.monash.edu/about/who/history'},
 clayton:{title:'Clayton 主校区与公共交通',url:'https://www.monash.edu/about/our-locations/clayton-campus'},
 statistics:{title:'大学官方规模与学生统计（2024 口径）',url:'https://www.monash.edu/about/who/glance'},
 it:{title:'信息技术硕士 C6001 · 国际生官方课程页',url:'https://www.monash.edu/study/courses/find-a-course/information-technology-c6001?international=true'},
 bis:{title:'商业信息系统硕士 C6003 · 国际生官方课程页',url:'https://www.monash.edu/study/courses/find-a-course/business-information-systems-c6003?international=true'},
 unit:{title:'信息技术硕士实际课程结构、学分及课程编号',url:'https://www.monash.edu/it/current-students/courses/enrolment/master-of-information-technology'},
 bisUnits:{title:'商业信息系统课程实际选修及先修说明',url:'https://www.monash.edu/it/current-students/courses/re-enrolment/postgraduate'},
 english:{title:'大学官方英语语言考试门槛',url:'https://www.monash.edu/admissions/entry-requirements/english-language'},
 admissions:{title:'国际研究生硕士申请与材料要求',url:'https://www.monash.edu/admissions/apply/international-pg'},
 steps:{title:'国际学生申请完整步骤',url:'https://www.monash.edu/study/how-to-apply/application-process/international-students'},
 student:{title:'国际研究生费用、签证和 CoE',url:'https://www.monash.edu/study/international/graduate'},
 funding:{title:'IT 学院 2027 奖学金与相关条件',url:'https://www.monash.edu/it/future-students/postgraduate'},
 scholarships:{title:'学校奖学金资格查询与筛选',url:'https://www.monash.edu/study/fees-scholarships/scholarships/find-a-scholarship'}
} as const;
export const monashFacts=[
 {label:'成立时间',value:'1958 年'},
 {label:'主要研究校区',value:'Clayton · Melbourne'},
 {label:'性质',value:'澳大利亚公立研究型大学'},
 {label:'2024 总学生负荷',value:'78,230'},
 {label:'IT 学院',value:'专设 IT Faculty'},
 {label:'深入开发项目',value:'两项真实硕士'}
];
export const monashPhotos=[
 {id:'learning',file:'learning-teaching.jpg',commonsName:'Monash Learning and Teaching Building (43797320625).jpg',title:'Learning and Teaching Building',author:'Rob Deutscher',taken:'2018-09-14',license:'CC BY 2.0',licenseUrl:'https://creativecommons.org/licenses/by/2.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:Monash_Learning_and_Teaching_Building_(43797320625).jpg',description:'Clayton 校区的学习与教学楼，2018 年拍摄；显示的是真实校园户外学习区域，非设计效果图。'},
 {id:'menzies',file:'menzies-building.jpg',commonsName:'Monash University Menzies Building.jpg',title:'Robert Menzies Building',author:'Melburnian',taken:'2007-02',license:'CC BY 2.5',licenseUrl:'https://creativecommons.org/licenses/by/2.5/',sourceUrl:'https://commons.wikimedia.org/wiki/File:Monash_University_Menzies_Building.jpg',description:'Clayton 校区 Menzies 教学楼历史外观，拍摄时间为 2007 年，不冒充 2026 年的最新照片。'},
 {id:'biomedical',file:'biomedical-learning.jpg',commonsName:'Monash Biomedical Learning and Teaching Building (32697686457).jpg',title:'Biomedical Learning and Teaching Building',author:'Rob Deutscher',taken:'2019-04-19',license:'CC BY 2.0',licenseUrl:'https://creativecommons.org/licenses/by/2.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:Monash_Biomedical_Learning_and_Teaching_Building_(32697686457).jpg',description:'Clayton 校区生物医学教学楼的独立建筑实景，不将其错误描述为 IT 硕士的固定上课教室。'}
] as const;
export const monashOverview=[
 {title:'学校发展与校区定位',body:'Monash University 成立于 1958 年，1961 年在澳大利亚维多利亚州 Clayton 校区迎来首批学生。今天大学拥有多个澳大利亚校区和国际办学点，不能把马来西亚校区的学费、校园或学生签证规则误搬到墨尔本。官网 Clayton 校区页面明确这里是学校最大的校区之一，兼具信息技术、工程、医学与人文等学科学习环境。',source:monashSources.history.url},
 {title:'Clayton 的生活和校园交通',body:'Clayton 位于墨尔本东南方向，学校提供公共交通、校园地图、超市和图书馆等信息。学生应根据上课时段、实习计划与实际住房位置核算通勤时间与成本，而不是只看“墨尔本”这个城市标签。真实照片展示了不同年代、不同教学楼的校园形态，不等于所有硕士课程都会在被拍摄的建筑中上课。',source:monashSources.clayton.url},
 {title:'信息技术学院的跨专业路线',body:'蒙纳士大学专设 Faculty of Information Technology，官网面向非 IT 本科生提供两年制 96 学分的硕士入学路径。信息技术硕士重点在编程、软件系统、网络、数据库及项目实践；商业信息系统硕士则连接技术、组织运营、信息治理与业务流程。两项课程具有不同的专业能力目标，适合分别查看课程结构，而不是因为都有 IT 标签就混成同一个学位。',source:monashSources.it.url},
 {title:'澳大利亚本地学位比例不等于中国百分制',body:'学校在国际生项目页要求与澳大利亚本科相当的学历及至少 credit（60%）平均成绩；跨国学历由学校依据课程和原高校资料认定。这里的澳大利亚 60% 门槛不可直接理解成任何中国本科成绩单只要均分 60 就能获录取。对于有相关专业背景的人，学校另提供 72 学分的较短路径，但必须具备特定 IT 课程先修知识。',source:monashSources.admissions.url}
];
export const monashPrograms={
 'monash-it-master':{
  id:'monash-it-master',title:'信息技术硕士',english:'Master of Information Technology',code:'C6001',cricos:'079055K',field:'计算机与软件技术',qualifications:'信息技术背景不限的 Entry level 1：相关本科学历或认可等同学历，平均成绩达到校方认可的澳大利亚 credit 60% 等同水平；两年 96 学分。Entry level 2：须拥有 IT 或相关技术本科背景，完整满足 Python、Java、数据结构与算法、计算机架构、操作系统、网络和数据库等先修，才可能按一年半 72 学分修读。',
  study:'以应用软件开发、数据库与网络信息系统为基础，通过高级 IT 核心知识和行业或研究项目培养系统设计与技术管理能力。学校明确接受非 IT 本科背景，但并不承诺任何背景免除英语、成绩和基础课程审核。',
  units:[
   {title:'FIT9131 · Java 编程基础',body:'为未系统学过计算机的学生建立编程、变量、控制结构、函数和软件构建能力，是两年制 Entry level 1 的基础单元之一。'},
   {title:'FIT9136 · Python 与算法编程基础',body:'结合 Python 代码、算法思路与实际程序问题，帮助不同本科学科背景的学生逐步建立计算逻辑，不能只靠理论笔记而不进行实操。'},
   {title:'FIT9132 · 数据库入门',body:'系统了解数据表、查询、关系型数据库及应用场景，为之后的软件开发和企业数据系统学习打下基础。'},
   {title:'FIT9137 · 计算机架构与网络',body:'认识计算机系统内部结构、网络基础与运行环境，帮助学生理解应用开发与底层系统之间的联系。'},
   {title:'软件工程与信息系统方向',body:'学校当前课程图包含 Internet applications development、Mobile and distributed computing systems、Software engineering 与 Advanced database technology 等后续内容，具体选课随入学年份和培养路线变化。'},
   {title:'行业实践或研究型高级项目',body:'课程有 advanced practice 选项，包括行业经验与研究方向；校方是否安排到企业、是否能选中项目、是否带薪均需符合学院条件，不能保证就业或实习名额。'}
  ],url:monashSources.it.url,fee:'A$57,540',points:96,shortPoints:72,scholarship:'本课程未纳入已核实的“2027 年 AI/BIS 两专业 20% 学费减免”名单，不能套用商业信息系统方向的优惠。'
 },
 'monash-bis-master':{
  id:'monash-bis-master',title:'商业信息系统硕士',english:'Master of Business Information Systems',code:'C6003',cricos:'079053A',field:'企业数字化与信息系统',qualifications:'Entry level 1：澳大利亚本科或认可的等同学历，不要求原本科为 IT，平均成绩至少与澳大利亚 credit 60% 同等，两年完成 96 学分。Entry level 2：相关信息系统学历或主修，且完成程序设计、数据库、系统分析与设计、企业级 IT 应用等先修内容，才可能使用一年半 72 学分路径。',
  study:'研究如何把组织的业务问题转化为可执行的信息系统方案。与纯软件工程课程不同，该专业更强调信息治理、业务流程、组织协调、企业系统与管理决策；适合考虑从传统商科、社科、设计和其他非 IT 领域转向企业数字化的人。',
  units:[
   {title:'程序设计与技术基础',body:'两年路径需要建立编程基础，相关选项包括 FIT9131 Java 或 FIT9136 Python 编程基础；具体以本届课程图及学院要求为准。'},
   {title:'信息系统分析与设计',body:'把企业真实的流程问题拆解成需求、数据、角色及信息系统功能，考虑系统对组织运营和用户的影响。'},
   {title:'数字治理与 IT 策略',body:'学院列出 IT strategy and governance 相关课程；强调企业信息系统治理、技术选择和组织决策，并非只有开发代码一条路线。'},
   {title:'业务流程建模与模拟',body:'学院材料列有 Business process modelling, design and simulation，可用于研究业务执行的瓶颈及信息系统的改善措施。'},
   {title:'企业系统与运营决策',body:'不同学习路径覆盖企业数字化应用、IT 管理决策及组织信息分析，帮助学生理解系统如何支持财务、运营和管理信息流。'},
   {title:'高级实践与研究选修',body:'可依据学校的课程图选择进阶实践或研究方向，完成组织信息系统项目；能否获得合作企业任务、研究导师或额外资助均以学校具体安排为准。'}
  ],url:monashSources.bis.url,fee:'A$57,540',points:96,shortPoints:72,scholarship:'Monash IT 学院当前公布：2027 年起读单一学位、全额学费学生若申请 C6003，可能获得 20% 的学费减免，适用学分有上限并受正式条款约束。不得在未获确认前直接从预算里扣除。'
 }
} as const;
export type MonashProgramId=keyof typeof monashPrograms;
export const monashEnglish=[
 '国际学生英语 Level A：IELTS Academic 总分至少 6.5，听说读写每项至少 6.0。',
 'TOEFL iBT 旧 0–120 分制最低总分 79；阅读至少 13、听力 12、口语 18、写作 21。',
 'TOEFL iBT 新 1–6 分制最低总分 4；阅读至少 3.5、听力 3、口语 3.5、写作 4.5。',
 'PTE Academic 最低 58，四个交际技能单项都不得低于 50。具体考试版本和豁免条件需按申请时政策核实。'
];
export const monashSteps=[
 '在学校国际生项目页核对 C6001 或 C6003、澳大利亚 Clayton 校区、2027 学年、入学月份以及 96/72 学分两种 Entry level 的区别。',
 '根据课程官方先修条件判断自己是否属于非 IT 两年制路径，或具备完整 IT 背景可以申请一年半路径；学校最终决定入学路线。',
 '对照学校国际生 Level A 英语要求，确认 IELTS、TOEFL 新旧计分体系或 PTE 的最低单项标准，并准备正式考试证明。',
 '准备本科完整成绩单、学位与毕业证明、适用的正式英文翻译，及学校要求的身份资料和护照扫描件。',
 '通过 Monash Online Application Portal 或学校认证的教育代理正式申请；官网可以按课程代码进入申请，不使用不明渠道收费入口。',
 '如希望申请已修课程的学分豁免，按大学 credit for prior learning 规定提交此前课程大纲、授课内容和成绩；申请不保证被认定。',
 '提交后跟进学校对学历、先修、语言和资金材料的审核；招生处理时间与申请截止日可能因学院及学期不同而变化。',
 '收到 offer 后逐条确认条件、缴费安排、实际授课校区及适用的学费资助，避免将 2027 年 48 学分学费当成全学位费用。',
 '按 Monash 国际学生流程取得 Confirmation of Enrolment (CoE)，之后再按澳大利亚政府要求办理 subclass 500 学生签证与保险等事项。',
 '确认具体入学日期、课程图、到校注册、校外住宿及交通；毕业工作资格、实习和签证均需独立审查，学校录取不自动保证。'
];
export const monashFaqs=[
 {q:'非计算机本科能直接申请吗？',answer:'两门大学官方明确接受非 IT 本科的 Entry level 1 两年制路径，前提是学历及成绩达到澳大利亚 credit 60% 等同门槛，并满足英语等资格。该门槛不是把中国百分制直接换算为 60 分。',source:monashSources.it.url},
 {q:'一年半和两年的主要区别是什么？',answer:'Entry level 1 为 96 学分两年，面向非 IT 或一般本科学历申请者；Entry level 2 为 72 学分一年半，要求相关领域本科及指定技术先修课。能否缩短必须由大学审核。',source:monashSources.bis.url},
 {q:'2027 年 A$57,540 就是整个学位的费用吗？',answer:'不是。国际课程页将 A$57,540 定义为按 48 学分计算的 2027 年标准全日制一学年学费；两年制通常是 96 学分，另计生活费、保险、签证、机票等。不同学年的学费可能调整。',source:monashSources.it.url},
 {q:'商业信息系统的 20% 学费减免可以保证吗？',answer:'不能。Monash IT 学院披露的 2027 年优惠有课程代码、全额缴费、单一学位及适用学分上限等条件。没有学校正式资格确认前不能当作必得奖学金，更不能推广到信息技术硕士 C6001。',source:monashSources.funding.url},
 {q:'可以在国内全程网课后办理澳洲学生签证吗？',answer:'不能简单推断。两项 Clayton 校区项目为校内全日制，Monash 还对 CRICOS 国际学生在线学习比例及每个必要学期至少一门线下课设有限制。应根据个人 CoE 和 subclass 500 规则核实。',source:monashSources.student.url},
 {q:'蒙纳士大学有没有两个国家的校区？',answer:'有。澳大利亚 Clayton、Caulfield 等校区与马来西亚 Monash 校区不能视为同一申请、学费、签证和学习地点。当前档案只讨论澳大利亚 Clayton 校区。',source:monashSources.clayton.url},
 {q:'澳洲 IT 硕士毕业就有工作签证吗？',answer:'不保证。完成课程、获得职业协会认可与符合毕业生签证、实习岗位或雇主招聘条件属于不同事项。任何签证、就业或移民资格需核对澳大利亚政府当前制度。',source:monashSources.student.url},
 {q:'学校官网写“奖学金很多”，能直接减少预算吗？',answer:'不能。大学虽然提供多个不同类型的奖学金，但资格涉及国际生身份、课程、学年、申请时点及竞争。需要以个人资格对应的项目结果为准，不能用总奖学金数量作为获奖概率。',source:monashSources.scholarships.url}
];
