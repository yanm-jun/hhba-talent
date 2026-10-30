import { loadCuratedOverseasJobs, loadOfficialPublicSnapshot, officialStatus, safeOfficialJobUrl, localizedTitle,
  type LiveFilters, type LiveJob, type Language } from './liveRecruitment';
import { loadPublicJobAudit } from './jobSyncStatus';

type Curated={
  id:string;company:'OpenAI'|'Anthropic'|'SpaceX';source:string;
  title:string;zh:string;location:string;zhLocation:string;
};
// Six real official ATS positions, audited and loaded dynamically from the
// Railway-native job index. Titles/links in these entries are validation
// expectations ONLY; the rendered cards use live employer metadata.
export const CURATED_JOBS:readonly Curated[]=[
 {id:'ashby-openai-18e64608-5881-4b8f-b5cf-abd09a8ff086',company:'OpenAI',
  source:'openai',title:'APAC Vendor Lead, Ads - Singapore',
  zh:'亚太区广告供应商负责人（新加坡）',location:'Singapore',zhLocation:'新加坡'},
 {id:'ashby-openai-7ba0b390-b198-4101-80bb-b49a6dd62607',company:'OpenAI',
  source:'openai',title:'Engineering Manager, Identity Platform',
  zh:'身份平台工程经理',location:'San Francisco',zhLocation:'美国 · 旧金山'},
 {id:'greenhouse-anthropic-5426627008',company:'Anthropic',source:'anthropic',
  title:'APAC GTM Enablement Lead',zh:'亚太区市场拓展赋能负责人',
  location:'Sydney, Australia',zhLocation:'澳大利亚 · 悉尼'},
 {id:'greenhouse-anthropic-5391293008',company:'Anthropic',source:'anthropic',
  title:'Enterprise Account Executive, Automotive',zh:'汽车行业企业客户经理',
  location:'Paris, France',zhLocation:'法国 · 巴黎'},
 {id:'greenhouse-spacex-8885762002',company:'SpaceX',source:'spacex',
  title:'Manager, Software Engineering, Finance (Application Software)',
  zh:'财务应用软件工程经理',location:'Hawthorne, CA',zhLocation:'美国 · 加州霍桑'},
 {id:'greenhouse-spacex-8621995002',company:'SpaceX',source:'spacex',
  title:'RF Engineer (Starlink)',zh:'射频工程师（星链）',
  location:'Bastrop, TX',zhLocation:'美国 · 得克萨斯州巴斯特罗普'}
];
const empty:LiveFilters={q:'',company:'',country:'',remote:false,recruitment_type:'',
  location_country:'',city:'',education:'',experience:''};

export function isDefaultMarketFilters(filters:LiveFilters,page:number){
  return page===0 && !filters.q.trim() && !filters.company.trim() &&
    !filters.country && !filters.location_country && !filters.city &&
    !filters.recruitment_type && !filters.education && !filters.experience && !filters.remote;
}
function exactJobMatch(job:LiveJob,entry:Curated){
  return job.id===entry.id && job.company===entry.company &&
    job.source===entry.source && job.title===entry.title &&
    job.location===entry.location &&
    !!safeOfficialJobUrl(job);
}
export function featuredTitle(job:LiveJob,lang:Language){
  const entry=CURATED_JOBS.find(x=>exactJobMatch(job,x));
  return lang==='zh'&&entry?entry.zh:localizedTitle(job,lang);
}
export function featuredLocation(job:LiveJob,lang:Language){
  const entry=CURATED_JOBS.find(x=>exactJobMatch(job,x));
  return lang==='zh'&&entry?entry.zhLocation:null;
}
export async function loadVerifiedFeaturedJobs(signal:AbortSignal):Promise<LiveJob[]>{
 // The static overseas-only catalogue was already completed on Oct 24.
 // Feature six of these records; never mix the old live ATS six with the 100.
 if(import.meta.env.VITE_HHBA_OVERSEAS_CURATED_100==='1'&&
    (import.meta.env.BASE_URL==='/hhba-talent/'||import.meta.env.VITE_HHBA_VERIFIED_SNAPSHOT==='1')){
   const archived=await loadCuratedOverseasJobs(signal);
   const selected=['OpenAI','Anthropic','SpaceX'].flatMap(company=>
     archived.filter(job=>job.company===company).slice(0,2));
   if(selected.length!==6||selected.some(job=>job.recordKind!=='CURATED_HISTORICAL'))
     throw new Error('静态精选岗位不足');
   return selected;
 }

 // Both callers (home and /candidate/jobs) reuse ONE cached full snapshot.
 // This avoids three full 15k-job searches and repeated index parsing.
 const [snapshot,audit]=await Promise.all([
   loadOfficialPublicSnapshot(signal),
   loadPublicJobAudit()
 ]);
 if(signal.aborted)throw new Error('已取消精选岗位校验');
 if(!audit||audit.summary.indexed_as_of!==snapshot.updated||
    snapshot.failures!==0)throw new Error('企业岗位审核版本尚未同步');
 const approved=new Set(audit.jobs.filter(a=>a.status==='OFFICIAL_JD_AND_REQUIREMENTS_FOUND' &&
   a.full_original_jd_verified===true && a.requirements_evidence===true)
   .map(a=>a.job_id));
 const byId=new Map(snapshot.jobs.map(j=>[j.id,j]));
 const found:LiveJob[]=[];
 for(const entry of CURATED_JOBS){
  const job=byId.get(entry.id);
  if(!job||!exactJobMatch(job,entry)||!approved.has(job.id)||
    officialStatus(job,snapshot.updated)!=='recent'){
   throw new Error('精选岗位 '+entry.company+' 尚未通过最新完整 JD 核验');
  }
  found.push(job);
 }
 if(new Set(found.map(x=>x.id)).size!==6)throw new Error('精选岗位来源存在重复');
 return found;
}
