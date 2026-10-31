/* HHBA verified source dossier for Minot State University only.
 * Snapshot: 2026-10-31. Every claim links to its exact first-party page.
 * School-wide fee example does NOT equal full 30-credit tuition or I-20 approval.
 */
export const minotSources={
 about:{label:'学校概况与统计',url:'https://www.minotstateu.edu/about.shtml'},
 catalog:{label:'学校学术目录与历史',url:'https://catalog.minotstateu.edu/undergraduate/introduction/'},
 accreditation:{label:'学校与项目认证',url:'https://www.minotstateu.edu/accreditation/'},
 campus:{label:'官方校园地图',url:'https://www.minotstateu.edu/map/'},
 oldMain:{label:'Old Main 建筑资料',url:'https://www.minotstateu.edu/map/loc/old_main.shtml'},
 management:{label:'管理学硕士官方项目页',url:'https://www.minotstateu.edu/graduate/future_students/programs/management.shtml'},
 cyber:{label:'网络安全硕士官方项目页',url:'https://www.minotstateu.edu/graduate/future_students/programs/cybersecurity-information-assurance.shtml'},
 admission:{label:'研究生申请、语言、材料、I-20 与签证资格说明',url:'https://www.minotstateu.edu/graduate/future_students/'},
 deadlines:{label:'各项目录取标准及申请截止日',url:'https://www.minotstateu.edu/graduate/future_students/Application-Deadlines.shtml'},
 tuition:{label:'研究生费用与国际生年度参考',url:'https://www.minotstateu.edu/graduate/future_students/financial-resources.shtml'},
 scholarship:{label:'研究生奖学金与助教岗位',url:'https://www.minotstateu.edu/graduate/future_students/aid-scholarships.shtml'},
 housing:{label:'校内宿舍类型',url:'https://www.minotstateu.edu/life/residence-halls/'},
 studentCenter:{label:'学生中心服务',url:'https://www.minotstateu.edu/map/Student-Center.shtml'}
} as const;

export type PhotoCredit={id:string;file:string;title:string;summary:string;creator:string;license:string;licenseUrl:string;sourceUrl:string;credit:string;captured:string};
export const minotPhotos:PhotoCredit[]=[
 {id:'highsmith',file:'old-main-highsmith.jpg',title:'Old Main · 校园历史建筑',summary:'2021 年拍摄的学校主楼建筑实景，来自美国国会图书馆馆藏。',creator:'Carol M. Highsmith',license:'Public domain（公共领域；LOC 标记无已知出版限制）',licenseUrl:'https://www.loc.gov/rr/print/res/482_high.html',sourceUrl:'https://www.loc.gov/pictures/item/2021757296/',credit:'Library of Congress · Highsmith Archive · LC-DIG-highsm-69075',captured:'2021-11-27'},
 {id:'goldenpaw',file:'old-main-goldenpaw2000.jpg',title:'Old Main · 校园正面',summary:'由 Wikimedia Commons 摄影者记录的主楼正面；显示校园实际建筑，而非 AI 生成画面。',creator:'Goldenpaw2000',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:Oldmainmsu.jpg',credit:'Wikimedia Commons · Oldmainmsu.jpg',captured:'历史照片 · 拍摄日期未标明'},
 {id:'alex',file:'old-main-alexwcovington.jpg',title:'Old Main · 另一角度',summary:'历史校园主楼照片，展示与其他作品不同的拍摄角度。',creator:'Alexwcovington',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:Minotstate.jpg',credit:'Wikimedia Commons · Minotstate.jpg',captured:'2004 年前后'}
];
export const minotFacts=[
 {label:'创校年份',value:'1913 年',source:minotSources.about.url},
 {label:'学校类型',value:'美国公立综合性大学',source:minotSources.catalog.url},
 {label:'认证机构',value:'Higher Learning Commission',source:minotSources.accreditation.url},
 {label:'校园面积',value:'100+ 英亩',source:minotSources.about.url},
 {label:'2026 秋季在校生',value:'2,758 人',source:minotSources.about.url},
 {label:'师生比（官方概况）',value:'11 : 1',source:minotSources.about.url}
];
export const minotCampusSections=[
 {title:'学校与地区',body:'Minot State University 位于美国北达科他州 Minot（迈诺特市），创办于 1913 年，最早是一所培养教师的师范学校，后来逐步扩展为提供多学科本、研究生教育的公立大学。与大型都市校园不同，这里更适合希望认真研究课程内容、日常预算和生活环境的申请者。学校官网目前列出 100 多个学习方向，包含本科和研究生层次。',source:minotSources.about.url},
 {title:'校园学习环境',body:'Old Main 是校园的标志性红砖教学建筑，学校官方资料显示其中有商学院相关教学空间、表演艺术场所、学习中心和信息技术服务。图书馆、Student Center 和体育健康设施在校园地图中均可查询。对计划读管理学硕士的学生而言，Old Main 是学校实际的商科教学建筑，不应把历史图片误写成具体硕士课堂实拍。',source:minotSources.oldMain.url},
 {title:'城市生活与交通',body:'学校位于美国北部的中小型城市 Minot。相比大城市，学生需要特别关注冬季天气、通勤方式、住房位置与是否拥有汽车。校园地图能帮助确定教学楼、图书馆、宿舍及学生中心的位置，但并不能代替当前的租金、交通时间和安全评价。',source:minotSources.campus.url},
 {title:'住宿与校园服务',body:'校内有 Cook Hall、Crane Hall、Lura Manor、McCulloch Hall 等学生宿舍，具体房型、住宿条件和空余床位要以学校住宿办公室当期公布内容为准。Student Center 提供餐饮、书店、校园活动等服务。学校公布的费用预算采用部分宿舍双人间与基础餐饮方案作为参考，不能推断人人都能订到同一房型。',source:minotSources.housing.url}
];
export const minotAdmissions={
 general:'研究生院一般入学资格要求拥有或即将获得认可的本科学位；最低累计本科 GPA 2.75/4.00。不同项目对最近 60 学分、GRE 和工作经历可能有额外规定，学校最终审核成绩与学历认证。',
 english:[
  'TOEFL iBT：学校现行页面列出的最低 79 分；',
  'IELTS Academic：总分最低 6.0；',
  'Duolingo English Test：最低 105 分。',
  '部分英语授课大学毕业者可申请豁免，但须由学校审核；成绩需遵守时效及官方送分要求。'
 ],
 documents:[
  '在学校研究生申请入口提交在线申请并支付不可退还的 35 美元申请费。',
  '提交不少于 500 英文字的目的陈述（Statement of Purpose）；内容应解释学习方向、申请动机和相关经历。',
  '上传简历（Resume），说明本科教育、相关工作、项目和能力。',
  '按申请系统要求提供 3 位推荐人，推荐表由推荐人在学校系统中填写。',
  '提供既往高校成绩单与本科学位证明；非加拿大的国际学历须通过 WES 或 ECE 完成逐课成绩评估。',
  '提交适用的英语能力证明和可能的补充材料；不同项目以各自招生页面为准。',
  '录取并接受入学之后，如须办理 F-1，才按学校要求提交 I-20 和资金证明；在此之前先核实目标专业是否有相应资格。'
 ],
 contact:'graduate@minotstateu.edu'
};
export const minotTuitionRows=[
 {label:'国际研究生学费与杂费',value:'US$9,161',tip:'2026–27 学校官网的 9 学分参考口径；具体学年与选课组合须确认。'},
 {label:'住宿与餐饮',value:'US$9,200',tip:'学校给出的校内部分双人间与基础餐饮方案参考，并非保证有房。'},
 {label:'健康保险',value:'US$2,280',tip:'学校国际学生预算单列项目，实际按投保政策确认。'},
 {label:'学校公布的参考合计',value:'US$20,641',tip:'官网称为 fall + spring 两学期年度预算；不是整个硕士学位的总开支。'}
];
export const minotFAQs=[
 {q:'这个学校是否只收商科本科生？',a:'不是。管理学 MSM 项目官方明确表示无需原有商科背景。不过仍须达到学校和项目的学历、成绩、语言及申请材料要求。',url:minotSources.management.url},
 {q:'国际学生可以去校园上课吗？',a:'管理学硕士提供校内课程，且学校国际研究生申请页面把 Management 列为可申请学生签证文件的方向；具体 I-20、课程负荷及签证仍须由学校国际办公室和主管机构确认。',url:minotSources.admission.url},
 {q:'网络安全硕士也可以拿 I-20 到美国读吗？',a:'不能这样推断。网络安全项目虽写有 On Campus，但学校公布的 I-20/F-1 适用专业清单并没有列出 Cybersecurity。因此本平台明确标注为“当前未见 F-1 适用依据”，请先向学校确认，不建议直接按线下留学可行来规划。',url:minotSources.admission.url},
 {q:'US$20,641 就是整个硕士读完的费用吗？',a:'不是。这是学校 2026–27 年在特定修课及住宿假设下公布的国际生年度参考合计，未把整个 30 学分学位的全部费用或个人旅行、额外学分成本算成固定承诺。',url:minotSources.tuition.url},
 {q:'奖学金和助教能确保获得吗？',a:'不能保证。学校研究生院介绍了助教和奖学金，但助教需要录取、选拔及相应注册学分；学校还明确助教岗位薪酬不等于学费减免。部分奖学金仅适用于特定院系、校友或北达科他州教育工作者。',url:minotSources.scholarship.url},
 {q:'申请过了截止日还可以补交吗？',a:'学校提示资料必须在项目截止日前完整收到。Management 对国际申请者列出秋季 5 月 31 日、春季 9 月 30 日的参考截止日期；Cybersecurity 列出秋季 5 月 31 日。年份和当年名额以官方更新为准。',url:minotSources.deadlines.url}
];
export const minotPrograms={
 'minot-management-ms':{
  duration:'30 学分；学校项目招生页表示可选 3 或 4 学期完成路径，实际学制取决于修课安排。',
  eligibility:'本科专业不限于商科；学校申请标准列明须具备本科学位、累计 GPA ≥2.75 或符合最近 60 学分计算要求；GPA 未达 3.00 时学校项目另有 GRE 条件。',
  curriculum:[
   {title:'管理与团队领导',body:'项目强调沟通、协作、领导和复杂商业问题分析；适合希望向管理职责、团队协调或跨部门项目管理发展的申请者。'},
   {title:'战略营销与市场分析',body:'官方项目介绍列出战略营销，重视理解市场决策、客户需求、竞争环境和管理层面的分析。'},
   {title:'财务与组织运营',body:'项目介绍包含财务管理、人力资源等方向；它是广义管理学学位，不应简单等同 MBA 或持证金融专业。'},
   {title:'结业与后续发展',body:'学校提供多种 capstone 选择，并将继续读博或进入管理、市场、人力资源等岗位作为发展方向示例。岗位示例不等于毕业就业保证。'}
  ],
  deadlines:[
   {period:'秋季入学（国际申请）',date:'5 月 31 日',note:'依据学校招生标准网页；当年招生周期与是否仍开放须确认。'},
   {period:'春季入学（国际申请）',date:'9 月 30 日',note:'依据学校招生标准网页；应核查所申请年份。'}
  ],
  flag:'学校国际生说明将 Management 列在 I-20/F-1 适用项目内；实际发放 I-20 与入境资格需另行审批。',
  suitability:'适合本科不是商科但希望转向企业管理、市场、组织管理等学习方向的学生。不要把“专业背景可跨”误读为“成绩、英语和签证一定满足”。'
 },
 'minot-cyber-ms':{
  duration:'30 学分，学校项目页面给出约 1–2 年完成时间，并标注校内和在线选项。',
  eligibility:'官方列明技术或商科相关本科背景，或具有相关工作经历；最低成绩与语言需满足研究生院要求。纯文科背景不应默认适合。',
  curriculum:[
   {title:'信息保障与网络安全',body:'涉及数字基础设施安全、风险识别、网络保护与安全设计，学校以信息系统安全为主要方向。'},
   {title:'数据与数字取证',body:'项目介绍明确涉及数据库系统和数字取证等内容。这些内容通常需要理解技术系统和证据处理流程，官方概览并不是完整的逐门课程清单；申请前还应咨询实际先修要求。'},
   {title:'治理、风险与合规',body:'涉及安全管理、治理、政策、风险分析和合规，帮助技术管理人员理解组织层面的信息安全职责。'},
   {title:'申请路径与重大限制',body:'校内授课选项不等于国际学生有权凭该项目申领 F-1。学校国际研究生 I-20 清单目前没有网络安全，必须向学校取得书面确认。'}
  ],
  deadlines:[
   {period:'秋季入学（国际申请）',date:'5 月 31 日',note:'学校招生页面目前只列国际申请者秋季 intake。'}
  ],
  flag:'国际生特别提醒：学校公布的 I-20/F-1 适用研究生专业清单中未列入网络安全（Cybersecurity）；不能当作可靠的赴美线下学生签证路径。',
  suitability:'对于已有计算机、信息安全或相关工作经验的申请人可以研究课程，但计划通过该专业申请 F-1 的用户应先暂停办理，联系学校研究生院书面确认 I-20 资格与当前招生政策。'
 }
} as const;
