/* HHBA University of Birmingham deep-dive, first-party sources reviewed 2026-10-31.
 * UK 2:1 conversion degree ≠ guarantee that any overseas degree earns admission.
 * International fee only published with 2027 intake and correct international status.
 */
export const birminghamSources={
 university:{name:'大学历史与背景',url:'https://www.birmingham.ac.uk/about/our-history-and-heritage'},
 cs:{name:'Computer Science MSc · 官方项目',url:'https://www.birmingham.ac.uk/study/postgraduate/subjects/computer-science-and-data-science-courses/computer-science-msc'},
 aics:{name:'AI and Computer Science MSc · 官方项目',url:'https://www.birmingham.ac.uk/study/postgraduate/subjects/computer-science-and-data-science-courses/artificial-intelligence-ai-and-computer-science-msc'},
 entry:{name:'国际研究生同等学历与英语标准',url:'https://www.birmingham.ac.uk/study/postgraduate/taught/apply/international-entry-requirements'},
 process:{name:'2027 国际生申请、截止日期、押金',url:'https://www.birmingham.ac.uk/study/postgraduate/taught/apply'},
 documents:{name:'个人陈述、推荐及成绩材料',url:'https://www.birmingham.ac.uk/study/postgraduate/taught/apply/your-application'},
 deposit:{name:'英国学生签证 CAS 与学费押金',url:'https://www.birmingham.ac.uk/study/international/fees/international-deposits'},
 scholarships:{name:'2027 研究生奖助学金入口',url:'https://www.birmingham.ac.uk/study/postgraduate/scholarships-and-funding/postgraduate-scholarships'},
 janScholarship:{name:'2027 年 1 月高潜力学生 £5,000 奖学金',url:'https://www.birmingham.ac.uk/study/scholarships-funding/postgraduate-high-fliers-scholarship-for-january'}
} as const;
export const birminghamFacts=[
 {label:'创校',value:'1900 年'},
 {label:'英国校区',value:'Edgbaston'},
 {label:'学校类型',value:'英国公立研究型大学'},
 {label:'校园面积',value:'672 英亩'},
 {label:'在校生',value:'40,000+（校方概况）'},
 {label:'首批深入开发',value:'2 项转换型硕士'}
];
export type BirminghamPhoto={id:string;file:string;fileName:string;label:string;description:string;author:string;date:string;license:string;licenseUrl:string;sourceUrl:string;editNote:string};
export const birminghamPhotos:BirminghamPhoto[]=[
 {id:'aston',file:'aston-webb.jpg',fileName:'University of Birmingham - Aston Webb.jpg',label:'Aston Webb Building · 校园历史建筑',description:'2005 年的 Edgbaston 校园 Aston Webb 建筑照片，与伯明翰城市里名称相似的 Aston University 完全不同。',author:'stephen boisvert',date:'2005-11-18',license:'CC BY 2.0',licenseUrl:'https://creativecommons.org/licenses/by/2.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:University_of_Birmingham_-_Aston_Webb.jpg',editNote:'保留原图来源与作者，响应式容器按比例裁切展示'},
 {id:'library',file:'main-library.jpg',fileName:'University of Birmingham - new main library (26663121392).jpg',label:'Main Library · 新图书馆',description:'2016 年由 Elliott Brown 拍摄，当时大学新主图书馆接近竣工；不能把照片年份冒充今天的馆内现状。',author:'Elliott Brown',date:'2016-05-01',license:'CC BY-SA 2.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/2.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:University_of_Birmingham_-_new_main_library_(26663121392).jpg',editNote:'图片自适应裁切，保留 CC BY-SA 授权署名'},
 {id:'oldjoe',file:'old-joe-2026.jpg',fileName:'Old Joe 2026.jpg',label:'Old Joe · Joseph Chamberlain 钟楼',description:'2026 年 4 月拍摄的伯明翰大学标志性 Joseph Chamberlain Memorial Clock Tower 实景。',author:'Athikhun.suw',date:'2026-04-12',license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:Old_Joe_2026.jpg',editNote:'页面展示使用等比例裁切，无 AI 合成'}
];
export const birminghamOverview=[
 {title:'大学的创办与 Edgbaston 主校区',body:'英国伯明翰大学成立于 1900 年，校方历史页面将其描述为英国最早的公民大学之一。Edgbaston 主校区面积约 672 英亩，Old Joe 钟楼、Aston Webb 建筑和新主图书馆都是辨识度很高的校园实景。校园位于英格兰伯明翰，不应与附近的 Aston University 或大学迪拜校区混淆。',source:birminghamSources.university.url},
 {title:'为什么特别研究计算机转换型硕士',body:'伯明翰的 Computer Science MSc 是长期运行的计算机转换课程，官网介绍项目始于 1969 年，针对非计算机本科毕业生；另一门 Artificial Intelligence (AI) and Computer Science MSc 则将计算机基础、数据管理与人工智能结合。它们不同于要求相关计算或数理本科背景的纯 AI 进阶课程，适合考虑从其他专业转向技术方向的人进一步核实。',source:birminghamSources.cs.url},
 {title:'城市生活与独立学习',body:'伯明翰是英国大型城市，学生应结合 Edgbaston 校区、住宿租约、交通与毕业后的工作计划评估总成本。校方学费只覆盖教育项目明确列出的内容；住宿、生活费、保险与英国签证申请等并非自动包含在年度学费中。官网表示学生需要参加讲座、实践工作坊、实验室学习与独立项目，因此也需要评估自己的编程学习准备程度。',source:birminghamSources.cs.url},
 {title:'中国与其他海外申请人的审核边界',body:'两个转换课程明确写有英国 2:1 或等同学历、非计算机背景；但英国学位分类不等于某个中国学校的固定百分制分数。申请时应使用学校对应国家的成绩要求，再由招生导师逐一审查学历背景、个人陈述、英语与其他条件。非计算机背景允许申请不代表完全没有编程准备也能轻松完成一年密集课程。',source:birminghamSources.entry.url}
];
export const birminghamPrograms={
 'birmingham-cs-conversion':{
  id:'birmingham-cs-conversion',title:'计算机科学转换型硕士',english:'Computer Science MSc',degree:'MSc · 180 credits · 校内 · 1 年全日制',
  intakes:'2027 年 1 月和 9 月均在官网列出',
  admission:'英国 2:1 Honours degree，要求本科不是 computing；海外本科学历按国家同等资格核对。项目是转换型，不需要把申请人预先当作计算机本科毕业生，但课程强度很高，个人英语和学术材料必须达到标准。',
  intro:'该课程面向希望系统转换为软件开发和计算机科学方向的非计算机本科生。学校将软件开发工作坊、系统原理、数据结构、算法、数据库、人工智能与 60 学分独立项目结合，让学生在一年内从基础逐步过渡到大型软件系统设计与评估。',
  modules:[
   {name:'Software Workshop 1 / 2',credit:40,content:'两门软件工作坊，每门 20 学分，围绕编程基础、开发工作流和构建可运行的软件系统展开。它们是转换课程的重要实践起点，但具体语言、考核方式与开课次序以最新课程手册为准。'},
   {name:'Computer Systems',credit:20,content:'理解计算机系统的结构及运行方式，形成分析软件与底层系统关系的基础。原本没有计算机专业背景的申请者尤其需要为这部分的技术概念投入时间，也应配合课程安排逐步练习基础计算原理与系统调试，具体实验和考核以本年度模块手册为准。'},
   {name:'Data Structures, Algorithms, and Databases',credit:20,content:'学习数据结构、常见算法与数据管理，把基础代码转化为可处理真实数据、具备适当复杂度与性能考虑的软件解决方案。对于非计算机本科生，建议提前复习基础编程和算法概念，以适应这门将多个核心主题整合到一学期的课程。'},
   {name:'Building Useable Software',credit:20,content:'从用户需求和人机交互角度理解软件设计，关注可用性、需求验证与系统原型。对于设计、艺术、人文背景申请者，这部分与已有的用户研究经验存在可迁移联系。'},
   {name:'Artificial Intelligence and Machine Learning',credit:20,content:'在程序和数据基础上认识人工智能及机器学习。它是转换课程里的一个 20 学分核心模块，不应误写为整项学位都是 AI 专项研究。申请者需要理解模型、数据与软件项目之间的联系，并核查学校当年具体的项目评估方式。'},
   {name:'Project – Conversion MSc',credit:60,content:'通常在课程后期由导师指导，完成大型软件系统的设计、实现和评估。选题可来自教师或行业伙伴，申请人也可能提出自己的想法，最终可选题目需学校批准。'}
  ],
  intlTuition:[
   {term:'2027 年 1 月入学',value:'£34,740',note:'学校官网标注国际生一年全日制对应学费；非 UK/Ireland 本地学费。'},
   {term:'2027 年 9 月入学',value:'£36,000',note:'学校官网标注国际生一年全日制对应学费。'}
  ],
  feesStatus:'2027 国际生学费已按入学批次核实',
  note:'学校项目页面同时列有 2027 年本地生学费 £12,150/£12,780，国际生不能据此推断自己适用本地学费。',
  courseUrl:birminghamSources.cs.url
 },
 'birmingham-ai-conversion':{
  id:'birmingham-ai-conversion',title:'人工智能与计算机科学转换型硕士',english:'Artificial Intelligence (AI) and Computer Science MSc',degree:'MSc · 180 credits · 校内 · 1 年全日制',
  intakes:'官方显示 9 月开学；未确认 1 月有该转换项目批次',
  admission:'英国 2:1 Honours degree，适用于本科非 computing 的申请者。国际学历、英语和材料仍要经过招生导师核实。它与需要数理或计算机学科背景的 AI MSc 进阶课程不同，不应混淆录取条件。',
  intro:'这门转换型硕士将人工智能、编程、数据与计算机系统基础放在同一个一年全日制的学习路径中。学校列出编程、人工智能与机器学习、数据库管理、网络开发、AI 新兴主题和团队/个人项目相关学习，适合希望从其他专业转换到 AI 软件应用方向的学生。',
  modules:[
   {name:'Programming for Artificial Intelligence and Data Science',credit:20,content:'从计算机编程开始，建立可以处理数据、实现基础 AI 方法的程序能力。适合跨专业学生入门，但需要自主练习和完成编程评估。对于原先学习艺术、人文或社科专业的人，建议先通过简单代码项目体验变量、函数、数据结构和调试工作。'},
   {name:'Storing and Managing Data',credit:20,content:'学习数据存储和管理的核心概念，为后续 AI 模型训练、数据处理及应用实现提供基础；其具体数据库平台与工具按学校当前课程说明核实。课程主题强调处理、保存、检索与组织数据，相关数据库技术与考核按最新课程手册为准。'},
   {name:'Artificial Intelligence and Machine Learning',credit:20,content:'构建 AI/机器学习核心概念，理解基本模型和方法，以及如何把算法与数据、程序代码联结起来。非计算机背景学习者需结合基础编程课循序练习；本模块的具体算法与数学要求应按当前招生和教学说明进行确认。'},
   {name:'Current Topics in Artificial Intelligence and Data Science',credit:20,content:'认识 AI 与数据科学的新方向和相关问题，重视技术迭代与实际问题，而非保证教授某个固定的热门产品或商业软件。这门模块更适合用来建立持续查阅研究资料、分析技术限制、评价新兴技术影响的能力，主题会随教学年度变化。'},
   {name:'Web Development',credit:20,content:'通过 Web 技术理解智能系统的软件交付，帮助将 AI 想法转化为可使用的数字服务或展示界面。在课程项目中，尤其需要关注数据输入、页面交互与系统可用性的联系；具体前后端技术栈仍以校方最新模块资料为准。'},
   {name:'选修与独立 AI 项目',credit:80,content:'学生在 Data Analytics with AI 或 Computer Systems, Data Structures and Algorithms 等方向中选一门 20 学分选修，另有 60 学分个人项目，需设计、实现、评估并提交成果。'}
  ],
  intlTuition:[],
  feesStatus:'国际生学费尚未在核对的项目页得到清晰可复核的金额；不得引用 UK/Ireland £12,780 作为国际生收费',
  note:'国际生应选择课程官网的 international 身份及相应入学年份，核实收费、CAS 押金和生活预算；在缺少足够官方证据时，不得把英国本地生 £12,780 的费用冒充国际生学费，也不得填写推测金额。',
  courseUrl:birminghamSources.aics.url
 }
} as const;
export type BirminghamProgramId=keyof typeof birminghamPrograms;
export const birminghamEnglish=[
 '这两门项目的官方英语要求：IELTS Academic 总分 6.5，任何单项不得低于 6.0。',
 '2026 年 1 月之前的 TOEFL iBT：88 总分，听力至少 20、阅读 21、口语 22、写作 21。',
 '2026 年 1 月起 TOEFL iBT 采用学校列明的新计分口径：总分 4.5，两个技能不低于 4.5，其余两个不低于 4。',
 'PTE Academic：总分 67，听说读写各项至少 64；其他考试与英语豁免须在官方国际生说明中核对。',
 '学校要求认可的语言考试成绩通常在课程开始时不超过两年；具体课程可设置更高门槛。'
];
export const birminghamApplication=[
 '明确自己申请 Computer Science MSc 还是 AI and Computer Science MSc，确认项目确实是 conversion，而不是要求原本科已有 CS/数学的纯 AI 进阶课程。',
 '到大学官网核对目标入学月份：Computer Science 项目列出 2027 年 1 月和 9 月；AI and Computer Science 仅有 9 月。按国际生身份查看对应要求。',
 '通过学校的国际研究生同等学历页面核对 UK 2:1 与原本科院校、均分的换算，不要将“非计算机本科可申请”等同于成绩自动合格。',
 '准备本科学位证明与成绩单、如适用的英文翻译，并根据申请门户要求提交英语证明或说明预计参加的考试。',
 '根据官方申请指南撰写约 5,000 字符个人陈述，解释为什么要转技术专业、具体课程匹配和此前项目/工作中的可迁移能力。',
 '准备申请门户所要求的学术或职业推荐人资料；官网一般允许 1 至 2 位推荐人，具体课程和录取条件有差异，不能统一断言必须两份。',
 '通过课程官网“Apply now”进入大学自己的 Admissions Portal，完成在线申请。大学目前说明授课型硕士一般不收申请费，不应支付来路不明的报名代办费用。',
 '查询大学官方海外申请截止日期和项目-specific 提前截止、名额是否已满；学校可能提前关闭，即使网页仍列有标准截止日期。',
 '收到有条件/无条件 Offer 后按条件补齐英语和学历材料，并根据 Portal 提示缴纳国际生押金；当前常规授课型硕士押金为 £3,000，押金计入学费而不是额外赠送的费用。',
 '学校在满足录取条件及押金安排后才考虑签发 CAS；英国 Student visa 需要另外按英国移民制度办理，录取或 CAS 本身均不能保证签证获批。'
];
export const birminghamDates=[
 {term:'2027 年 1 月 · 多数授课型硕士',overseas:'2026-10-30',deposit:'2026-12-07',note:'学校一般国际生截止日期；对 AI and Computer Science 不应据此暗示 1 月有入学批次。'},
 {term:'2027 年 9 月 · 多数授课型硕士',overseas:'2027-07-02',deposit:'2027-07-30',note:'学校一般海外申请与押金节点；个别专业可能更早关闭，必须检查课程实时招生。'}
];
export const birminghamFaqs=[
 {q:'舞蹈、设计、艺术等非计算机本科，可以考虑申请吗？',a:'两项都是面向非 computing 本科的转换课程，官方列有“any subject other than computing”及英国 2:1 同等学历要求。这意味着可以研究申请资格，不意味着任何海外学校分数或语言都自动满足。个人需由大学招生部门作等同学历评审。',src:birminghamSources.cs.url},
 {q:'Computer Science MSc 与 AI and Computer Science MSc 有什么区别？',a:'前者系统覆盖软件工作坊、计算机系统、数据结构、可用软件开发和 AI，并完成软件项目；后者更集中于编程、数据管理、AI/ML、新兴 AI 主题、Web 开发和 AI 项目。两者都是 180 学分、一年全日制的转换型硕士。',src:birminghamSources.aics.url},
 {q:'两门项目都能申请 2027 年 1 月入学吗？',a:'不能这样推断。Computer Science MSc 官方列出 1 月与 9 月，而 AI and Computer Science MSc 列出 9 月。是否实际开放、截止与空余名额需在申请前核验。',src:birminghamSources.aics.url},
 {q:'£12,780 是国际学生读 AI 转换硕士的学费吗？',a:'不能这样使用。官网展示的 £12,780 是 UK/Ireland 本地身份学费；AI 转换硕士的国际生金额本次尚未确认。Computer Science MSc 的 2027 国际生费用则明确列出 1 月 £34,740、9 月 £36,000。',src:birminghamSources.aics.url},
 {q:'£3,000 押金是不是在原学费外多交一笔？',a:'学校明确国际生授课型硕士一般在 CAS 签发前支付 £3,000 押金，并于注册后计入学费；不是在年度学费之外另加 £3,000。实际金额与截止日应查看申请人 Portal。',src:birminghamSources.deposit.url},
 {q:'是否需要找中介支付申请费用？',a:'大学当前官方申请指南说明 postgraduate taught 课程不收申请费。应使用课程官网 Apply now 跳转的官方 Admissions Portal，并留意个人项目是否有特殊要求，避免未经验证的第三方收费。',src:birminghamSources.process.url},
 {q:'学校标注 conversion 是否保证毕业后就业或签证？',a:'不是。课程允许一定范围的跨专业申请，但实际成绩和入学资格须审查；毕业后的英国工作政策、Student visa 和潜在 Graduate visa 均由主管机构决定，学校课程存在不构成就业或移民保证。',src:birminghamSources.entry.url},
 {q:'£5,000 奖学金是不是所有转换型硕士都能拿？',a:'不是。学校列出的 Postgraduate High Fliers Scholarship for January 2027 只适用于指定国家、2027 年 1 月入学和指定课程（其中包含 Computer Science MSc），还有截止时间。不能自动套用到 9 月或 AI and Computer Science 项目。',src:birminghamSources.janScholarship.url}
];
