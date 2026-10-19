import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, ExternalLink, MapPin, RefreshCcw, Search, ShieldCheck } from 'lucide-react';
import { Link } from '../router';
import { Shell } from './Shell';
import type { User } from '../services/api';
import { getJob, listJobs, localizedCompany, localizedLocation, localizedTitle, officialStatus, safeOfficialJobUrl,
  type Language, type LiveFilters, type LiveJob, type LivePage } from '../services/liveRecruitment';
import { fetchOfficialJd, greenDetailLink, type OfficialJd } from '../services/officialJd';
import '../styles/unified-jobs.css';

const emptyFilters: LiveFilters={q:'',company:'',country:'',remote:false,recruitment_type:''};
const typeLabel: Record<string,{zh:string,en:string}>={SOCIAL:{zh:'社会招聘',en:'Professional'},CAMPUS:{zh:'校园招聘',en:'Graduate'},INTERNSHIP:{zh:'实习招聘',en:'Internship'},SPECIAL:{zh:'专项招聘',en:'Special program'}};
const formatDate=(value?:string)=>value&&Number.isFinite(Date.parse(value)) ? value.slice(0,10) : '--';
function useLanguage() {
  const [lang, setLang] = useState<Language>(()=>{
    try { return sessionStorage.getItem('hhba.jobs.language')==='en'?'en':'zh'; } catch {return 'zh';}
  });
  function change(value:Language) {setLang(value);try{sessionStorage.setItem('hhba.jobs.language',value);}catch{}}
  return {lang,change};
}
function JobCard({job,lang,asOf}:{job:LiveJob,lang:Language,asOf:string}){
  const source=safeOfficialJobUrl(job);
  if(!source || officialStatus(job,asOf)!=='recent')return null;
  return <article className="unified-job-card">
    <div className="unified-job-head"><span><Building2 size={15}/>{localizedCompany(job,lang)}</span>
    <small>{lang==='zh'?(job.domestic?'国内官方招聘信息':'官方 ATS 招聘板'):(job.domestic?'Official China career site':'Official ATS board')}</small></div>
    <h3><Link to={'/candidate/jobs/'+encodeURIComponent(job.id)}>{localizedTitle(job,lang)}</Link></h3>
    <div className="unified-job-meta"><span><MapPin size={14}/>{localizedLocation(job,lang)}</span>
      <span>{job.recruitmentType?typeLabel[job.recruitmentType]?.[lang]||job.recruitmentType:(lang==='zh'?'招聘类型待确认':'Type unverified')}</span>
      {job.remote===true&&<span>{lang==='zh'?'远程':'Remote'}</span>}</div>
    <p className="unified-job-proof"><ShieldCheck size={15}/> {lang==='zh'
      ? '近期来源记录，是否仍可申请请以企业官网为准'
      : 'Recently observed; confirm current availability on the official site'}</p>
    <div className="unified-job-actions"><Link to={'/candidate/jobs/'+encodeURIComponent(job.id)}>
      {lang==='zh'?'查看岗位':'View role'} <ArrowRight size={14}/></Link>
      <a href={source} target="_blank" rel="noopener noreferrer">{lang==='zh'?'企业官方页':'Official posting'} <ExternalLink size={13}/></a></div>
  </article>;
}
function LanguageSwitcher({lang,change}:{lang:Language,change:(value:Language)=>void}){
 return <div className="unified-lang" aria-label="Language">
   <button type="button" aria-pressed={lang==='zh'} onClick={()=>change('zh')}>中文</button>
   <button type="button" aria-pressed={lang==='en'} onClick={()=>change('en')}>English</button></div>;
}
export function UnifiedJobMarket({compact=false,user=null}:{compact?:boolean,user?:User|null}){
  const {lang,change}=useLanguage();
  const [filters,setFilters]=useState<LiveFilters>(emptyFilters);
  const [draft,setDraft]=useState('');
  const [page,setPage]=useState(0);
  const [snapshot,setSnapshot]=useState<LivePage|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{const id=setTimeout(()=>{setPage(0);setFilters(f=>({...f,q:draft}));},280);return()=>clearTimeout(id)},[draft]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    listJobs(filters,page*30,controller.signal)
      .then(data=>{if(!controller.signal.aborted)setSnapshot(data)})
      .catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'读取失败');setSnapshot(null)}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[filters,page,retry]);
  const eligible=useMemo(()=>snapshot?.jobs.filter(j=>officialStatus(j,snapshot.updated)==='recent')||[],[snapshot]);
  const shown=compact?eligible.slice(0,8):eligible;
  const controls=<div className="unified-job-controls">
    <label className="unified-job-search"><Search size={17}/>
      <input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={100}
        placeholder={lang==='zh'?'搜索企业、岗位或技能':'Search companies or roles'}
        aria-label={lang==='zh'?'搜索岗位':'Search jobs'}/></label>
    <select value={filters.country} onChange={e=>{setPage(0);setFilters(f=>({...f,country:e.target.value as LiveFilters['country']}))}} aria-label="Country">
      <option value="">{lang==='zh'?'全部地区':'All regions'}</option>
      <option value="cn">{lang==='zh'?'中国':'China'}</option>
      <option value="global">{lang==='zh'?'海外':'International'}</option>
    </select>
    <select value={filters.recruitment_type} onChange={e=>{setPage(0);setFilters(f=>({...f,recruitment_type:e.target.value as LiveFilters['recruitment_type']}))}} aria-label="Recruitment type">
      <option value="">{lang==='zh'?'全部招聘类型':'All types'}</option>
      <option value="SOCIAL">{lang==='zh'?'社会招聘':'Professional'}</option>
      <option value="CAMPUS">{lang==='zh'?'校园招聘':'Graduate'}</option>
      <option value="INTERNSHIP">{lang==='zh'?'实习':'Internships'}</option>
    </select>
    <label className="unified-job-remote"><input type="checkbox" checked={filters.remote}
      onChange={e=>{setPage(0);setFilters(f=>({...f,remote:e.target.checked}))}}/>
      {lang==='zh'?'仅远程':'Remote only'}</label>
  </div>;
  const market=<section className="unified-market" aria-labelledby="unified-market-title">
    <div className="unified-market-heading"><div><small>HHBA · RECRUITMENT</small>
      <h2 id="unified-market-title">{lang==='zh'?'招聘市场':'Job market'}</h2>
      <p>{lang==='zh'?'国内外岗位统一搜索，与应聘页面共享同一套职位数据。':'One job index shared by the homepage and candidate pages.'}</p></div>
      <LanguageSwitcher lang={lang} change={change}/></div>
    {controls}
    <p className="unified-market-caution"><ShieldCheck size={16}/>
      {lang==='zh'?'仅显示本页符合近期来源记录要求的岗位；历史信息另存，申请前核对官网。':'Showing recently observed listings on this page; check the original site before applying.'}</p>
    {loading?<p className="unified-job-state" role="status">{lang==='zh'?'正在读取真实岗位…':'Loading jobs…'}</p>:
      error?<div className="unified-job-state" role="alert">{lang==='zh'?error:'Jobs temporarily unavailable. Please retry.'}<button type="button" onClick={()=>setRetry(x=>x+1)}><RefreshCcw size={15}/> {lang==='zh'?'重试':'Retry'}</button></div>:
      shown.length?<div className="unified-job-grid">{shown.map(job=><JobCard key={job.id} job={job} lang={lang} asOf={snapshot!.updated}/>)}</div>:
        <div className="unified-job-state">{lang==='zh'?'当前没有通过近期核验的岗位，请尝试其他筛选条件。':'No recently observed jobs match your filters.'}</div>}
    <div className="unified-job-footer">
      <span>{lang==='zh'? `本页符合展示要求 ${eligible.length} 条 · 来源更新时间：${formatDate(snapshot?.updated)}`
        : `${eligible.length} verified for display on this page · Updated ${formatDate(snapshot?.updated)}`}</span>
      {compact?<Link to="/candidate/jobs">{lang==='zh'?'查看完整招聘市场':'Browse all jobs'} <ArrowRight size={15}/></Link>:
        <div className="unified-job-paging">
          <button type="button" disabled={page===0||loading} onClick={()=>setPage(x=>x-1)}>{lang==='zh'?'上一页':'Previous'}</button>
          <span>{page+1}</span>
          <button type="button" disabled={loading||!snapshot||((page+1)*30>=snapshot.total)} onClick={()=>setPage(x=>x+1)}>{lang==='zh'?'下一页':'Next'}</button>
        </div>}
    </div>
    {!compact && <p className="unified-job-history">{lang==='zh'?'查阅保留的历史岗位资料：':'Archived historical records: '}
      <Link to="/candidate/jobs/archive">{lang==='zh'?'历史岗位记录':'Historical jobs'}</Link></p>}
  </section>;
  return compact? market:<Shell user={user}>{market}</Shell>;
}
export function UnifiedJobDetail({user,jobId}:{user:User|null,jobId:string}){
 const {lang,change}=useLanguage();
 const [detail,setDetail]=useState<Awaited<ReturnType<typeof getJob>>|null>(null);
 const [error,setError]=useState('');
 const [jd,setJd]=useState<OfficialJd|null>(null);
 const [jdError,setJdError]=useState('');
 const [jdLoading,setJdLoading]=useState(false);
 useEffect(()=>{
   const controller=new AbortController();
   setDetail(null);setError('');setJd(null);setJdError('');
   getJob(jobId,controller.signal).then(result=>{
     if(!controller.signal.aborted)setDetail(result);
   }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'岗位详情不可用')});
   return()=>controller.abort();
 },[jobId]);
 const job=detail?.job;
 useEffect(()=>{
   if(!job)return;
   const controller=new AbortController();
   setJd(null);setJdError('');setJdLoading(true);
   fetchOfficialJd(job,controller.signal).then(result=>{
     if(!controller.signal.aborted)setJd(result);
   }).catch(e=>{
     if(!controller.signal.aborted)setJdError(e instanceof Error?e.message:'职位原文暂不可用');
   }).finally(()=>{if(!controller.signal.aborted)setJdLoading(false)});
   return()=>controller.abort();
 },[job]);
 const official=job?safeOfficialJobUrl(job):null;
 const translatedReader=job?greenDetailLink(job):null;
 const segmentName:Record<string,{zh:string,en:string}>={
   responsibilities:{zh:'岗位职责',en:'Responsibilities'},
   requirements:{zh:'任职资格与技术要求',en:'Requirements and skills'},
   benefits:{zh:'薪资福利',en:'Benefits and compensation'},
   other:{zh:'其他职位说明',en:'Other job information'}
 };
 const sections=jd ? ['responsibilities','requirements','benefits','other'].map(kind=>({
   kind,blocks:jd.blocks.filter(item=>item.section===kind)
 })).filter(group=>group.blocks.length>0):[];
 return <Shell user={user}><div className="unified-detail">
   <div className="unified-market-heading"><Link to="/candidate/jobs">← {lang==='zh'?'返回招聘市场':'Back to jobs'}</Link>
     <LanguageSwitcher lang={lang} change={change}/></div>
   {error?<p className="unified-job-state" role="alert">{lang==='zh'?error:'Job details unavailable.'}</p>:!job?<p className="unified-job-state">
     {lang==='zh'?'正在读取官方岗位信息…':'Loading official job details…'}</p>:
   <article className="unified-detail-card">
     <small>{localizedCompany(job,lang)}</small><h1>{localizedTitle(job,lang)}</h1>
     <p><MapPin size={15}/>{localizedLocation(job,lang)}</p>
     <div className="unified-detail-warning"><ShieldCheck size={17}/>
       {lang==='zh'?'正在核对企业官方职位内容。最新投递状态以官网为准。':
         'Checking the employer’s published job details. Confirm application availability on the official site.'}</div>
     <h2>{lang==='zh'?'职位说明与任职要求':'Description and job requirements'}</h2>
     {jdLoading?<p role="status">{lang==='zh'?'正在读取官方岗位职责及任职要求…':'Fetching current employer requirements…'}</p>:
       jdError?<div className="unified-jd-empty" role="status">
         <p>{lang==='zh'?'当前无法在本页面获取完整官方 JD，原有绿色市场的详情阅读仍可使用。':
           'The full JD could not be retrieved in this browser. The original recruitment detail reader remains available.'}</p>
         <small>{lang==='zh'?'数据读取受限制时，不会编造职责或任职要求。':'Requirements are not fabricated when source data is unavailable.'}</small>
       </div>:
       jd?<div className="unified-jd-content">
         <p className="unified-jd-source">{lang==='zh'?'官方内容核验时间：':'Official content checked: '}
           {new Date(jd.checkedAt).toLocaleString(lang==='zh'?'zh-CN':'en-US')}</p>
         {lang==='en'?sections.map(group=><section key={group.kind} className="unified-jd-section">
           <h3>{segmentName[group.kind].en}</h3>
           {group.blocks.map((block,i)=>block.kind==='heading'?
             <h4 key={i}>{block.text}</h4>:block.kind==='bullet'?
             <p key={i} className="unified-jd-bullet">{block.text}</p>:
             <p key={i}>{block.text}</p>)}
         </section>):
         <div className="unified-jd-translate">
           <strong>已读取完整官方英文职位说明</strong>
           <p>中文岗位职责与技术任职要求需要经过完整翻译和核验。你可以切换 English 阅读当前官方原文，
             或使用原招聘市场的中文辅助阅读，不会以夹杂英文的内容冒充中文译文。</p>
         </div>}
       </div>:null}
     <div className="unified-job-actions unified-detail-actions">
       {translatedReader&&!job.domestic&&<a href={translatedReader} target="_blank" rel="noopener noreferrer">
         {lang==='zh'?'查看原市场完整 JD / 中文辅助阅读':'Original full JD / Chinese reading'} <ExternalLink size={15}/></a>}
       {official&&<a href={official} target="_blank" rel="noopener noreferrer">
         {lang==='zh'?'打开企业官方岗位':'View official job posting'} <ExternalLink size={15}/></a>}
     </div>
     <p className="unified-detail-footnote">{lang==='zh'?
       '职位正文仅在浏览时尝试读取企业官方公开接口，不编造岗位要求；原始投递链接保留。':
       'Original job requirements are retrieved on demand from public employer endpoints. Job availability may change.'}</p>
   </article>}
 </div></Shell>;
}
