/* HHBA sixth university: Technical University of Munich, verified 2026-10-31.
   Facts come from TUM central Informatics MSc, CIT and admissions official sources.
   NOT a conversion Master's. International full-time €6,000/semester + semester contribution.
*/
export const tumSources={
 school:{name:'TUM 官方校区和学校',url:'https://www.tum.de/en/about-tum/locations/garching'},
 program:{name:'TUM Informatics MSc · 正式招生、课程与收费',url:'https://www.tum.de/en/studies/degree-programs/detail/informatics-master-of-science-msc'},
 cit:{name:'TUM CIT 信息学硕士申请要求与项目详情',url:'https://www.cit.tum.de/en/cit/studies/degree-programs/master-informatics/'},
 curriculum:{name:'TUM CIT 信息学硕士课程结构',url:'https://www.cit.tum.de/en/cit/studies/degree-programs/master-informatics/curriculum/'},
 admission:{name:'TUM CIT 研究生在线申请流程',url:'https://www.cit.tum.de/en/cit/studies/prospective-students/application/'},
 english:{name:'TUM 英语语言证书认可标准',url:'https://www.tum.de/en/studies/application/application-info-portal/admission-requirements/language-certificates/'},
 international:{name:'德国境外取得本科后的 uni-assist VPD 预审',url:'https://www.tum.de/en/studies/application/application-info-portal/uni-assist'},
 tuition:{name:'非欧盟学生学费豁免和实际适用条件',url:'https://www.tum.de/en/studies/fees/tuition'},
 fee:{name:'全体学生必须另交的学期杂费',url:'https://www.tum.de/en/studies/fees/semester-fees'},
 scholarships:{name:'TUM 非欧盟学费豁免、减免及奖学金',url:'https://www.tum.de/en/studies/fees/tuition/scholarships-and-waivers'}
} as const;
export const tumStats=[
 {label:'大学名称',value:'Technical University of Munich'},
 {label:'主授课地点',value:'Garching'},
 {label:'学习年限',value:'4 学期（标准全日制）'},
 {label:'课程学分',value:'120 ECTS'},
 {label:'授课语言',value:'通常英语'},
 {label:'首批详细硕士',value:'Informatics MSc'}
];
export const tumPhotos=[
 {id:'panorama',file:'garching-panorama.jpg',commons:'Campus TU München, Garching.jpg',name:'Garching 研究园区全景',author:'High Contrast',date:'2009-04',license:'CC BY 3.0 DE',licenseUrl:'https://creativecommons.org/licenses/by/3.0/de/deed.en',sourceUrl:'https://commons.wikimedia.org/wiki/File:Campus_TU_M%C3%BCnchen,_Garching.jpg',description:'2009 年从地铁站方向拍摄的真正 TUM Garching 研究校区全景，显示不同学院和研究楼分布；是历史校园照片。'},
 {id:'institute',file:'advanced-study.jpg',commons:'TU München Garching - Institute for Advanced Study.jpg',name:'Institute for Advanced Study',author:'High Contrast',date:'2013',license:'CC BY 3.0 DE',licenseUrl:'https://creativecommons.org/licenses/by/3.0/de/deed.en',sourceUrl:'https://commons.wikimedia.org/wiki/File:TU_M%C3%BCnchen_Garching_-_Institute_for_Advanced_Study.jpg',description:'2013 年独立拍摄的 TUM Garching 高等研究院建筑，与数学信息学教学楼不是同一建筑，不能代替专业课教室照片。'},
 {id:'magistrale',file:'informatik-atrium.jpg',commons:'MI-Gebäude der TU München Magistrale2.JPG',name:'数学与信息学楼 · 中庭滑梯',author:'TobiasK（Church of emacs）',date:'2012-01-11',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',sourceUrl:'https://commons.wikimedia.org/wiki/File:MI-Geb%C3%A4ude_der_TU_M%C3%BCnchen_Magistrale2.JPG',description:'2012 年摄于 TUM 数学和信息学大楼内部的知名抛物线滑梯，照片中显示真实的校园中庭而不是 AI 生成场景。'}
] as const;
export const tumOverview=[
 {title:'TUM 研究型大学和不同校区',body:'慕尼黑工业大学是一所德国公立研究型大学，其校区分散在 Munich、Garching、Freising 等地。信息学硕士主要位于 Garching，不能因为学校英文名称带 Munich 就默认日常课堂都在市中心。大学官网提供校区、交通、学习设施及 Garching 实际地点信息，申请者应将课程位置与住宿通勤分别核实。',source:tumSources.school.url},
 {title:'项目定位：不是跨专业零基础转换',body:'TUM 的 MSc Informatics 是深入研究计算机科学理论与实践的进阶学位。校方明确它是在本科阶段已经掌握的计算机科学基本原理上进一步扩展知识；依据本科模块和课程大纲进行课程匹配及分阶段 aptitude assessment。艺术、舞蹈、设计等非计算机学历不能因为“接受国际本科申请”就被推断为符合专业基础要求。',source:tumSources.cit.url},
 {title:'课程方向高度灵活，但须完成实际学分',body:'信息学硕士的研究和工程领域横跨算法、数据库、软件工程、机器学习与数据分析、计算机视觉、机器人、网络分布式系统、IT 安全及形式方法。官方提供广泛的选修课程目录和实践、研究方向选择。不同学生选修内容、科研导师和毕业论文题目可能差异很大，因此这里列的是“领域与课程体系”，不编造所有学生统一必修的课程名称。',source:tumSources.program.url},
 {title:'语言与真实日常生活',body:'该硕士通常用英语授课并要求英语能力证明，不应给出“必须德语 B2 才能入学”的虚假统一条件。不过在德国租房、政府办事、就医和求职时，德语能力仍可能帮助日常适应；德语学习建议和学位正式录取要求需要明确分开。Garching 的生活预算包括租金、强制医疗保险、日常开销和交通，不能只看到学期杂费便认为大学生活成本很低。',source:tumSources.english.url}
];
export const tumThemes=[
 {name:'算法、理论与形式方法',detail:'在本科已掌握数据结构、离散数学和复杂度分析的基础上继续学习高级算法、计算理论、软件正确性和形式化验证，适合需要严谨数学及计算基础的进阶方向。不能把这些领域当作没有数学先修也可直接入学的零基础培训课程。'},
 {name:'人工智能、机器学习与数据分析',detail:'围绕机器学习、数据建模和智能系统的研究应用选择进阶模块。研究方向可能与数学理论、软件系统和应用领域交叉；课程内容、选修资格及导师资源需以 TUMonline 的具体学期模块目录为准。'},
 {name:'数据库、信息系统与软件工程',detail:'研究大型信息系统、数据存储、系统设计、软件体系结构与工程质量。大学强调从基础理论到复杂计算系统设计的综合能力，不能保证每名学生都上完这整个方向的所有模块。'},
 {name:'计算机图形学、视觉与机器人',detail:'涉及图形、计算机视觉、机器人和对现实世界的感知与交互等研究方向。学生能否选择相关实践和研究项目取决于课程安排、学科背景以及特定模块先修和容量。'},
 {name:'计算机网络、系统、安全与隐私',detail:'官方项目简介包含计算机架构、分布式系统、网络与数据保护等内容；申请者应结合本科操作系统、计算机网络和程序设计等基础评估学习准备。'},
 {name:'研究工作、实验与毕业论文',detail:'硕士培养涵盖研究导向模块、实践训练及学位论文。120 ECTS 是整个四学期培养计划总量，具体各类选修、项目与论文的学分分配应以最新学院 Curriculum 页面为准，不凭猜测罗列统一必修课。'}
];
export const tumLanguage=[
 'TUM 信息学硕士以英语为主要授课语言；学校规定英语证明通常必须在申请截止前提交。',
 '学校目前认可 IELTS Academic 总分至少 6.5；接受的 IELTS Online 版本和豁免应按申请网页核对。',
 'TOEFL iBT 要求 88（旧 0–120 制），学校也接受 ETS 新计分体系对应成绩；不能简单把 88 直接写成某个未经核实的新制数字。',
 'PTE Academic 要求总分至少 65；TUM 还列出 CAE/CPE 等认可形式。',
 '申请者若已有一定比例英语授课本科课程或英语学位论文，部分情况可能依专业规定以替代材料证明英语能力；不是人人自动豁免。',
 '“信息学 MSc 主要英语授课”与“德国生活需要一定德语”属于不同判断；不要虚构德语 B2 为统一入学要求。'
];
export const tumApplication=[
 '首先查看 TUM Informatics MSc 的官方 Programme Details 和 CIT 招生说明，确认它是研究型计算机硕士而非文科/舞蹈/设计直接转计算机的 Conversion MSc。',
 '将完整本科课程清单、ECTS 或学分与 TUM 的计算机科学基础逐项比较：数学、算法、数据结构、软件工程、计算机体系结构、系统及理论等，避免直接以学校排名判断申请资格。',
 '准备本科成绩单、毕业学位、课程模块目录、相关课程描述及必要翻译；TUM 明确要求 Curricular Analysis 和 Module Catalog，这与普通“只交成绩单”不同。',
 '若本科在德国之外取得，按 TUM 规定提前申请 uni-assist VPD 预审。VPD 办理和 TUMonline 正式提交是两个程序，VPD 不代表录取。',
 '核对英语证明：IELTS Academic 6.5、TOEFL iBT 88（旧制）、PTE 65 或被承认的替代证据，必须赶上目标申请周期截止。',
 '在冬季学期 2 月 1 日至 5 月 31 日、夏季学期 10 月 1 日至 11 月 30 日的招生窗口内，通过 TUMonline 提交学校要求的全部文件。',
 '按官方项目列表准备英文 Essay、Motivation Letter、最新简历和护照；逐项对照当年格式与字数限制，不虚构统一推荐信要求。',
 '保存 TUMonline 的申请编号，按 CIT 指南完成在线 Curricular Analysis，生成 PDF 上传。文件遗漏可能影响 aptitude assessment 的处理。',
 '等待校方分阶段 aptitude assessment：学校先审核学业成绩和文书，部分申请者可能进入面试。不是满足英语最低分就保证录取。',
 '收到录取后按学生个人身份核实 €6,000/学期非欧盟学费、另付的学期杂费、合法减免和资金证明；按学校注册要求提交认证文凭、医保状态等材料。',
 '根据德国主管机构现行签证流程办理学生签证/居留手续，提前安排 Garching 校区通勤及住宿；录取、学费豁免、工作资格和签证批准彼此独立。'
];
export const tumWindows=[
 {name:'冬季学期入学',range:'2 月 1 日—5 月 31 日',detail:'这是信息学 MSc 官方常规申请区间，必须核对具体目标年份和是否允许补交特殊文件。'},
 {name:'夏季学期入学',range:'10 月 1 日—11 月 30 日',detail:'该硕士官方明确冬夏两季都可入学；实际申请年份与学期需按 TUMonline 开放状态核实。'}
];
export const tumFees=[
 {name:'非欧盟第三国全日制 Informatics MSc 学费',value:'€6,000 / 学期',desc:'学校项目页明确适用标准；个人可能因国籍、既往教育、减免等例外不同。'},
 {name:'标准学制',value:'4 学期 · 120 ECTS',desc:'学校公布的标准全日制进度。若按四学期且无豁免，纯学费算术参考为 €24,000；并非大学开具的总留学费用。'},
 {name:'Garching 校区当前学期杂费参考',value:'€97 / 学期',desc:'项目页列出当前 97 欧元；与非欧盟学费分别收取，金额随学期可能调整。'},
 {name:'生活、住宿、保险、交通与签证',value:'按实际预算',desc:'不包含在学费或 97 欧元学期杂费里；不使用未经核实的“德国免费读研”或固定生活成本推断。'},
 {name:'可能的经济援助',value:'资格审核后决定',desc:'校方有按学术表现/经济情况的学费豁免，以及每学期 €500–1,800 的部分资助；不保证申请成功。'}
];
export const tumFaq=[
 {q:'艺术、舞蹈、设计本科可以无条件跨专业申请 TUM 信息学吗？',a:'不能。TUM Informatics MSc 是本科计算机基础上的进阶硕士，招生采用课程对照和 aptitude assessment。虽然个别课程内容可能相近，但不能将“国际本科生可以申请”解释为“任何本科专业都符合课程先修”。',source:tumSources.cit.url},
 {q:'TUM 是德国公立大学，为什么还要交学费？',a:'自 2024/25 学年起，TUM 对大多数新入学非欧盟/欧洲经济区学生按课程收取学费；信息学 MSc 官方费用为全日制每学期 €6,000，另有学期杂费。可能存在豁免，但不能预先视为免学费。',source:tumSources.tuition.url},
 {q:'€97 是每学期全部收费吗？',a:'不是。€97 是项目页公布的当前学期杂费，与非欧盟第三国硕士学费 €6,000/学期是两笔不同费用，住宿、保险、签证等也不包含其中。',source:tumSources.program.url},
 {q:'雅思或托福达标，是否就保证进入信息学硕士？',a:'不能保证。英语证明仅是语言条件，学术能力还需要本科专业课程匹配、成绩、英文 Essay、动机信、课程分析与可能的面试评价；学校有明确的两阶段 aptitude assessment。',source:tumSources.cit.url},
 {q:'信息学 MSc 是否必须提交德语 B2？',a:'该硕士官方主要英语授课，要求英语证明；不应凭“在德国读书”就虚构统一的德语 B2 门槛。德国生活和求职时建议学习德语，但要和学术入学语言门槛分开。',source:tumSources.english.url},
 {q:'海外本科申请为什么需要 uni-assist VPD？',a:'学校明确要求多数德国境外获得本科资格的申请者在 TUMonline 之外提前办理 uni-assist VPD 用于学历材料初审；它和学校专业录取及签证审查互不替代。',source:tumSources.international.url},
 {q:'非欧盟学生有可能申请学费豁免或奖学金吗？',a:'有申请途径。TUM 说明可能依据优异学业表现或经济需要审核学费豁免，也提供一定金额的资助。不过必须按各自申请周期提交材料，不能承诺人人有份或自动扣除费用。',source:tumSources.tuition.url},
 {q:'120 ECTS 是不是意味着所有学生必修相同课程？',a:'不是。120 ECTS 是整个研究生培养结构，学校提供广泛选修方向、研究与实践模块。完整的学分配额、毕业论文及选修条件应查询 CIT 实时课程图与个人课程计划。',source:tumSources.curriculum.url}
];
