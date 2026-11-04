/**
 * HHBA public in-site search catalog.
 * Each existing structured module supplies records here; new entries added to
 * the company/policy/housing/study registries are searchable without per-item edits.
 * No account, resume, admin, unpublished or third-party content is indexed.
 */
import {getDomesticCompanies} from './domesticCompanySearch';
import {employerProfiles} from './employerProfiles';
import {TALENT_POLICY_RECORDS} from '../data/talentPolicyRecords';
import {TALENT_HOUSING_RECORDS} from '../data/talentHousingRecords';
import {TALENT_MUNICIPALITIES,TALENT_LEGACY_CITIES} from '../data/talentCityRegistry';
import {studyCountries,studyDirections,studyCountry} from '../data/studyAbroad';
import {universities,universityPrograms} from '../data/studyUniversities';
import {WINTER_2027_PROGRAMS} from '../data/winter2027Programs';

export type SiteSearchKind='page'|'job'|'company'|'policy'|'housing'|'study';
export type SiteSearchRecord={
 id:string;kind:SiteSearchKind;title:string;description:string;path:string;
 tags:string[];status?:string;rank?:number;
};
export const SITE_SEARCH_TABS:ReadonlyArray<{kind:'all'|SiteSearchKind;label:string}>=[
 {kind:'all',label:'全部'}, {kind:'job',label:'招聘岗位'}, {kind:'company',label:'企业'},
 {kind:'policy',label:'人才政策'}, {kind:'housing',label:'人才安居'},
 {kind:'study',label:'留学机会'}, {kind:'page',label:'站内页面'}
];
const staticPages:SiteSearchRecord[]=[
 {id:'home',kind:'page',title:'HHBA 首页',description:'了解 HHBA 的使命、服务与求职入口',path:'/',tags:['首页','平台','HHBA']},
 {id:'winter-season',kind:'page',title:'2027 寒假实习季',description:'HHBA 寒假实习官方项目、企业和实习申请入口',path:'/winter-internship',tags:['寒假','实习','冬季实习','冬季','2027','企业','招聘']},
 {id:'job-market',kind:'page',title:'招聘市场',description:'搜索岗位、筛选专业、城市与招聘类别',path:'/candidate/jobs',tags:['工作','职位','岗位','校招','社招','实习','招聘']},
 {id:'employers',kind:'page',title:'企业发现',description:'查找 HHBA 已收录的企业档案及招聘渠道',path:'/companies/discover',tags:['公司','企业','行业','招聘']},
 {id:'talent',kind:'page',title:'人才政策与人才服务',description:'全国城市人才政策、人才公寓、住房补贴和申请指南',path:'/talent-service',tags:['政策','人才','落户','住房','申请','指南']},
 {id:'talent-city',kind:'page',title:'全国人才政策城市目录',description:'按地区查询城市人才政策和安居资料',path:'/talent-service/cities',tags:['城市','省份','政策','补贴','安居']},
 {id:'study',kind:'page',title:'留学机会',description:'留学国家、大学、研究生课程与海外发展规划',path:'/study-abroad',tags:['留学','海外','出国','学校','签证','大学']},
 {id:'match',kind:'page',title:'简历智能匹配',description:'在私人简历空间分析岗位匹配度（需用户授权）',path:'/candidate/match',tags:['简历','AI','岗位推荐','匹配']},
 {id:'bookmarks',kind:'page',title:'我的收藏',description:'登录后查看个人收藏的招聘岗位',path:'/candidate/saved',tags:['收藏','求职','个人中心']},
 {id:'join',kind:'page',title:'加入我们',description:'了解 HHBA 团队及加入方式',path:'/join',tags:['团队','加入','合作']},
 {id:'vision',kind:'page',title:'HHBA 理念',description:'让劳动更有尊严，让商业更有温度',path:'/vision',tags:['理念','使命','价值']},
 {id:'employer',kind:'page',title:'企业服务与治理',description:'了解招聘服务、企业责任与治理机制',path:'/employer/start',tags:['企业','雇主','责任','认证','治理']},
 {id:'login',kind:'page',title:'登录与注册',description:'进入 HHBA 求职者或企业账号',path:'/auth',tags:['注册','登录','账户']}
];
let cached:SiteSearchRecord[]|null=null;
const validPath=(path:string)=>path.startsWith('/')&&!path.startsWith('//')&&!/[\\\r\n]/.test(path);
export function buildSiteSearchIndex():SiteSearchRecord[]{
 if(cached)return cached;
 const records:SiteSearchRecord[]=[...staticPages];
 const add=(item:SiteSearchRecord)=>{
  if(!validPath(item.path)||!item.title.trim())return;
  records.push(item);
 };
 // All public employer profiles, including subsequently added approved JSON.
 for(const p of employerProfiles)add({
  id:'employer:'+p.id,kind:'company',title:p.name,
  description:[p.industry,p.subtitle,p.overview].filter(Boolean).join(' · ').slice(0,420),
  tags:[p.englishName,...p.aliases,...p.preferredMajors,p.industry],path:'/companies/autumn/'+p.id,
  status:'企业档案 · 在招状态以官方公告为准'
 });
 for(const c of getDomesticCompanies())add({
  id:'company:'+c.id,kind:'company',title:c.name,description:[c.industry,c.city,c.overview].filter(Boolean).join(' · ').slice(0,350),
  tags:[c.legalName||'',...(c.aliases||[]),...c.tags,c.stockCode||''],path:c.route,
  status:c.status==='listed_identity_only'?'企业名录 · 业务信息待核验':'企业档案 · 招聘状态待核验'
 });
 // Link directly to the site's own existing, canonical detail routes.
 for(const p of TALENT_POLICY_RECORDS)add({
  id:'policy:'+p.id,kind:'policy',title:p.title,description:[p.city,p.district,p.summary,p.benefit].filter(Boolean).join(' · ').slice(0,430),
  tags:[p.city,p.district||'',p.category,p.eligibility,...p.keywords],
  path:'/talent-service/policy/'+encodeURIComponent(p.id),
  status:p.temporal==='historical'?'历史政策 · 现行资格需核实':'政策资料 · 时效以主管部门为准'
 });
 for(const h of TALENT_HOUSING_RECORDS)add({
  id:'housing:'+h.id,kind:'housing',title:h.title,
  description:[h.city,h.district,h.address,h.statusNote].filter(Boolean).join(' · ').slice(0,430),
  tags:[h.city,h.district,h.rent,h.eligibility,h.housingCategory||'住房'],
  path:'/talent-service/housing/'+encodeURIComponent(h.id),
  status:'住房资料 · 不代表当前有空余房源'
 });
 for(const city of [...TALENT_MUNICIPALITIES,...TALENT_LEGACY_CITIES])add({
  id:'city:'+city.name,kind:'policy',title:city.name+'人才服务',
  description:city.intro,tags:[city.official,city.province,...city.aliases,city.pinyin||''],
  path:'/talent-service/city/'+encodeURIComponent(city.name),
  status:'城市政策与办理指南'
 });
 for(const c of studyCountries)add({
  id:'country:'+c.code,kind:'study',title:c.name+'留学机会',
  description:'探索'+c.name+'大学、升学方向与官方留学资料',tags:[c.english,c.name,'出国','签证','留学'],
  path:'/study-abroad',status:'留学资讯 · 资格以官方为准'
 });
 for(const d of studyDirections)add({
  id:'direction:'+d.id,kind:'study',title:d.title,description:d.summary,
  tags:[studyCountry(d.country).name,...d.keywords,...d.highlights],
  path:'/study-abroad/'+encodeURIComponent(d.id),status:'升学研究方向'
 });
 for(const u of universities)add({
  id:'university:'+u.id,kind:'study',title:u.chinese,
  description:u.english+' · '+u.city+' · '+u.introduction,
  tags:[u.english,...u.aliases,studyCountry(u.country).name],path:'/study-abroad/university/'+encodeURIComponent(u.id),
  status:'大学资料 · 录取条件以学校官网为准'
 });
 for(const p of universityPrograms){
  const u=universities.find(v=>v.id===p.universityId);
  if(!u)continue;
  add({id:'program:'+p.id,kind:'study',title:p.chinese,
   description:u.chinese+' · '+p.description,tags:[p.english,u.english,u.chinese,studyCountry(u.country).name,...p.keywords],
   path:'/study-abroad/program/'+encodeURIComponent(p.id),status:'院校课程 · 招生状态需核实'});
 }
 // Every officially reviewed winter internship entry is navigable inside HHBA.
 for(const p of WINTER_2027_PROGRAMS)add({
  id:'winter:'+p.id,kind:'job',title:p.company+' · '+p.title,
  description:[p.intro,p.location,p.period].join(' · ').slice(0,430),
  tags:[p.english,p.company,p.category,p.region,p.location,'寒假','实习','冬季实习',...p.tags],
  path:'/winter-internship/'+encodeURIComponent(p.id),
  status:p.statusNote
 });
 const unique=new Map<string,SiteSearchRecord>();
 for(const r of records)unique.set(r.kind+':'+r.path,r);
 cached=[...unique.values()];
 return cached;
}
const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().replace(/[\u3000\s]+/g,' ').trim();
export function siteSearchTerms(query:string):string[]{
 const raw=normalize(query).slice(0,100);
 if(!raw)return [];
 const parts=raw.split(/\s+/).filter(Boolean);
 if(parts.length>1)return parts;
 // Chinese queries commonly omit spaces: 济南硕士人才公寓 / 日本大学院.
 // Split known place names and strong topic words, but keep the original term
 // when segmentation cannot find any useful component.
 let pending=raw;
 const vocab=['人才公寓','生活补贴','购房补贴','住房补贴','人才政策','人才安居','岗位','实习','招聘',
  '留学','公司','企业','大学','硕士','博士','本科','机械','电子','计算机','自动化','租房','申请','出国',
  ...new Set([...TALENT_MUNICIPALITIES,...TALENT_LEGACY_CITIES].map(c=>c.name))];
 const tokens:string[]=[];
 for(const word of vocab.sort((a,b)=>b.length-a.length)){
  if(pending.includes(word)){tokens.push(word);pending=pending.replace(word,' ');}
 }
 tokens.push(...pending.split(/\s+/).filter(Boolean));
 return tokens.length>1?tokens:[raw];
}
export function searchSiteRecords(records:SiteSearchRecord[],query:string,kind:'all'|SiteSearchKind='all'){
 const terms=siteSearchTerms(query);
 if(!terms.length)return [];
 return records.filter(r=>kind==='all'||r.kind===kind).flatMap(r=>{
  const title=normalize(r.title),desc=normalize(r.description),tags=normalize(r.tags.join(' '));
  if(!terms.every(t=>title.includes(t)||desc.includes(t)||tags.includes(t)))return [];
  const exact=normalize(query)===title;
  const score=(exact?100:0)+terms.reduce((n,t)=>n+
   (title===t?38:title.startsWith(t)?24:title.includes(t)?16:tags.includes(t)?7:2),0)+
   (r.kind==='company'&&r.status?.includes('名录')?-3:0);
  return [{...r,rank:score}];
 }).sort((a,b)=>(b.rank||0)-(a.rank||0)||a.title.localeCompare(b.title,'zh-CN'));
}
