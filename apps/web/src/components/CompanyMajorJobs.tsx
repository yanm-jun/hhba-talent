import {useEffect,useState} from 'react';
import {ArrowRight,BriefcaseBusiness,GraduationCap} from 'lucide-react';
import {Link,getCompanyReturnTarget} from '../router';
import {CompanyMajorChips} from './CompanyMajorChips';
import {domesticV2Records} from '../services/domesticRebuildJobs';
import {majorName,matchRoleToMajor,majorMatchLabel,getSavedMajor,storeSelectedMajor} from '../services/majorJobMatching';
import {safeOfficialJobUrl,rebuildListFilter} from '../services/liveRecruitment';
import type {LiveJob,LiveFilters} from '../services/liveRecruitment';
import '../styles/major-company-flow.css';

export function useSharedMajorSelection(){
 const [slug,setSlug]=useState(getSavedMajor);
 useEffect(()=>{
  const listener=(ev:Event)=>setSlug((ev as CustomEvent<string>).detail||'');
  window.addEventListener('hhba-major-changed',listener);
  return()=>window.removeEventListener('hhba-major-changed',listener);
 },[]);
 function choose(next:string){storeSelectedMajor(next);setSlug(next)}
 return {slug,choose};
}
/** One role source, one matching predicate and one company chip UI across all rebuilt employers. */
export function CompanyMajorJobs({companyRoute,majorIntro,quickMajorNames}:{companyRoute:string;majorIntro?:string;quickMajorNames?:readonly string[]}){
 const {slug,choose}=useSharedMajorSelection();
 const allJobs:LiveJob[]=domesticV2Records.filter(j=>j.employerRoute===companyRoute&&!!safeOfficialJobUrl(j));
 const incoming=getCompanyReturnTarget().marketState?.filters;
 const inherited=incoming&&typeof incoming.major_slug==='string'&&incoming.major_slug===slug
  ?incoming as unknown as LiveFilters:null;
 const jobs=inherited?allJobs.filter(j=>rebuildListFilter(j,{...inherited,major_slug:''})):allJobs;
 const related=jobs.filter(j=>{
  const result=matchRoleToMajor(j,slug);
  return result==='related'||result==='unrestricted';
 });
 const unknown=slug?jobs.filter(j=>matchRoleToMajor(j,slug)==='unknown'):[];
 const current=!slug?allJobs:related;
 const label=majorName(slug);
 return <>
  <section className="hhba-kpmg-section hhba-major-linked-section" aria-labelledby="hhba-shared-major-title">
   <div className="hhba-kpmg-section-heading"><div>
    <h2 id="hhba-shared-major-title">适合哪些专业背景？</h2>
    <p>{majorIntro||'点击下方专业标签，查看这家企业已整理的相关岗位；选择「全部专业」可查看所有已收录岗位。'}</p>
   </div></div>
   <CompanyMajorChips jobs={jobs} slug={slug} onChange={choose} preferredNames={quickMajorNames}/>
  </section>
  <section className="hhba-kpmg-section hhba-major-linked-jobs" aria-labelledby="hhba-shared-roles-title">
   <div className="hhba-kpmg-section-heading"><div>
    <h2 id="hhba-shared-roles-title">招聘岗位</h2>
    <p aria-live="polite">{!slug?`全部专业 · 已收录 ${allJobs.length} 条岗位资料`:`${label} · ${related.length} 条相关/不限专业岗位`}。实际招聘状态和专业要求以企业官网为准。</p>
   </div></div>
   <div className="hhba-kpmg-role-list" aria-live="polite">
    {current.map(job=><article className="hhba-kpmg-role" key={job.id}>
     <div className="hhba-kpmg-role-icon"><BriefcaseBusiness size={17}/></div>
     <div className="hhba-kpmg-role-main">
      <div className="hhba-kpmg-role-top"><h3>{job.titleZh||job.title}</h3><span>{job.positionOrg||job.companyZh||job.company}</span></div>
      <p>{job.locationZh||job.location||'工作地点待核实'} · {job.responsibilitiesSummary||'岗位职责请查看站内资料'}</p>
      <small>{slug?majorMatchLabel(matchRoleToMajor(job,slug))+' · ':''}申请状态待官网核对；{job.majorNames?.length?'已整理专业信息：'+job.majorNames.slice(0,4).join('、'):'逐岗官方专业要求尚未核实'}</small>
     </div>
     <Link to={'/candidate/jobs/'+encodeURIComponent(job.id)} aria-label={'查看'+job.title+'站内岗位详情'}>查看详情 <ArrowRight size={14}/></Link>
    </article>)}
    {current.length===0&&<p className="hhba-kpmg-role-disclaimer">
     目前没有收录与「{label}」关联的岗位资料。可点击上方「全部专业」查看该企业其他岗位；不代表这家企业不招聘该专业。
    </p>}
   </div>
   <p className="hhba-kpmg-role-disclaimer"><GraduationCap size={14}/>
    专业关联仅作辅助导航，并非官方报考资格。部分记录为历史岗位或校招方向，并非实时在招。
    {unknown.length>0&&slug?`另有 ${unknown.length} 条岗位未披露可核验的专业条件，可在「全部专业」中查看。`:''}
    点击「查看详情」进入 HHBA 站内岗位页，官方入口保持登录拦截。
   </p>
  </section>
 </>;
}
