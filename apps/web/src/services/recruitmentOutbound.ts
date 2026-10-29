// One recruitment-outbound policy for every HHBA route and every employer.
// Non-recruitment sources, photos, normal internal browsing are deliberately excluded.
const KEY='hhba.recruitment.pending.v1';
const EXPLICIT=/官方招聘|招聘官网|招聘网站|招聘系统|招聘频道|招聘公告|招聘线索|官方岗位|官方原始岗位|官方职位|企业官网核对|岗位投递|企业投递|前往投递|官方投递页|前往官方招聘|官网核实完整职位|打开 ATS|完整 JD|去官方投递|投递状态|查看要求|Apply on official|Apply now|Employer careers site|Original employer listing|original job|official job|official application|careers site|job posting|openings|apply to/i;
// Job-source evidence is part of the recruitment funnel: unlike image credits or company citations,
// opening a school career posting / recruitment-channel proof must require HHBA login.
const RECRUITMENT_EVIDENCE=/高校(?:平台|就业|招聘).*?(?:职位|岗位|招聘)(?:公告|链接|详情)?|(?:原始|原文|高校)(?:职位|岗位)(?:公告|页面)|招聘(?:入口|渠道|职位|岗位)(?:的)?(?:核验依据|来源|公告)|(?:招聘|岗位|职位)(?:公告|链接|证明)|university (?:job|career) (?:posting|notice|source)|recruitment (?:evidence|source)/i;
const SOURCES=/核验依据|资料来源|图片来源|照片来源|岗位来源说明|图片授权|品牌图来源|企业公开资料|人物身份来源|地址来源|官网图标来源|source citation|photo credit|image license/i;
const PATH=/\/(?:careers?|jobs?|openings|apply|applications|positions|recruit|zhaopin|campus|social)(?:\/|[?#]|$)/i;
export type PendingOfficialRecruitment={url:string;title:string;origin:string;at:number};
function safeHttps(url:string):string|null{
 try{const u=new URL(url);
 // A previously approved Huaan Securities ATS uses TLS on port 8083.
 // Never allow other arbitrary custom ports or a changed ATS destination.
 const approvedHuaanPort=u.hostname==='hahr.hazq.com'&&u.port==='8083'&&
   u.pathname==='/eip4ha-hyapp/recruitment'&&!u.search&&!u.hash;
 return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||approvedHuaanPort)&&
   !['localhost','127.0.0.1','0.0.0.0'].includes(u.hostname)&&url.length<=1800?u.href:null}
 catch{return null}
}
export function recruitmentTarget(anchor:HTMLAnchorElement):string|null{
 if(anchor.dataset.hhbaNonRecruitmentLink==='true')return null;
 if(anchor.target!=='_blank'&&anchor.dataset.hhbaRecruitmentOutbound!=='true')return null;
 const url=safeHttps(anchor.href);if(!url)return null;
 const label=[anchor.textContent||'',anchor.getAttribute('aria-label')||'',anchor.title||''].join(' ').trim();
 if(anchor.dataset.hhbaRecruitmentOutbound==='true')return url;
 if(RECRUITMENT_EVIDENCE.test(label))return url;
 if(SOURCES.test(label))return null;
 const path=new URL(url).pathname;
 return EXPLICIT.test(label)||PATH.test(path)?url:null;
}
export function rememberRecruitment(url:string,title:string,origin:string){
 const checked=safeHttps(url);
 if(!checked)return false;
 const pending:PendingOfficialRecruitment={url:checked,title:title.trim().slice(0,120)||'企业官方招聘渠道',
  origin:origin.startsWith('/')&&!origin.startsWith('//')?origin:'/candidate/jobs',at:Date.now()};
 try{sessionStorage.setItem(KEY,JSON.stringify(pending));return true}catch{return false}
}
export function pendingRecruitment():PendingOfficialRecruitment|null{
 try{
  const raw=sessionStorage.getItem(KEY);if(!raw)return null;
  const x=JSON.parse(raw) as PendingOfficialRecruitment;
  if(typeof x.at!=='number'||x.at>Date.now()+60000||Date.now()-x.at>30*60*1000||
     typeof x.title!=='string'||typeof x.origin!=='string'||
     !x.origin.startsWith('/')||x.origin.startsWith('//')||!safeHttps(x.url))return null;
  return x;
 }catch{return null}
}
export function clearPendingRecruitment(){try{sessionStorage.removeItem(KEY)}catch{}}
