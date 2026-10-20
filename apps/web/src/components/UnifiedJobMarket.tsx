import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, ExternalLink, MapPin, RefreshCcw, Search, ShieldCheck } from 'lucide-react';
import { Link } from '../router';
import { Shell } from './Shell';
import type { User } from '../services/api';
import { getJob, listJobs, localizedCompany, localizedLocation, localizedTitle, officialStatus, safeOfficialJobUrl,
  type Language, type LiveFilters, type LiveJob, type LivePage } from '../services/liveRecruitment';
import { fetchOfficialJd, translateGreenJd, type OfficialJd } from '../services/officialJd';
import { loadPublicJobAudit, loadOverseasJdProgress, auditForJob, describeAudit, type OverseasJdProgress, type JobAuditEntry, type JobAuditSummary } from '../services/jobSyncStatus';
import {countryOptions,cityOptions,parseNaturalQuery} from '../services/jobSearchFacets.mjs';
import '../styles/unified-jobs.css';

const emptyFilters: LiveFilters={q:'',company:'',country:'',remote:false,recruitment_type:'',location_country:'',city:'',education:'',experience:''};
function initialJobQuery(){
  try{return new URLSearchParams(location.search).get('q')?.trim().slice(0,100)||'';}
  catch{return '';}
}
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
      {lang==='zh'?'查看岗位':'View role'} <ArrowRight size={14}/></Link></div>
  </article>;
}
function LanguageSwitcher({lang,change}:{lang:Language,change:(value:Language)=>void}){
 return <div className="unified-lang" aria-label="Language">
   <button type="button" aria-pressed={lang==='zh'} onClick={()=>change('zh')}>中文</button>
   <button type="button" aria-pressed={lang==='en'} onClick={()=>change('en')}>English</button></div>;
}
export function UnifiedJobMarket({compact=false,user=null}:{compact?:boolean,user?:User|null}){
  const {lang,change}=useLanguage();
  const [filters,setFilters]=useState<LiveFilters>(()=>({...emptyFilters,q:initialJobQuery()}));
  const [draft,setDraft]=useState(initialJobQuery);
  const [page,setPage]=useState(0);
  const [snapshot,setSnapshot]=useState<LivePage|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [retry,setRetry]=useState(0);
  const [auditSummary,setAuditSummary]=useState<JobAuditSummary|null>(null);
  const [jdSync,setJdSync]=useState<OverseasJdProgress|null>(null);
  useEffect(()=>{const id=setTimeout(()=>{setPage(0);setFilters(f=>({...f,q:draft,education:f.education==='UNRESTRICTED_OR_UNREPORTED'?'':f.education}));},280);return()=>clearTimeout(id)},[draft]);
  useEffect(()=>{loadPublicJobAudit().then(report=>setAuditSummary(report?.summary||null)).catch(()=>setAuditSummary(null));},[]);
  useEffect(()=>{let active=true;loadOverseasJdProgress().then(status=>{if(active)setJdSync(status)});return()=>{active=false};},[retry]);
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
  const interpreted=useMemo(()=>parseNaturalQuery(filters.q),[filters.q]);
  const roleNames:Record<string,string>={software:'软件工程师',sales:'销售',engineer:'工程师',product:'产品经理',intern:'实习',design:'设计',finance:'财务',marketing:'市场营销',operations:'运营'};
  const intentLabels=[
    interpreted.countryCode&&(countryOptions.find(c=>c.value===interpreted.countryCode)?.[lang]||interpreted.countryCode),
    interpreted.cityKey&&(cityOptions.find(c=>c.value===interpreted.cityKey)?.[lang]||interpreted.cityKey),
    interpreted.roleKeys.length>0&&(lang==='zh'?'职位：':'Role: ')+interpreted.roleKeys.map(k=>lang==='zh'?(roleNames[k]||k):k).join(', '),
    interpreted.remote&&(lang==='zh'?'远程':'Remote'),
    filters.education==='UNRESTRICTED_OR_UNREPORTED'?(lang==='zh'?'包含学历未识别岗位（需核实）':'Includes unverified education requirements'):
    interpreted.education==='UNRESTRICTED'&&(lang==='zh'?'明确无学历要求':'Explicitly no degree required'),
    interpreted.experience&&(lang==='zh'?'经验：':'Experience: ')+interpreted.experience
  ].filter(Boolean);

  const controls=<div className="unified-job-controls">
    <label className="unified-job-search"><Search size={17}/>
      <input value={draft} onChange={e=>setDraft(e.target.value)} maxLength={100}
        placeholder={lang==='zh'?'例如：新加坡软件工程师、美国销售、不限学历的远程工作':'Try Singapore software engineer or remote sales'}
        aria-label={lang==='zh'?'自然语言搜索岗位':'Search jobs in natural language'}/></label>
    <select value={filters.country} onChange={e=>{setPage(0);setFilters(f=>({...f,country:e.target.value as LiveFilters['country']}))}} aria-label={lang==='zh'?'国内外范围':'Domestic or international'}>
      <option value="">{lang==='zh'?'国内外全部':'All markets'}</option>
      <option value="cn">{lang==='zh'?'中国岗位':'China jobs'}</option>
      <option value="global">{lang==='zh'?'海外岗位':'International jobs'}</option>
    </select>
    <select value={filters.location_country||''} onChange={e=>{setPage(0);setFilters(f=>({...f,location_country:e.target.value,city:''}))}}
      aria-label={lang==='zh'?'国家筛选':'Filter by country'}>
      <option value="">{lang==='zh'?'全部国家':'All countries'}</option>
      {countryOptions.map(c=><option key={c.value} value={c.value}>{c[lang]}</option>)}
    </select>
    <select value={filters.city||''} onChange={e=>{setPage(0);setFilters(f=>({...f,city:e.target.value}))}}
      aria-label={lang==='zh'?'城市筛选':'Filter by city'}>
      <option value="">{lang==='zh'?'全部城市':'All cities'}</option>
      {cityOptions.filter(c=>!filters.location_country||c.country===filters.location_country)
        .map(c=><option key={c.country+':'+c.value} value={c.value}>{c[lang]}</option>)}
    </select>
    <select value={filters.recruitment_type} onChange={e=>{setPage(0);setFilters(f=>({...f,recruitment_type:e.target.value as LiveFilters['recruitment_type']}))}} aria-label={lang==='zh'?'招聘类型':'Recruitment type'}>
      <option value="">{lang==='zh'?'全部招聘类型':'All job types'}</option>
      <option value="REGULAR">{lang==='zh'?'常规岗位（标题推断）':'Regular roles (inferred)'}</option>
      <option value="SOCIAL">{lang==='zh'?'明确社会招聘':'Confirmed professional recruitment'}</option>
      <option value="CAMPUS">{lang==='zh'?'应届 / 校招':'Graduate'}</option>
      <option value="INTERNSHIP">{lang==='zh'?'实习':'Internship'}</option>
    </select>
    <select value={filters.education||''} onChange={e=>{setPage(0);setFilters(f=>({...f,education:e.target.value}))}}
      aria-label={lang==='zh'?'学历要求':'Education requirements'}>
      <option value="">{lang==='zh'?'全部学历要求':'Any education requirement'}</option>
      <option value="UNRESTRICTED">{lang==='zh'?'明确不限学历':'Explicitly no degree required'}</option>
      <option value="UNRESTRICTED_OR_UNREPORTED">{lang==='zh'?'不限学历或要求未识别（需核实）':'No degree requirement or unknown (verify)'}</option>
      <option value="HIGH_SCHOOL">{lang==='zh'?'要求高中学历':'High school requirement'}</option>
      <option value="ASSOCIATE">{lang==='zh'?'要求专科学历':'Associate requirement'}</option>
      <option value="BACHELOR">{lang==='zh'?'要求本科学历':'Bachelor requirement'}</option>
      <option value="MASTER">{lang==='zh'?'要求硕士学历':'Master requirement'}</option>
      <option value="PHD">{lang==='zh'?'要求博士学历':'Doctoral requirement'}</option>
    </select>
    <select value={filters.experience||''} onChange={e=>{setPage(0);setFilters(f=>({...f,experience:e.target.value}))}}
      aria-label={lang==='zh'?'经验要求':'Experience requirement'}>
      <option value="">{lang==='zh'?'全部经验要求':'All experience requirements'}</option>
      <option value="0">{lang==='zh'?'明确不要求经验':'No experience required'}</option>
      <option value="1-3">{lang==='zh'?'最低经验 1—3 年':'Minimum 1–3 years'}</option>
      <option value="3-5">{lang==='zh'?'最低经验 3—5 年':'Minimum 3–5 years'}</option>
      <option value="5+">{lang==='zh'?'最低经验 5 年以上':'Minimum 5+ years'}</option>
      <option value="unreported">{lang==='zh'?'经验要求未识别':'Experience unspecified'}</option>
    </select>
    <label className="unified-job-remote"><input type="checkbox" checked={filters.remote}
      onChange={e=>{setPage(0);setFilters(f=>({...f,remote:e.target.checked}))}}/>
      {lang==='zh'?'仅远程岗位':'Remote only'}</label>
  </div>;
  const market=<section className="unified-market" aria-labelledby="unified-market-title">
    <div className="unified-market-heading"><div><small>HHBA · RECRUITMENT</small>
      <h2 id="unified-market-title">{lang==='zh'?'招聘市场':'Job market'}</h2>
      <p>{lang==='zh'?'国内外岗位统一搜索，与应聘页面共享同一套职位数据。':'One job index shared by the homepage and candidate pages.'}</p></div>
      <LanguageSwitcher lang={lang} change={change}/></div>
    {controls}
    {intentLabels.length>0&&<p className="unified-search-interpreted">
      {lang==='zh'?'搜索条件已识别：':'Recognized filters: '}{intentLabels.join(' · ')}
    </p>}
    <p className="unified-search-provenance">
      {lang==='zh'?'学历和年限筛选仅使用官方 JD 明确可识别的内容；未披露不代表不限。检索信息为机器提取，请在职位详情核对原文。':
       'Education and experience filters use identifiable official JD evidence. Unreported does not mean unrestricted. Verify requirements against the source.'}
    </p>
    {auditSummary && Number.isFinite(Date.parse(auditSummary.checked_at)) &&
      Date.now()-Date.parse(auditSummary.checked_at)<24*3600_000 &&
      snapshot?.updated===auditSummary.indexed_as_of &&
      <p className="unified-audit-summary">
        {lang==='zh'
          ? `全量官方 JD 核验：${auditSummary.verified_full_original_jd_and_requirements.toLocaleString()} / ${auditSummary.total_indexed_jobs.toLocaleString()} 条有职责与任职要求证据；中文全文需另行核验。`
          : `Official JD audit: ${auditSummary.verified_full_original_jd_and_requirements.toLocaleString()} of ${auditSummary.total_indexed_jobs.toLocaleString()} have description and requirements evidence. Full Chinese coverage not yet verified.`}
      </p>}
    {jdSync && <p className="unified-jd-sync-progress" role="status">
      <ShieldCheck size={15}/>
      {lang==='zh'
       ? `海外 JD 中文全文机械校验完成：${jdSync.complete.toLocaleString()} / ${jdSync.total_current.toLocaleString()} 条；另有 ${jdSync.translated_parts.toLocaleString()} 段已验证。机器翻译仅供辅助阅读，尚未经人工逐条审校。`
       : `Overseas full-JD machine-validated Chinese: ${jdSync.complete.toLocaleString()} / ${jdSync.total_current.toLocaleString()} jobs; ${jdSync.translated_parts.toLocaleString()} verified chunks. Machine translation is not human-reviewed.`}
    </p>}
    {!loading&&!error&&snapshot?.total===0&&interpreted.education==='UNRESTRICTED'&&
      filters.education!=='UNRESTRICTED_OR_UNREPORTED'&&
      <div className="unified-search-fallback">
        <p>{lang==='zh'?'当前没有官方明确声明“不要求学历”且符合其余条件的岗位。可以放宽为包含学历条件未识别的职位，但这不代表企业没有学历要求。':
          'No roles explicitly say that no degree is required under these conditions. You can also inspect jobs with unknown education requirements, but they may still require a degree.'}</p>
        <button type="button" onClick={()=>{setPage(0);setFilters(f=>({...f,education:'UNRESTRICTED_OR_UNREPORTED'}))}}>
          {lang==='zh'?'查看学历要求未识别的职位（需核实）':'Include unknown education requirements'}
        </button>
      </div>}
    {filters.education==='UNRESTRICTED_OR_UNREPORTED'&&
      <p className="unified-search-fallback-active">
        {lang==='zh'?'当前包含官网没有明确识别到学历条件的岗位。这些职位可能仍有学历要求，请务必查阅官方任职资格。':
          'Some listed jobs have unknown education requirements. This does not mean that a degree is unnecessary; check the employer’s official qualifications.'}
      </p>}
    <p className="unified-market-caution"><ShieldCheck size={16}/>
      {lang==='zh'?'仅显示本页符合近期来源记录要求的岗位；历史信息另存，申请前核对官网。':'Showing recently observed listings on this page; check the original site before applying.'}</p>
    {loading?<p className="unified-job-state" role="status">{lang==='zh'?'正在读取真实岗位…':'Loading jobs…'}</p>:
      error?<div className="unified-job-state" role="alert">{lang==='zh'?error:'Jobs temporarily unavailable. Please retry.'}<button type="button" onClick={()=>setRetry(x=>x+1)}><RefreshCcw size={15}/> {lang==='zh'?'重试':'Retry'}</button></div>:
      shown.length?<div className="unified-job-grid">{shown.map(job=><JobCard key={job.id} job={job} lang={lang} asOf={snapshot!.updated}/>)}</div>:
        <div className="unified-job-state">{lang==='zh'?'当前没有通过近期核验的岗位，请尝试其他筛选条件。':'No recently observed jobs match your filters.'}</div>}
    <div className="unified-job-footer">
      <span>{lang==='zh'? `共匹配 ${snapshot?.total.toLocaleString()||0} 条 · 本页 ${eligible.length} 条 · 来源更新时间：${formatDate(snapshot?.updated)}`
        : `${snapshot?.total.toLocaleString()||0} matching jobs · ${eligible.length} on this page · Updated ${formatDate(snapshot?.updated)}`}</span>
      {compact?<Link to="/candidate/jobs">{lang==='zh'?'查看完整招聘市场':'Browse all jobs'} <ArrowRight size={15}/></Link>:
        <div className="unified-job-paging">
          <button type="button" disabled={page===0||loading} onClick={()=>setPage(x=>x-1)}>{lang==='zh'?'上一页':'Previous'}</button>
          <span>{page+1}</span>
          <button type="button" disabled={loading||!snapshot||((page+1)*30>=snapshot.total)} onClick={()=>setPage(x=>x+1)}>{lang==='zh'?'下一页':'Next'}</button>
        </div>}
    </div>
    {!compact && <p className="unified-job-history">{lang==='zh'?'查阅保留的历史岗位资料：':'Archived historical records: '}
      <Link to="/candidate/jobs/archive">{lang==='zh'?'历史岗位记录':'Historical jobs'}</Link>
       {' · '}<Link to="/candidate/employer-jobs">{lang==='zh'?'经认证企业自行发布的岗位':'Employer-submitted jobs (separate from official ATS)'}</Link></p>}
  </section>;
  return compact? market:<Shell user={user}>{market}</Shell>;
}
export function UnifiedJobDetail({user,jobId}:{user:User|null,jobId:string}){
 const {lang,change}=useLanguage();
 const [detail,setDetail]=useState<Awaited<ReturnType<typeof getJob>>|null>(null);
 const [audit,setAudit]=useState<JobAuditEntry|null>(null);
 const [error,setError]=useState('');
 const [jd,setJd]=useState<OfficialJd|null>(null);
 const [jdError,setJdError]=useState('');
 const [jdLoading,setJdLoading]=useState(false);
 const [jdRetry,setJdRetry]=useState(0);
 const [translateRetry,setTranslateRetry]=useState(0);
 const [chineseJd,setChineseJd]=useState('');
 const [translateBusy,setTranslateBusy]=useState(false);
 const [translateError,setTranslateError]=useState('');
 const [translationProgress,setTranslationProgress]=useState('');

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
   let active=true;
   loadPublicJobAudit().then(report=>{
     if(!active||!report||Date.now()-Date.parse(report.summary.checked_at)>24*3600_000)return;
     const row=report.jobs.find(item=>item.job_id===job.id&&item.platform===job.platform);
     if(row)setAudit(row);
   }).catch(()=>undefined);
   return()=>{active=false};
 },[job]);

 useEffect(()=>{
   if(!job)return;
   const controller=new AbortController();
   setJd(null);setChineseJd('');setTranslateError('');setJdError('');setJdLoading(true);
   fetchOfficialJd(job,controller.signal).then(result=>{
     if(!controller.signal.aborted)setJd(result);
   }).catch(e=>{
     if(!controller.signal.aborted)setJdError(e instanceof Error?e.message:'职位原文暂不可用');
   }).finally(()=>{if(!controller.signal.aborted)setJdLoading(false)});
   return()=>controller.abort();
 },[job,jdRetry]);
 useEffect(()=>{
   if(lang!=='zh'||!job||!jd?.originalText)return;
   const controller=new AbortController();
   setChineseJd('');setTranslateError('');setTranslateBusy(true);setTranslationProgress('');
   translateGreenJd(job,jd.originalText,controller.signal,(done,total)=>{
     if(!controller.signal.aborted)setTranslationProgress('翻译进度 '+done+' / '+total);
   }).then(translated=>{if(!controller.signal.aborted)setChineseJd(translated)})
    .catch(e=>{if(!controller.signal.aborted)setTranslateError(e instanceof Error?e.message:'中文 JD 翻译失败')})
    .finally(()=>{if(!controller.signal.aborted)setTranslateBusy(false)});
   return()=>controller.abort();
 },[lang,job,jd,translateRetry]);
 const official=job?safeOfficialJobUrl(job):null;
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
     {audit && <p className="unified-job-audit"><ShieldCheck size={16}/>
       {describeAudit(audit.status,lang)}
       {audit.official_checked_at && <small>{lang==='zh'?'核验：':'Checked: '}{audit.official_checked_at.slice(0,10)}</small>}
     </p>}
     <h2>{lang==='zh'?'职位说明与任职要求':'Description and job requirements'}</h2>
     {jdLoading?<p role="status">{lang==='zh'?'正在读取官方岗位职责及任职要求…':'Fetching current employer requirements…'}</p>:
       jdError?<div className="unified-jd-empty" role="status">
         <p>{lang==='zh'?'该岗位的完整官方职位说明暂未获取成功。':'The full official description for this role is temporarily unavailable.'}</p>
         <small>{lang==='zh'?jdError:'The employer source could not be verified; requirements will not be invented.'}</small>
         <button type="button" className="unified-jd-retry" onClick={()=>setJdRetry(n=>n+1)}>
           <RefreshCcw size={14}/>{lang==='zh'?'重新获取岗位职责与任职要求':'Retry official job description'}
         </button>
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
         chineseJd?<section className="unified-jd-section unified-jd-chinese">
           <h3>官方职位说明 · 中文辅助译文</h3>
           <p className="unified-jd-machine-notice">以下为机器译文，仅供理解。职责、学历、技能、薪资数字请与英文原文及企业官网核对。</p>
           {chineseJd.split(/\n{2,}/).filter(Boolean).map((paragraph,i)=>{
             const trimmed=paragraph.trim();
             return trimmed.startsWith('# ')?<h4 key={i}>{trimmed.slice(2)}</h4>:
               <p key={i} className={trimmed.startsWith('- ')?'unified-jd-bullet':''}>
                 {trimmed.startsWith('- ')?trimmed.slice(2):trimmed}
               </p>;
           })}
         </section>:<div className="unified-jd-translate">
           <strong>{translateBusy?'正在生成完整中文岗位说明':'已获取完整的企业官方岗位说明'}</strong>
           <p>{translateBusy?(translationProgress||'正在逐段翻译岗位职责、任职要求及技能条件。'):
             translateError ? '中文翻译尚未完成：'+translateError+'。请在本页面重试，也可以切换 English 阅读官方原文。':
             '尚未取得通过校验的中文译文；请切换 English 阅读本页的官方原文。'}</p>
           {!translateBusy&&translateError&&
             <button type="button" className="unified-jd-retry" onClick={()=>setTranslateRetry(n=>n+1)}>
               重新翻译中文
             </button>}
         </div>}
       </div>:null}
     <div className="unified-job-actions unified-detail-actions">
       {official&&<a href={official} target="_blank" rel="noopener noreferrer" aria-label={lang==='zh'?'前往企业官网立即申请':'Apply on official employer website'}>
         {lang==='zh'?'立即申请':'Apply now'} <ExternalLink size={15}/></a>}
     </div>
     <p className="unified-detail-footnote">{lang==='zh'?
       '岗位职责与任职要求直接在 HHBA 白色详情页展示；尚未读取成功的内容不会被编造。申请请以企业官网为准。':
       'Original job requirements are retrieved on demand from public employer endpoints. Job availability may change.'}</p>
   </article>}
 </div></Shell>;
}
