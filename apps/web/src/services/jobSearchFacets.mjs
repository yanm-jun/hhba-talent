// Conservative public ATS metadata matching, never redistribute an employer JD.
const norm=v=>String(v||'').toLowerCase().normalize('NFKC').trim();
const esc=v=>v.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
const word=(s,alias)=>/^[a-z0-9 .+#-]+$/i.test(alias)?
 new RegExp('(^|[^a-z0-9])'+esc(alias).replace(/ /g,'\\s+')+'(?=$|[^a-z0-9])','i').test(s):s.includes(alias);
const remove=(s,alias)=>/^[a-z0-9 .+#-]+$/i.test(alias)?
 s.replace(new RegExp('(^|[^a-z0-9])'+esc(alias).replace(/ /g,'\\s+')+'(?=$|[^a-z0-9])','i'),'$1'):
 s.replace(alias,' ');
const countries=[
 ['SG','新加坡','singapore'],['US','美国','united states','usa','u.s.','us'],['GB','英国','united kingdom','uk','england'],
 ['CA','加拿大','canada'],['AU','澳大利亚','australia'],['DE','德国','germany'],['NL','荷兰','netherlands'],
 ['FR','法国','france'],['IN','印度','india'],['JP','日本','japan'],['CN','中国','china'],
 ['IE','爱尔兰','ireland'],['AE','阿联酋','united arab emirates','uae'],['NZ','新西兰','new zealand'],
 ['CH','瑞士','switzerland'],['SE','瑞典','sweden']
].map(([value,zh,...en])=>({value,zh,en,aliases:[zh,...en]}));
const cities=[
 ['singapore','SG','新加坡'],['san francisco','US','旧金山'],['new york','US','纽约'],['seattle','US','西雅图'],
 ['austin','US','奥斯汀'],['boston','US','波士顿'],['los angeles','US','洛杉矶'],['palo alto','US','帕洛阿尔托'],
 ['mountain view','US','山景城'],['chicago','US','芝加哥'],['atlanta','US','亚特兰大'],['miami','US','迈阿密'],
 ['redmond','US','雷德蒙德'],['london','GB','伦敦'],['manchester','GB','曼彻斯特'],
 ['toronto','CA','多伦多'],['vancouver','CA','温哥华'],['montreal','CA','蒙特利尔'],
 ['sydney','AU','悉尼'],['melbourne','AU','墨尔本'],['berlin','DE','柏林'],
 ['munich','DE','慕尼黑'],['amsterdam','NL','阿姆斯特丹'],['paris','FR','巴黎'],
 ['dublin','IE','都柏林'],['tokyo','JP','东京'],['osaka','JP','大阪'],
 ['bangalore','IN','班加罗尔'],['hyderabad','IN','海得拉巴'],['mumbai','IN','孟买'],
 ['beijing','CN','北京'],['shanghai','CN','上海'],['shenzhen','CN','深圳'],
 ['guangzhou','CN','广州'],['hangzhou','CN','杭州'],['dubai','AE','迪拜'],
 ['zurich','CH','苏黎世'],['stockholm','SE','斯德哥尔摩']
].map(([value,country,zh])=>({value,country,zh,aliases:[zh,value]}));
const roles=[
 ['software',['软件工程师','软件开发','软件研发','程序员','后端开发','前端开发','全栈开发','software engineer','software developer','backend engineer','front-end engineer','frontend engineer','full stack engineer','fullstack engineer','swe'],
 ['software engineer','software developer','software engineering','backend engineer','front-end engineer','frontend engineer','full stack','fullstack','swe']],
 ['sales',['销售','客户销售','客户经理','业务拓展','销售经理','sales','account executive','business development'],
 ['sales','account executive','business development','sales development','account manager','territory manager']],
 ['data analyst',['数据分析师','数据分析','data analyst','business analyst'],['data analyst','business analyst','analytics engineer']],
 ['data science',['数据科学家','数据科学','data scientist','data science'],['data scientist','data science']],
 ['product',['产品经理','产品管理','product manager'],['product manager','product management','product lead']],
 ['design',['设计师','设计','designer','design'],['design','designer','user experience','ux']],
 ['marketing',['市场营销','市场推广','营销','marketing'],['marketing','demand generation']],
 ['finance',['财务','会计','财务分析','finance','accounting'],['finance','accounting','accountant','financial analyst']],
 ['hr',['人力资源','招聘专员','招聘经理','recruiter','human resources'],['human resources','recruiter','talent acquisition']],
 ['operations',['运营','operations'],['operations','business operations']],
 ['mechanical',['机械工程师','机械工程','mechanical engineer'],['mechanical engineer']],
 ['electrical',['电气工程师','电气工程','electrical engineer'],['electrical engineer']],
 ['engineer',['工程师','engineer'],['engineer','engineering']],
 ['support',['客户支持','客服','customer support'],['customer support','customer service','customer success']],
 ['warehouse',['仓储','仓库','物流','warehouse'],['warehouse','logistics','fulfillment']],
 ['intern',['实习生','实习','internship','intern'],['intern','internship','co-op']]
].map(([key,aliases,english])=>({key,aliases,english}));
const skills=['typescript','javascript','python','react','sql','postgresql','excel','aws','gcp','azure',
 'docker','kubernetes','pytorch','tensorflow','figma','salesforce','golang','java','rust','node.js',
 'tableau','power bi','c++','c#','swift','kotlin','linux','spark','redis','mongodb'];
const sortedCities=[...cities].sort((a,b)=>b.value.length-a.value.length);
export function locationFacts(location,domestic=false){
 const t=norm(location);
 if(!t)return {countryCode:domestic?'CN':null,cityKey:null};
 const direct=countries.find(c=>c.aliases.some(a=>word(t,a)))?.value||null;
 const city=sortedCities.find(c=>c.aliases.some(a=>word(t,a))&&(!direct||direct===c.country));
 const state=/(?:,\s*|\b)(?:CA|NY|TX|WA|MA|FL|IL|CO|GA|NC|VA|NJ)\b(?:,|$)/.test(String(location||''));
 return {countryCode:direct||city?.country||(state?'US':domestic?'CN':null),cityKey:city?.value||null};
}
export function extractRequirementFacts(raw){
 const t=norm(String(raw||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&').replace(/\s+/g,' ')).slice(0,240000);
 if(t.length<90)return {education:null,experienceMinYears:null,skills:[]};
 let education=null;
 if(/\bno (?:formal |specific )?(?:degree|education)(?: is)? required\b|\bdegree (?:is )?not required\b|学历不限|不要求学历|无学历要求|无需学历要求/i.test(t))education='UNRESTRICTED';
 else if(/\b(?:require(?:d|ments?)?|minimum|qualifications?|must have|you have|need)\b|任职要求/i.test(t)){
  for(const [level,pattern] of [
   ['HIGH_SCHOOL',/\bhigh school diploma\b|\bged\b/],
   ['ASSOCIATE',/\bassociate'?s? degree\b/],
   ['BACHELOR',/\bbachelor'?s? degree\b|\bundergraduate degree\b/],
   ['MASTER',/\bmaster'?s? degree\b|\bmsc degree\b/],
   ['PHD',/\bph\.?d\.?\b|\bdoctoral degree\b/]
  ])if(pattern.test(t)){education=level;break}
 }
 let experienceMinYears=null;
 if(/\bno (?:prior |professional |previous )?experience (?:is )?required\b|经验不限|不要求工作经验|无需工作经验/.test(t))experienceMinYears=0;
 else {
  const found=[];
  const patterns=[
   /\b(?:at least|minimum(?: of)?|min\.?)\s*(\d{1,2})\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:relevant |professional |work |industry )?experience\b/g,
   /\b(\d{1,2})\s*(?:-|to\s*\d{1,2}\s*)?\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:relevant |professional |work |industry |hands-on )?experience\b/g,
   /\b(\d{1,2})\+\s*(?:years?|yrs?)\b/g,
   /(?:至少|最低|不少于|要求)\s*(\d{1,2})\s*年(?:以上)?(?:工作|相关|专业)?经验/g
  ];
  for(const p of patterns){let m;while((m=p.exec(t)) && found.length<30)if(Number(m[1])<=40)found.push(Number(m[1]));}
  if(found.length)experienceMinYears=Math.min(...found);
 }
 return {education,experienceMinYears,skills:skills.filter(s=>word(t,s))};
}
export function classifyJobType(title,declared){
 if(['SOCIAL','CAMPUS','INTERNSHIP'].includes(declared))return {jobType:declared,jobTypeEvidence:'official_index'};
 const t=norm(title);
 if(/\bintern(?:ship)?\b|\bco[\s-]?op\b|\bworking student\b|实习/.test(t))
  return {jobType:'INTERNSHIP',jobTypeEvidence:'title_inferred'};
 if(/\bnew grad(?:uate)?\b|\brecent graduate\b|\bgraduate\b|\bgraduate program\b|\bcampus\b|\bearly careers\b|校招|应届|管培生/.test(t))
  return {jobType:'CAMPUS',jobTypeEvidence:'title_inferred'};
 return {jobType:'REGULAR',jobTypeEvidence:'title_exclusion_only'};
}
export function searchFacts(job,officialJD){
 return {...locationFacts(job.location,job.domestic),...extractRequirementFacts(officialJD),
  ...classifyJobType(job.title,job.recruitmentType)};
}
export function parseNaturalQuery(query){
 let text=norm(query).slice(0,100);
 const parsed={countryCode:null,cityKey:null,remote:false,education:null,experience:null,jobType:null,graduationYear:null,roleKeys:[],skills:[],terms:[]};
 // In 2026 autumn the term 2027届 is explicit cohort evidence, not a job-title keyword.
 const cohort=text.match(/(?:^|[^0-9])(202[6-9])\s*届?(?=$|[^0-9])/);
 if(cohort){parsed.graduationYear=Number(cohort[1]);text=text.replace(cohort[0],' ')}
 if(word(text,'秋招')){parsed.jobType='CAMPUS';text=remove(text,'秋招')}
 for(const c of sortedCities){const alias=c.aliases.find(a=>word(text,a));if(alias){
   parsed.cityKey=c.value;parsed.countryCode=c.country;text=remove(text,alias);break}}
 for(const c of countries){const alias=[...c.aliases].sort((a,b)=>b.length-a.length).find(a=>word(text,a));if(alias){
   parsed.countryCode ||= c.value;text=remove(text,alias);break}}
 for(const a of ['不限学历','学历不限','无学历要求','不要求学历','no degree required','degree not required']){
  if(word(text,a)){parsed.education='UNRESTRICTED';text=remove(text,a);break}}
 for(const a of ['远程工作','远程办公','纯远程','远程','fully remote','remote work','remote']){
  if(word(text,a)){parsed.remote=true;text=remove(text,a);break}}
 for(const [phrase,val] of [['无经验要求','0'],['无需经验','0'],['经验不限','0'],['5年以上经验','5+'],['3年以上经验','3-5']]){
  if(word(text,phrase)){parsed.experience=val;text=remove(text,phrase);break}}
 const y=text.match(/(\d{1,2})年(?:工作)?经验/);
 if(y){const n=Number(y[1]);parsed.experience=n===0?'0':n<=3?'1-3':n<=5?'3-5':'5+';text=text.replace(y[0],' ')}
 for(const [a,value] of [['实习','INTERNSHIP'],['internship','INTERNSHIP'],['校招','CAMPUS'],['校园招聘','CAMPUS'],['应届','CAMPUS'],['社招','SOCIAL'],['社会招聘','SOCIAL']]){
  if(word(text,a)){parsed.jobType=value;text=remove(text,a);break}}
 const matches=roles.flatMap(r=>r.aliases.map(a=>({key:r.key,alias:a}))).sort((a,b)=>b.alias.length-a.alias.length);
 for(const a of matches)if(word(text,a.alias)){parsed.roleKeys=[a.key];text=remove(text,a.alias);break}
 for(const skill of [...skills].sort((a,b)=>b.length-a.length))if(word(text,skill)){parsed.skills.push(skill);text=remove(text,skill)}
 text=text.replace(/(?:的|岗位|职位|招聘|工作|帮我|找|看看|全部|相关|不限|jobs?|positions?|please|find|in|the|for)/gi,' ').replace(/[\s,，。;；]+/g,' ').trim();
 parsed.terms=text?text.split(' ').filter(Boolean).slice(0,4):[];
 return parsed;
}
export function searchJobs(jobs,filters={},facets=new Map()){
 const parsed=parseNaturalQuery(filters.q||'');
 const countryCode=filters.location_country||parsed.countryCode||'';
 const city=norm(filters.city)||parsed.cityKey||'';
 const remote=!!filters.remote||parsed.remote;
 const education=filters.education||parsed.education||'';
 const experience=filters.experience||parsed.experience||'';
 const type=filters.recruitment_type||parsed.jobType||'';
 const company=norm(filters.company);
 const found=[];
 for(let i=0;i<jobs.length;i++){
  const job=jobs[i],f=facets.get(job.id)||{},place=f.countryCode?f:locationFacts(job.location,job.domestic);
  if(filters.country==='cn'&&!job.domestic||filters.country==='global'&&job.domestic)continue;
  if(countryCode&&place.countryCode!==countryCode)continue;
  if(parsed.graduationYear&&job.graduationYear!==parsed.graduationYear)continue;
  const cityMeta=city?cities.find(x=>x.value===city):null;
  if(city&&place.cityKey!==city&&!word(norm(job.location),city)&&
     !(cityMeta&&cityMeta.aliases.some(a=>word(norm(job.location),a))))continue;
  if(remote&&job.remote!==true)continue;
  if(company&&![job.company,job.companyZh].some(t=>norm(t).includes(company)))continue;
  const actualType=f.jobType||classifyJobType(job.title,job.recruitmentType).jobType;
  if(type&&type!==actualType&&!(type==='REGULAR'&&actualType==='SOCIAL'))continue;
  if(education){
   const known=f.education||null;
   if(education==='UNRESTRICTED_OR_UNREPORTED'){
    if(known!==null&&known!=='UNRESTRICTED')continue;
   }else if(known!==education)continue;
  }
  const years=Number.isFinite(f.experienceMinYears)?f.experienceMinYears:null;
  if(experience){
   if(experience==='unreported'){if(years!==null)continue}
   else if(years===null)continue;
   else if(experience==='0'&&years!==0)continue;
   else if(experience==='1-3'&&(years<1||years>3))continue;
   else if(experience==='3-5'&&(years<3||years>5))continue;
   else if(experience==='5+'&&years<5)continue;
  }
  const title=norm(job.title)+' '+norm(job.titleZh);
  const fields=title+' '+norm(job.company)+' '+norm(job.companyZh)+' '+norm(job.location)+' '+norm(job.locationZh);
  let score=0,ok=true;
  for(const key of parsed.roleKeys){
   const role=roles.find(r=>r.key===key);
   if(!role||![...role.english,...role.aliases].some(alias=>word(title,alias))){ok=false;break}
   score+=20;
  }
  if(!ok)continue;
  for(const skill of parsed.skills){
   if(word(title,skill))score+=12;
   else if((f.skills||[]).includes(skill))score+=6;
   else {ok=false;break}
  }
  if(!ok)continue;
  for(const term of parsed.terms){
   if(!word(fields,term)){ok=false;break}
   score+=word(title,term)?10:2;
  }
  if(!ok)continue;
  found.push({job,score,index:i});
 }
 found.sort((a,b)=>b.score-a.score||a.index-b.index);
 return {rows:found.map(x=>x.job),interpreted:{...parsed,countryCode,cityKey:city||null,remote,
  education:education||null,experience:experience||null,jobType:type||null,
  graduationYear:parsed.graduationYear||null},counted:found.length};
}
export const countryOptions=countries.map(c=>({value:c.value,zh:c.zh,en:c.en[0]}));
export const cityOptions=cities.map(c=>({value:c.value,zh:c.zh,en:c.value,country:c.country}));
