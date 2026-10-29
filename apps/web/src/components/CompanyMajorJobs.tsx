import {useEffect,useState} from 'react';
import {ArrowRight,BriefcaseBusiness,CheckCircle2,GraduationCap} from 'lucide-react';
import {Link,getCompanyReturnTarget} from '../router';
import {MajorFilter} from './MajorFilter';
import {domesticV2Records} from '../services/domesticRebuildJobs';
import {majorName,matchRoleToMajor,majorMatchLabel,getSavedMajor,storeSelectedMajor} from '../services/majorJobMatching';
import {safeOfficialJobUrl,rebuildListFilter} from '../services/liveRecruitment';
import type {LiveJob} from '../services/liveRecruitment';
import '../styles/unified-jobs.css';
import '../styles/major-company-flow.css';

export function useSharedMajorSelection(){
 const [slug,setSlug]=useState(getSavedMajor);
 useEffect(()=>{
  const listener=(ev:Event)=>{
   const next=(ev as CustomEvent<string>).detail;
   setSlug(next||'');
  };
  window.addEventListener('hhba-major-changed',listener);
  return()=>window.removeEventListener('hhba-major-changed',listener);
 },[]);
 function choose(next:string){
  storeSelectedMajor(next);
  setSlug(next);
 }
 return {slug,choose};
}
type View='matched'|'all'|'unknown'|'included';
function roleView(job:LiveJob,slug:string,view:View){
 if(view==='all'||!slug)return true;
 const result=matchRoleToMajor(job,slug);
 return view==='unknown'?result==='unknown':view==='included'?result==='unknown'||result==='related'||result==='unrestricted':result==='related'||result==='unrestricted';
}
/** Same job IDs, titles, and matching predicate as /candidate/jobs. No separate employer-specific role cache. */
export function CompanyMajorJobs({companyRoute}:{companyRoute:string}){
 const {slug,choose}=useSharedMajorSelection();
 const [view,setView]=useState<View>(()=>new URLSearchParams(location.search).get('unknown')==='1'?'included':'matched');
 const allJobs:LiveJob[]=domesticV2Records.filter(j=>j.employerRoute===companyRoute&&!!safeOfficialJobUrl(j));
 const incoming=getCompanyReturnTarget().marketState?.filters;
 // Carry ALL filters along the market -> employer jump. These are stored by the router
 // and are ignored for a direct employer deep link without a market origin.
 const inherited=incoming&&typeof incoming.major_slug==='string'&&incoming.major_slug===slug
   ?incoming as unknown as import('../services/liveRecruitment').LiveFilters:null;
 const jobs=inherited?allJobs.filter(j=>rebuildListFilter(j,{...inherited,major_slug:''})):allJobs;
 const related=jobs.filter(j=>roleView(j,slug,'matched'));
 const unknown=slug?jobs.filter(j=>roleView(j,slug,'unknown')):[];
 const current=!slug||view==='all'?allJobs:view==='unknown'?unknown:view==='included'?jobs.filter(j=>roleView(j,slug,'included')):related;
 const select=(next:string)=>{choose(next);setView('matched')};
 const label=majorName(slug);
 return <>
  <section className="hhba-kpmg-section hhba-major-linked-section" aria-labelledby="hhba-shared-major-title">
   <div className="hhba-kpmg-section-heading"><div>
    <h2 id="hhba-shared-major-title">适合哪些专业背景？</h2>
    <p>与招聘市场共用一套专业匹配结果。专业相关不等于符合所有招录条件，未披露专业的岗位单独列出。</p>
   </div></div>
   <div className="hhba-major-linked-controls">
    <MajorFilter value={slug} onChange={select} lang="zh"/>
    {slug&&<button type="button" className="hhba-kpmg-major is-selected" onClick={()=>select('')}>清除专业 <CheckCircle2 size={13}/></button>}
   </div>
   {slug&&<p className="hhba-major-context-label"><GraduationCap size={15}/> 已继承所学专业：<strong>{label}</strong> · 进入其他企业或返回市场时保留</p>}
  </section>
  <section className="hhba-kpmg-section hhba-major-linked-jobs" aria-labelledby="hhba-shared-roles-title">
   <div className="hhba-kpmg-section-heading"><div>
    <h2 id="hhba-shared-roles-title">招聘岗位</h2>
    <p>{!slug?`已收录 ${allJobs.length} 条岗位资料`:`当前专业：${label} · ${related.length} 条相关/不限专业 · ${unknown.length} 条专业未披露`}。是否仍在招聘、学历和专业硬性要求请以官网为准。</p>
   </div></div>
   <div className="hhba-major-view-tabs" role="group" aria-label="岗位筛选方式">
    {slug&&<button type="button" aria-pressed={view==='matched'} className={view==='matched'?'is-selected':''} onClick={()=>setView('matched')}>相关岗位（{related.length}）</button>}
    <button type="button" aria-pressed={!slug||view==='all'} className={!slug||view==='all'?'is-selected':''} onClick={()=>setView('all')}>查看全部岗位（{allJobs.length}）</button>
    {slug&&unknown.length>0&&<button type="button" aria-pressed={view==='included'} className={view==='included'?'is-selected':''} onClick={()=>setView('included')}>包含待核验（{related.length+unknown.length}）</button>}
    {slug&&unknown.length>0&&<button type="button" aria-pressed={view==='unknown'} className={view==='unknown'?'is-selected':''} onClick={()=>setView('unknown')}>专业待核验（{unknown.length}）</button>}
   </div>
   <div className="hhba-kpmg-role-list" aria-live="polite">
    {current.map(job=><article className="hhba-kpmg-role" key={job.id}>
     <div className="hhba-kpmg-role-icon"><BriefcaseBusiness size={17}/></div>
     <div className="hhba-kpmg-role-main">
      <div className="hhba-kpmg-role-top"><h3>{job.titleZh||job.title}</h3><span>{job.positionOrg||job.companyZh||job.company}</span></div>
      <p>{job.locationZh||job.location||'工作地点待核实'} · {job.responsibilitiesSummary||'岗位职责请查看站内资料'}</p>
      <small>{slug?majorMatchLabel(matchRoleToMajor(job,slug))+' · ':''}申请状态待官网核对；{job.majorNames?.length?'已整理专业信息：'+job.majorNames.slice(0,4).join('、'):'逐岗专业要求尚未明确'}</small>
     </div>
     <Link to={'/candidate/jobs/'+encodeURIComponent(job.id)} aria-label={'查看'+job.title+'站内岗位详情'}>查看详情 <ArrowRight size={14}/></Link>
    </article>)}
    {!current.length&&<p className="hhba-kpmg-role-disclaimer">
     当前未收录与「{label}」有明确关联的岗位；可以点击“查看全部岗位”，自行查看其他专业或待核验的机会。并不代表企业不招聘该专业。
    </p>}
   </div>
   <p className="hhba-kpmg-role-disclaimer"><GraduationCap size={14}/> 专业关联是辅助导航，不代表正式录取资格。部分条目为历史公开岗位或校招方向，并非实时在招；点击“查看详情”仍进入 HHBA 站内页面，官方入口保留登录拦截。</p>
  </section>
 </>;
}
