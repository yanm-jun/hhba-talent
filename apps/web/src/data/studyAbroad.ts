/* HHBA Study Abroad V1: country-level directional cards, NOT verified university admission offers.
 * Official national resources checked 2026-10-30. Individual tuition/eligibility/deadlines require university-level verification.
 */
export type StudyGoal='all'|'budget'|'cross'|'scholar'|'work';
export type StudyCountryCode='us'|'uk'|'au'|'de'|'jp'|'nz';
export type StudyCountry={
 code:StudyCountryCode; name:string; english:string; flag:string; resource:string; sourceName:string;
};
export const studyCountries:StudyCountry[]=[
 {code:'us',name:'美国',english:'United States',flag:'🇺🇸',resource:'https://educationusa.state.gov/your-5-steps-us-study/research-your-options/',sourceName:'EducationUSA · 美国国务院'},
 {code:'uk',name:'英国',english:'United Kingdom',flag:'🇬🇧',resource:'https://study-uk.britishcouncil.org/plan-studies',sourceName:'Study UK · 英国文化教育协会'},
 {code:'au',name:'澳大利亚',english:'Australia',flag:'🇦🇺',resource:'https://www.studyaustralia.gov.au/',sourceName:'Study Australia · 澳大利亚官方留学平台'},
 {code:'de',name:'德国',english:'Germany',flag:'🇩🇪',resource:'https://www.daad.de/en/studying-in-germany/universities/all-degree-programmes/',sourceName:'DAAD · 德国学术交流中心'},
 {code:'jp',name:'日本',english:'Japan',flag:'🇯🇵',resource:'https://www.studyinjapan.go.jp/en/',sourceName:'Study in Japan · 日本官方留学信息'},
 {code:'nz',name:'新西兰',english:'New Zealand',flag:'🇳🇿',resource:'https://www.studywithnewzealand.govt.nz/en',sourceName:'Study with New Zealand · 新西兰官方留学平台'}
];
export type StudyDirection={
 id:string; country:StudyCountryCode; title:string; summary:string; badge:string;
 goals:Exclude<StudyGoal,'all'>[]; highlights:string[]; keywords:string[];
 focus:string; admissions:string; budget:string; aid:string; career:string;
};
export const studyDirections:StudyDirection[]=[
 {id:'us-public-masters',country:'us',title:'美国公立大学硕士方向',summary:'关注区域公立院校的学位设置、真实预算与跨专业门槛。',badge:'费用比较',
 goals:['budget','cross','work'],highlights:['硕士方向','费用核查','背景匹配'],keywords:['美硕','美国硕士','公立','master','graduate','公共大学','跨专业'],
 focus:'先按学位授予类型、学校所在地、专业先修课与国际学生资格逐项缩小范围，再到院校官网确认项目。',
 admissions:'需要分别核对本科专业、先修课程、成绩、语言和申请材料；不能因为学校是公立就推断能跨专业。',
 budget:'公立大学不代表一定低学费，需分别比较国际生学费、杂费、医疗保险、住宿和交通。',
 aid:'查看学校研究生奖学金、助教与研究助理名额及限制，不预设有全奖。',
 career:'将专业培养内容与所在州就业环境结合，毕业后工作资格以主管机关与个人情况为准。'},
 {id:'de-public',country:'de',title:'德国公立大学升学方向',summary:'比较语言、学术课程衔接与各州收费和生活支出。',badge:'预算研究',
 goals:['budget','scholar'],highlights:['公立院校','授课语言','资助检索'],keywords:['德国公立','daad','德语','英语授课','scholarship'],
 focus:'使用 DAAD 项目数据库按授课语言、学校、专业和学历筛选，随后核实目标院校具体条款。',
 admissions:'学分模块匹配、课程先修和语言门槛因项目而异，不等于可以无条件跨专业。',
 budget:'部分公立项目仍可能向国际学生收取学费；学期费、签证资金要求与生活费应分别确认。',
 aid:'通过 DAAD 和学校官方奖学金入口核对申请对象、金额和截止时间。',
 career:'如考虑毕业就业，须单独核实当时的签证、就业和居留规定。'},
 {id:'jp-masters',country:'jp',title:'日本大学院修士方向',summary:'了解研究计划、导师匹配、入学选拔与生活预算。',badge:'研究生升学',
 goals:['budget','scholar','work'],highlights:['研究方向','大学院','奖学金'],keywords:['日本','修士','大学院','研究生','mext','jasso'],
 focus:'先明确研究方向和授课语言，再确认是否需要联系导师、参加校内考试或提交研究计划。',
 admissions:'研究科和专业的选拔方式不同；材料要求及日语或英语成绩以当年度招生简章为准。',
 budget:'需计算入学金、学费、城市生活费和可能的研究生阶段额外成本。',
 aid:'可查询 JASSO、MEXT 及学校资助项目；申请资格和名额须官方确认。',
 career:'在学兼职与毕业就业需要分别核对在留资格，不承诺工作或留日结果。'},
 {id:'uk-taught-masters',country:'uk',title:'英国授课型硕士方向',summary:'关注学制、专业转换课程与总体投入。',badge:'学制与专业',
 goals:['cross','work'],highlights:['授课型硕士','专业转换','总预算'],keywords:['英国','英硕','授课型','conversion','one year','masters'],
 focus:'根据本科经历检索明确接受不同专业背景的课程，再核对所需工作经验和语言条件。',
 admissions:'不是所有授课型硕士都接受跨专业，应查看每个课程的国际学历等同要求。',
 budget:'除学费外，还要考虑住宿、城市生活费、签证及健康附加费等项目。',
 aid:'核查学校、专业和官方奖学金，不把未公开的资助机会当作已开放。',
 career:'毕业后签证和求职规则可能调整，应查英国政府最新规定。'},
 {id:'au-masters',country:'au',title:'澳大利亚硕士升学方向',summary:'梳理课程转换、奖学金与签证预算。',badge:'跨专业探索',
 goals:['cross','scholar','work'],highlights:['硕士课程','转换方向','官方课程搜索'],keywords:['澳洲','澳大利亚','study australia','master','专业转换'],
 focus:'先用官方课程目录查授课方式、校区和职业认证，再比较招生条件。',
 admissions:'专业转换、先修课和学历认可按具体课程执行，不把方向筛选当作录取判断。',
 budget:'应同时计算课程学费、保险、生活费和签证相关成本。',
 aid:'核对政府与大学的奖学金类别、国籍限制及申请窗口。',
 career:'课程是否关联职业认证、实习或毕业工作资格须分别核实。'},
 {id:'nz-masters',country:'nz',title:'新西兰硕士升学方向',summary:'将课程选择与毕业工作政策分开核查。',badge:'就业衔接',
 goals:['cross','work'],highlights:['课程匹配','职业发展','签证核实'],keywords:['新西兰','nz','新西兰硕士','post study','就业'],
 focus:'先比对官方课程、学位等级、专业先修和可选校区，再查看学校招生页面。',
 admissions:'不同课程对本科专业、成绩、英语水平和工作经历要求不同。',
 budget:'比较国际学生学费、保险、城市生活费及其他必要费用。',
 aid:'奖学金是否开放以官方平台和学校当年度公告为准。',
 career:'毕业后工作签证资格由课程、学习情况和政策决定，不保证获得。'}
];
export const studyGoalLabels:Record<StudyGoal,string>={all:'全部方向',budget:'低预算',cross:'跨专业',scholar:'奖学金',work:'就业导向'};
export function studyCountry(code:StudyCountryCode){return studyCountries.find(c=>c.code===code)!;}
export function matchesStudyDirection(direction:StudyDirection,goal:StudyGoal,country:StudyCountryCode|'',term:string){
 if(country&&direction.country!==country)return false;
 if(goal!=='all'&&!direction.goals.includes(goal))return false;
 const c=studyCountry(direction.country);
 const text=[direction.title,direction.summary,direction.badge,direction.focus,direction.admissions,c.name,c.english,...direction.highlights,...direction.keywords,...direction.goals.map(g=>studyGoalLabels[g])].join(' ').toLocaleLowerCase();
 return term.trim().toLocaleLowerCase().split(/\s+/).every(word=>text.includes(word));
}
