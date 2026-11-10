import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,Bookmark,MapPin,RefreshCw,Sparkles,ShieldCheck} from 'lucide-react';
import {Link} from '../router';
import {getCandidateWorkspaceProfile,realWorkspaceAvailable,type CandidateWorkspaceProfile} from '../services/candidateWorkspace';
import {getRealAuthToken} from '../services/realAuth';
import {listSavedJobs,savedAvailable} from '../services/savedJobs';
import {listJobs,getJob,safeOfficialJobUrl,officialStatus,type LiveFilters,type LiveJob} from '../services/liveRecruitment';
import {rankHomeJobs,HOME_RECOMMENDATION_VERSION,type RecommendationStage} from '../services/homeRecommendations';
import {SaveJobButton} from './SaveJobButton';
import {getSavedMajor,majorName} from '../services/majorJobMatching';
import type {User} from '../services/api';
import '../styles/home-recommended-jobs.css';

const mainland:LiveFilters={q:'',company:'',country:'cn',remote:false,recruitment_type:'',
 location_country:'',city:'',education:'',experience:'',major_slug:'',include_unknown_majors:false};
type ConsentState='inactive'|'enabled'|'unavailable'|'guest';
type Collaborative={kind:string;mode:string;jobs:Array<{id:string;score:number}>};
async function privateFetch(path:string,method='GET'){
 const token=getRealAuthToken();if(!token)throw Error('NO_SESSION');
 const res=await fetch('/api/recommendations/'+path,{
   method,credentials:'same-origin',cache:'no-store',
   headers:{Authorization:'Bearer '+token,...(method==='PUT'?{'Content-Type':'application/json'}:{})},
   ...(method==='PUT'?{body:JSON.stringify({enabled:true})}:{})
 });
 if(!res.ok)throw Error('RECOMMENDATION_UNAVAILABLE');
 return res.json();
}
// Co-save suggestions may lie outside the first catalogue pages.
async function hydrateSimilarJobs(rows:Array<{id:string;score:number}>,signal:AbortSignal){
 const found:LiveJob[]=[];
 for(let i=0;i<Math.min(8,rows.length);i+=4){
  const batch=await Promise.allSettled(rows.slice(i,i+4).map(row=>getJob(row.id,signal)));
  if(signal.aborted)break;
  for(const result of batch){
   if(result.status==='fulfilled'&&result.value.job.domestic&&safeOfficialJobUrl(result.value.job))
    found.push(result.value.job);
  }
 }
 return found;
}
export function HomeRecommendedJobs({user}:{user:User|null}){
 const signedIn=Boolean(user?.account_types?.includes('candidate'))&&realWorkspaceAvailable;
 const [jobs,setJobs]=useState<LiveJob[]>([]);
 const [updated,setUpdated]=useState('');
 const [profile,setProfile]=useState<CandidateWorkspaceProfile|null>(null);
 const [saved,setSaved]=useState<Set<string>>(new Set());
 const [collab,setCollab]=useState<Map<string,number>>(new Map());
 const [consent,setConsent]=useState<ConsentState>('guest');
 const [stage,setStage]=useState<RecommendationStage>('all');
 const [major,setMajor]=useState(getSavedMajor);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');
 const [version,setVersion]=useState(0);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  const syncMajor=()=>setMajor(getSavedMajor());
  window.addEventListener('hhba-major-changed',syncMajor);
  return()=>window.removeEventListener('hhba-major-changed',syncMajor);
 },[]);
 useEffect(()=>{
  const onSave=()=>setVersion(v=>v+1);
  window.addEventListener('hhba:saved-changed',onSave);
  window.addEventListener('hhba:real-auth-changed',onSave);
  return()=>{window.removeEventListener('hhba:saved-changed',onSave);window.removeEventListener('hhba:real-auth-changed',onSave);};
 },[]);
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  setLoading(true);setMessage('');setCollab(new Map());setProfile(null);setConsent(signedIn?'unavailable':'guest');
  async function load(){
   const personal= signedIn
     ?getCandidateWorkspaceProfile().catch(()=>null)
     :Promise.resolve(null);
   const bookmarks= signedIn&&savedAvailable
     ?listSavedJobs().catch(()=>[])
     :Promise.resolve([]);
   const baseline=await Promise.allSettled([
     listJobs(mainland,0,controller.signal),
     listJobs(mainland,30,controller.signal)
   ]);
   if(controller.signal.aborted||!active)return;
   const pages=baseline.filter((r):r is PromiseFulfilledResult<Awaited<ReturnType<typeof listJobs>>=>r.status==='fulfilled').map(r=>r.value);
   const data=pages.flatMap(p=>p.jobs).filter(j=>j.domestic&&!!safeOfficialJobUrl(j));
   const p=await personal,items=await bookmarks;
   if(controller.signal.aborted||!active)return;
   setProfile(p);setSaved(new Set(items.map(item=>item.jobId)));
   const extra=p?.preferred_role?.trim();
   if(extra){
    try{
     const relevant=await listJobs({...mainland,q:extra.slice(0,70)},0,controller.signal);
     if(active&&!controller.signal.aborted)data.push(...relevant.jobs.filter(j=>j.domestic&&!!safeOfficialJobUrl(j)));
    }catch{/* Keep the verified unfiltered fallback. */}
   }
   if(controller.signal.aborted||!active)return;
   setJobs(data);setUpdated(pages[0]?.updated||'');
   if(!pages.length)setMessage('岗位索引暂不可用，无法生成真实推荐。');
   else if(!data.length)setMessage('暂无可核验的国内岗位推荐，请前往完整岗位库。');
   if(signedIn){
    try{
     const c=await privateFetch('consent') as {enabled:boolean};
     if(!active||controller.signal.aborted)return;
     setConsent(c.enabled?'enabled':'inactive');
     if(c.enabled){
      const similar=await privateFetch('similar') as Collaborative;
      if(active&&!controller.signal.aborted&&similar.kind==='HHBA_HOME_COLLABORATIVE_V1'){
       setCollab(new Map(similar.jobs.map(j=>[j.id,j.score])));
       const extraJobs=await hydrateSimilarJobs(similar.jobs,controller.signal);
       if(active&&!controller.signal.aborted)setJobs(existing=>[...existing,...extraJobs]);
      }
     }
    }catch{if(active&&!controller.signal.aborted)setConsent('unavailable');}
   }
   if(active&&!controller.signal.aborted)setLoading(false);
  }
  void load().catch(()=>{if(active&&!controller.signal.aborted){setMessage('推荐暂不可用，可继续浏览完整岗位库。');setLoading(false)}});
  return()=>{active=false;controller.abort();};
 },[signedIn,user?.id,version]);
 const candidates=useMemo(()=>jobs.filter(j=>{
  if(!j.domestic||!safeOfficialJobUrl(j))return false;
  // Display historically verified records only with a clear availability warning.
  return officialStatus(j,updated)!=='invalid';
 }),[jobs,updated]);
 const recommendations=useMemo(()=>rankHomeJobs(candidates,profile,saved,collab,stage,8,major),
  [candidates,profile,saved,collab,stage,major]);
 const personalized=!!major||!!profile&&(!!profile.preferred_role||!!profile.skills||!!profile.preferred_city);
 async function changeConsent(){
  if(busy||!signedIn)return;
  setBusy(true);
  try{
   const enable=consent==='inactive';
   await privateFetch('consent',enable?'PUT':'DELETE');
   setConsent(enable?'enabled':'inactive');setCollab(new Map());
   if(enable){
    const similar=await privateFetch('similar') as Collaborative;
    if(similar.kind==='HHBA_HOME_COLLABORATIVE_V1'){
     setCollab(new Map(similar.jobs.map(j=>[j.id,j.score])));
     const extra=await hydrateSimilarJobs(similar.jobs,new AbortController().signal);
     setJobs(existing=>[...existing,...extra]);
    }
   }
  }catch{setMessage('授权状态更新失败，请稍后重试。');}
  finally{setBusy(false);}
 }
 return <section className="hhba-recommend" aria-labelledby="hhba-recommend-title">
  <div className="hhba-recommend-heading"><div>
   <span className="hhba-recommend-eyebrow"><Sparkles size={15}/> HHBA · {HOME_RECOMMENDATION_VERSION}</span>
   <h2 id="hhba-recommend-title">{personalized?'为你精选的职业机会':'发现适合你的职业机会'}</h2>
   <p>{personalized?'根据'+(major?'「'+majorName(major)+'」专业、':'')+'你的求职偏好与可核验的国内岗位排序。':'选择求职阶段；登录并填写求职偏好后，首页将呈现更贴近你的岗位。'}</p>
  </div><Link to="/candidate/jobs">完整岗位库 <ArrowRight size={16}/></Link></div>
  <div className="hhba-recommend-tabs" role="group" aria-label="按求职阶段浏览">
   {([['all','为你推荐'],['INTERNSHIP','实习'],['CAMPUS','校园招聘'],['SOCIAL','社会招聘']] as [RecommendationStage,string][]).map(([key,label])=>
    <button type="button" key={key} aria-pressed={stage===key} className={stage===key?'active':''} onClick={()=>setStage(key)}>{label}</button>)}
  </div>
  {loading?<p className="hhba-recommend-note" role="status">正在读取已核验的国内岗位…</p>:
   <div className="hhba-recommend-grid">
    {recommendations.map(({job,reasons,collaborative})=><article className="hhba-recommend-card" key={job.id}>
     <div className="hhba-recommend-card-top"><span>{job.companyZh||job.company}</span><span>{collaborative?'相似兴趣推荐':'智能排序'}</span></div>
     <h3><Link to={'/candidate/jobs/'+encodeURIComponent(job.id)}>{job.titleZh||job.title}</Link></h3>
     <div className="hhba-recommend-meta"><span><MapPin size={13}/>{job.locationZh||job.location||'工作城市待核实'}</span>
      <span>{job.recruitmentType==='INTERNSHIP'?'实习':job.recruitmentType==='CAMPUS'?'校招':job.recruitmentType==='SOCIAL'?'社招':'岗位机会'}</span></div>
     <p className="hhba-recommend-reason"><Sparkles size={14}/>{reasons.join(' · ')}</p>
     <p className="hhba-recommend-source"><ShieldCheck size={13}/>
      {job.currentApplicationVerified?'官方申请入口已核验':'来自官方招聘来源 · 当前可投递状态需核实'}</p>
     <div className="hhba-recommend-actions"><SaveJobButton jobId={job.id} compact/>
      <Link to={'/candidate/jobs/'+encodeURIComponent(job.id)}>查看岗位 <ArrowRight size={14}/></Link></div>
    </article>)}
   </div>}
  {!loading&&recommendations.length===0&&<p className="hhba-recommend-note" role="status">{message||'这一类别暂时没有通过来源核验的岗位，可切换类别或进入完整岗位库。'}</p>}
  {message&&recommendations.length>0&&<p className="hhba-recommend-note" role="status">{message}</p>}
  {signedIn?<div className="hhba-recommend-consent">
   <div><strong><Bookmark size={14}/> 协同过滤推荐</strong><p>{consent==='enabled'?'已授权使用你的收藏行为参与相似兴趣推荐，可随时关闭。':consent==='inactive'?'默认关闭。开启后允许系统使用你的岗位收藏，在不少于 3 位相似用户的聚合结果中发现新机会。': '协同推荐数据库尚未就绪；目前仍可使用基础个性化。'}</p></div>
   {consent!=='unavailable'&&<button type="button" disabled={busy} onClick={()=>void changeConsent()}>{busy?'处理中…':consent==='enabled'?'关闭授权':'开启协同推荐'}</button>}
  </div>:<p className="hhba-recommend-note"><Link to="/candidate/login?next=%2F">登录后使用个人偏好与收藏推荐</Link> · 也可以先浏览公开岗位。</p>}
  <p className="hhba-recommend-disclaimer">推荐分值仅用于排序，不代表录用概率。投递前请核对学历、工作经验、招聘时效与官方申请入口；不因年龄直接排除岗位。</p>
 </section>;
}
