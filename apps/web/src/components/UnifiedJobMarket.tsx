import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink, MapPin, RefreshCcw, Search, ShieldCheck } from 'lucide-react';
import { Link, getJobReturnTarget, navigate } from '../router';
import { Shell } from './Shell';
import { DomesticCompanyResults } from './DomesticCompanyResults';
import { MajorFilter } from './MajorFilter';
import { majorById } from '../services/domesticMajors';
import { SaveJobButton } from './SaveJobButton';
import { trackEvent } from '../services/engagement';
import '../styles/saved-jobs.css';
import { EmployerBrandLogo } from './EmployerBrandLogo';
import { companyProfileForJob } from '../services/companyProfiles';
import { companyPageRouteForJob } from '../services/companyDirectory';
import { featuredTitle, featuredLocation, isDefaultMarketFilters, loadVerifiedFeaturedJobs } from '../services/featuredOfficialJobs';
import type { User } from '../services/api';
import { getJob, listJobs, localizedCompany, localizedLocation, localizedTitle, officialStatus, safeOfficialJobUrl,
  type Language, type LiveFilters, type LiveJob, type LivePage } from '../services/liveRecruitment';
import { fetchOfficialJd, fetchPreparedBilingualJd, type OfficialJd } from '../services/officialJd';
import { loadDomesticSummary, type DomesticSummary } from '../services/domesticJd';
import { loadPublicJobAudit, auditForJob, describeAudit, type JobAuditEntry } from '../services/jobSyncStatus';
import {countryOptions,cityOptions,parseNaturalQuery} from '../services/jobSearchFacets.mjs';
import '../styles/unified-jobs.css';

type PersistedMarketState={scope:'home'|'jobs';filters:Record<string,unknown>;draft:string;page:number};
function readMarketState(compact:boolean):PersistedMarketState|null{
 const state=history.state?.hhbaMarketState as PersistedMarketState|undefined;
 if(!state||state.scope!==(compact?'home':'jobs')||!state.filters||typeof state.filters!=='object')return null;
 if(typeof state.draft!=='string'||state.draft.length>100||!Number.isSafeInteger(state.page)||state.page<0)return null;
 return state;
}
const emptyFilters: LiveFilters={q:'',company:'',country:'',remote:false,recruitment_type:'',location_country:'',city:'',education:'',experience:''};
function initialCompanyQuery(){
 try{const company=new URLSearchParams(location.search).get('company');
   return ['OpenAI','Anthropic','SpaceX'].includes(company||'')?company!:'';
 }catch{return ''}
}
function initialJobQuery(){
  try{return new URLSearchParams(location.search).get('q')?.trim().slice(0,100)||'';}
  catch{return '';}
}
const typeLabel: Record<string,{zh:string,en:string}>={SOCIAL:{zh:'社会招聘',en:'Professional'},CAMPUS:{zh:'校园招聘',en:'Graduate'},INTERNSHIP:{zh:'实习招聘',en:'Internship'},SPECIAL:{zh:'专项招聘',en:'Special program'}};
const formatDate=(value?:string)=>value&&Number.isFinite(Date.parse(value)) ? value.slice(0,10) : '--';
type AiOfficialLead={company:string;title:string;url:string;official_entry:string;status:string;status_label:string;checked_at:string; evidence_quote:string};
type AiOfficialResponse={status:string;jobs:AiOfficialLead[];notice:string};
function officialDiscoveryOrigin(){
 const raw=(import.meta.env.VITE_HHBA_JOB_DISCOVERY_API_ORIGIN||'').trim();
 if(!raw)return '';
 try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash?u.origin:''}
 catch{return ''}
}
function verifiedOfficialLead(lead:AiOfficialLead){
 if(!lead||typeof lead!=='object'||typeof lead.title!=='string'||typeof lead.company!=='string'||
    typeof lead.url!=='string'||typeof lead.evidence_quote!=='string'||
    lead.status!=='OFFICIAL_PAGE_FOUND_STATUS_UNVERIFIED')return false;
 try{const u=new URL(lead.url);return u.protocol==='https:'&&!u.username&&!u.password&&lead.title.length<150}
 catch{return false}
}

function useLanguage() {
  const [lang, setLang] = useState<Language>(()=>{
    try { return sessionStorage.getItem('hhba.jobs.language')==='en'?'en':'zh'; } catch {return 'zh';}
  });
  function change(value:Language) {setLang(value);try{sessionStorage.setItem('hhba.jobs.language',value);}catch{}}
  return {lang,change};
}
function JobCard({job,lang,asOf}:{job:LiveJob,lang:Language,asOf:string}){
  const source=safeOfficialJobUrl(job);
  const profile=companyProfileForJob(job);
  const companyRoute=companyPageRouteForJob(job);
  if(!source || (job.recordKind!=='CURATED_HISTORICAL' && officialStatus(job,asOf)!=='recent'))return null;
  return <article className="unified-job-card">
    <div className="unified-job-head">
      {profile?<Link className="unified-company-brand" to={'/companies/'+profile.slug}
        title={lang==='zh'?'查看 '+profile.name+' 企业介绍':'About '+profile.name}>
        <EmployerBrandLogo job={job}/><strong>{localizedCompany(job,lang)}</strong>
      </Link>:companyRoute?<Link className="unified-company-brand" to={companyRoute}
        title={lang==='zh'?'查看企业资料和真实岗位':'View company profile and jobs'}>
        <EmployerBrandLogo job={job}/><strong>{localizedCompany(job,lang)}</strong>
      </Link>:<span className="unified-company-brand"><EmployerBrandLogo job={job}/>
        <strong>{localizedCompany(job,lang)}</strong></span>}
      <small>{job.recordKind==='CURATED_HISTORICAL'?(lang==='zh'?'历史公开岗位 · 当前状态未核实':'Archived · Status unverified'):job.recordKind==='DOMESTIC_ARCHIVE_SNAPSHOT'?(lang==='zh'?'历史收录 · 状态待核实':'Archived · Availability unverified'):(lang==='zh'?'官方招聘':'Official opening')}</small>
    </div>
    <h3><Link to={'/candidate/jobs/'+encodeURIComponent(job.id)}>{featuredTitle(job,lang)}</Link></h3>
    <div className="unified-job-meta"><span><MapPin size={14}/>{featuredLocation(job,lang)||localizedLocation(job,lang)}</span>
      <span>{job.recruitmentType?typeLabel[job.recruitmentType]?.[lang]||job.recruitmentType:(lang==='zh'?'招聘类型待确认':'Type unverified')}</span>
      {job.remote===true&&<span>{lang==='zh'?'远程':'Remote'}</span>}</div>
    <div className="unified-job-actions"><Link to={'/candidate/jobs/'+encodeURIComponent(job.id)}>
      {lang==='zh'?'查看岗位':'View role'} <ArrowRight size={14}/></Link><SaveJobButton jobId={job.id}/></div>
  </article>;
}
function LanguageSwitcher({lang,change}:{lang:Language,change:(value:Language)=>void}){
 return <div className="unified-lang" aria-label="Language">
   <button type="button" aria-pressed={lang==='zh'} onClick={()=>change('zh')}>中文</button>
   <button type="button" aria-pressed={lang==='en'} onClick={()=>change('en')}>English</button></div>;
}
export function UnifiedJobMarket({compact=false,user=null}:{compact?:boolean,user?:User|null}){
  const curatedHundred=import.meta.env.VITE_HHBA_CURATED_STATIC==='1';
  const domesticOnly=import.meta.env.VITE_HHBA_DOMESTIC_STATIC_ONLY==='1';
  const officialThree=import.meta.env.VITE_HHBA_OFFICIAL_THREE_ONLY==='1';
  const {lang,change}=useLanguage();
  const [filters,setFilters]=useState<LiveFilters>(()=>{
    const previous=readMarketState(compact);
    const saved=previous?.filters.company;
    return {...emptyFilters,...previous?.filters,
      q:previous?.draft??initialJobQuery(),
      company:typeof saved==='string'&&saved.length<=100?saved:initialCompanyQuery()};
  });
  const [selectedMajor,setSelectedMajor]=useState(()=>{
    try{const saved=sessionStorage.getItem('hhba.company.major')||'';return saved&&majorById(saved)?saved:''}catch{return ''}
  });
  const selectMajor=(slug:string)=>{
    setSelectedMajor(slug);
    try{if(slug)sessionStorage.setItem('hhba.company.major',slug);else sessionStorage.removeItem('hhba.company.major')}catch{}
  };
  const [draft,setDraft]=useState(()=>readMarketState(compact)?.draft??initialJobQuery());
  const [page,setPage]=useState(()=>readMarketState(compact)?.page??0);
  const [snapshot,setSnapshot]=useState<LivePage|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [retry,setRetry]=useState(0);
  const aiOrigin=useMemo(officialDiscoveryOrigin,[]);
  const [aiAvailable,setAiAvailable]=useState(false);
  const [aiConsent,setAiConsent]=useState(false);
  const [aiBusy,setAiBusy]=useState(false);
  const [aiError,setAiError]=useState('');
  const [aiEvidence,setAiEvidence]=useState<AiOfficialResponse|null>(null);
  useEffect(()=>{
    if(!aiOrigin)return;
    const ctrl=new AbortController();
    fetch(aiOrigin+'/api/v1/official-job-discovery/status',{signal:ctrl.signal,credentials:'omit',cache:'no-store'})
      .then(r=>r.ok?r.json():Promise.reject(Error('unavailable')))
      .then(data=>{if(!ctrl.signal.aborted)setAiAvailable(data.enabled===true)})
      .catch(()=>{if(!ctrl.signal.aborted)setAiAvailable(false)});
    return()=>ctrl.abort();
  },[aiOrigin]);
  async function aiFindOfficialJobs(){
    if(!aiAvailable||aiBusy)return;
    if(!aiConsent){setAiError('使用 AI 联网检索前，请先同意发送本次求职描述。');return}
    if(draft.trim().length<5){setAiError('请先在上方搜索框中补充学历、专业、经历或岗位方向。');return}
    setAiError('');setAiEvidence(null);setAiBusy(true);
    try{
      const response=await fetch(aiOrigin+'/api/v1/official-job-discovery',{
        method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({query:draft.trim(),consent:true})});
      if(!response.ok)throw Error(response.status===429?'今日 AI 搜索额度已用完。':'DeepSeek 搜索暂时不可用。');
      const data=await response.json() as AiOfficialResponse;
      if(data.status!=='COMPLETE'||!Array.isArray(data.jobs))throw Error('搜索结果不完整');
      setAiEvidence({...data,jobs:data.jobs.filter(verifiedOfficialLead)});
    }catch(error){setAiError(error instanceof Error?error.message:'联网检索失败');}
    finally{setAiBusy(false)}
  }
  const [featured,setFeatured]=useState<LiveJob[]|null>(null);
  const [featuredError,setFeaturedError]=useState('');
  useEffect(()=>{const id=setTimeout(()=>{setPage(0);setFilters(f=>({...f,q:draft,education:f.education==='UNRESTRICTED_OR_UNREPORTED'?'':f.education}));},280);return()=>clearTimeout(id)},[draft]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    listJobs(filters,page*30,controller.signal)
      .then(data=>{if(!controller.signal.aborted)setSnapshot(data)})
      .catch(e=>{if(!controller.signal.aborted){setError(e instanceof Error?e.message:'读取失败');setSnapshot(null)}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[filters,page,retry]);
  useEffect(()=>{
    const state={scope:compact?'home' as const:'jobs' as const,filters,draft,page};
    const previous=history.state&&typeof history.state==='object'?history.state:{};
    history.replaceState({...previous,hhbaMarketState:state},'');
  },[compact,filters,draft,page]);
  const defaultView=isDefaultMarketFilters(filters,page);
  useEffect(()=>{
    if(officialThree||domesticOnly||curatedHundred){setFeatured([]);setFeaturedError('');return;}
    if(!defaultView){setFeatured(null);setFeaturedError('');return;}
    const controller=new AbortController();
    setFeatured(null);setFeaturedError('');
    // Verification must never leave the job market stuck on a spinner.
    // The normal audited market remains available if the curated set is slow.
    const guard=setTimeout(()=>{
      if(!controller.signal.aborted){
        controller.abort();
        setFeaturedError('精选岗位核验超时，已切换至其他近期核验职位');
      }
    },6500);
    loadVerifiedFeaturedJobs(controller.signal)
      .then(verified=>{if(!controller.signal.aborted)setFeatured(verified)})
      .catch(e=>{if(!controller.signal.aborted)setFeaturedError(
        e instanceof Error?e.message:'精选企业岗位暂时不可用')})
      .finally(()=>clearTimeout(guard));
    return ()=>{clearTimeout(guard);controller.abort()};
  },[defaultView,retry]);
  const eligible=useMemo(()=>snapshot?.jobs.filter(j=>j.recordKind==='CURATED_HISTORICAL'||officialStatus(j,snapshot.updated)==='recent')||[],[snapshot]);
  // Only the UNFILTERED first page gets six highlighted jobs. Search,
  // company/city filtering and all other pages retain their normal results.
  const curatedIds=new Set(featured?.map(j=>j.id)||[]);
  const shown=curatedHundred?(compact?eligible.slice(0,6):eligible):officialThree?(compact?eligible.slice(0,6):eligible):domesticOnly?(compact?eligible.slice(0,8):eligible):defaultView
    ?(featured ? (compact?featured:[...featured,...eligible.filter(j=>!curatedIds.has(j.id)).slice(0,24)])
      : featuredError ? (compact?eligible.slice(0,8):eligible) : [])
    :(compact?eligible.slice(0,8):eligible);
  const featuredPending=defaultView && !curatedHundred && !officialThree && !domesticOnly && !featured && !featuredError;
  const interpreted=useMemo(()=>parseNaturalQuery(filters.q),[filters.q]);
  const roleNames:Record<string,string>={software:'软件工程师',sales:'销售',engineer:'工程师',product:'产品经理',intern:'实习',design:'设计',finance:'财务',marketing:'市场营销',operations:'运营'};
  const intentLabels=[
    filters.company&&(lang==='zh'?'企业：':'Company: ')+filters.company,
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
    <MajorFilter value={selectedMajor} onChange={selectMajor} lang={lang}/>
    <label className="unified-job-remote"><input type="checkbox" checked={filters.remote}
      onChange={e=>{setPage(0);setFilters(f=>({...f,remote:e.target.checked}))}}/>
      {lang==='zh'?'仅远程岗位':'Remote only'}</label>
  </div>;
  const market=<section className="unified-market" aria-labelledby="unified-market-title">
    <div className="unified-market-heading"><div><small>HHBA · RECRUITMENT</small>
      <h2 id="unified-market-title">{lang==='zh'?'招聘市场':'Job market'}</h2>
      <p>{curatedHundred?(lang==='zh'?'精选 10 家知名海外企业 · 100 条已存档岗位（状态待核实）':'100 archived roles from 10 companies; current availability unverified.'):officialThree?(lang==='zh'?'OpenAI、Anthropic、SpaceX 官方公开招聘 · 只展示本次从招聘系统核验到的职位，随时可能变化':'OpenAI, Anthropic and SpaceX public ATS listings · Verified at latest sync'):domesticOnly?(lang==='zh'?'国内历史招聘岗位静态测试 · 岗位状态以企业官网为准':'Historical China listings preview · Check employer for availability'):lang==='zh'?'国内外岗位统一搜索，与应聘页面共享同一套职位数据。':'One job index shared by the homepage and candidate pages.'}</p></div>
      <LanguageSwitcher lang={lang} change={change}/></div>
    {controls}
    {!curatedHundred&&aiAvailable&&<div className="unified-ai-discovery">
      <label><input type="checkbox" checked={aiConsent} onChange={e=>setAiConsent(e.target.checked)}/>
        同意将本次搜索描述发送给 DeepSeek 联网查找国内招聘官网；请勿输入身份证等敏感资料。</label>
      <button type="button" disabled={aiBusy} onClick={aiFindOfficialJobs}>
        {aiBusy?'正在查找官网…':'AI 联网找国内岗位'} <Search size={14}/></button>
    </div>}
    {aiError&&<p className="unified-job-state" role="alert">{aiError}</p>}
    {aiEvidence&&<section className="unified-ai-results" aria-label="DeepSeek 官网招聘线索">
      <div className="unified-market-heading"><div><h2>国内官方招聘线索</h2>
        <p>以下仅为 DeepSeek 在企业招聘官网发现的具体岗位页面，<strong>当前是否仍可投递需要进入官网核实</strong>。</p></div></div>
      <div className="unified-job-grid">
      {aiEvidence.jobs.map(job=><article className="unified-job-card" key={job.url}>
        <div className="unified-job-head"><span className="unified-company-brand">
          <strong>{job.company}</strong></span><small>官方页面 · 开放状态待核实</small></div>
        <h3>{job.title}</h3><p className="unified-ai-quote">{job.evidence_quote}</p>
        <div className="unified-job-actions"><a data-hhba-recruitment-outbound="true" href={job.url} target="_blank" rel="noopener noreferrer">
          前往官网核对 <ExternalLink size={14}/></a></div>
      </article>)}
      </div>
      {aiEvidence.jobs.length===0&&<p className="unified-job-state">暂未检索到具备可核对原文证据的岗位；不会提供虚构的职位。</p>}
    </section>}
    <div className="unified-company-discovery-navigation" style={{margin:'18px auto 8px',maxWidth:1120,display:'flex',justifyContent:'flex-end'}}><Link to="/companies/discover" style={{fontSize:13,color:'#265e45',fontWeight:700,textDecoration:'none'}}>浏览全部 200 家企业档案 →</Link></div>
    {!curatedHundred&&<DomesticCompanyResults query={draft} majorSlug={selectedMajor}
      scope={filters.country} country={filters.location_country||''}
      city={cityOptions.find(c=>c.value===filters.city)?.zh||''}/>}
    {intentLabels.length>0&&<div className="unified-search-interpreted">
      {lang==='zh'?'搜索条件已识别：':'Recognized filters: '}{intentLabels.join(' · ')}
      {filters.company&&<button className="unified-company-filter-clear" type="button"
        onClick={()=>{setPage(0);setFilters(f=>({...f,company:''}))}}>
        {lang==='zh'?'清除企业筛选':'Clear company filter'} ×
      </button>}
    </div>}
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
    {(loading||featuredPending)?<p className="unified-job-state" role="status">{lang==='zh'
      ?(featuredPending?'正在核验六个精选企业岗位…':'正在读取真实岗位…')
      :(featuredPending?'Verifying six highlighted official jobs…':'Loading jobs…')}</p>:
      error?<div className="unified-job-state" role="alert">{lang==='zh'?error:'Jobs temporarily unavailable. Please retry.'}<button type="button" onClick={()=>setRetry(x=>x+1)}><RefreshCcw size={15}/> {lang==='zh'?'重试':'Retry'}</button></div>:
      shown.length?<div className="unified-job-grid">{shown.map(job=><JobCard key={job.id} job={job} lang={lang} asOf={snapshot!.updated}/>)}</div>:
        <div className="unified-job-state">{domesticOnly?(lang==='zh'?'当前没有符合条件的历史岗位。':'No matching archived jobs.'):lang==='zh'?'当前没有通过近期核验的岗位，请尝试其他筛选条件。':'No recently observed jobs match your filters.'}</div>}
    {!curatedHundred&&!domesticOnly&&!loading&&defaultView&&featuredError&&
      <div className="unified-featured-fallback" role="status">
        <span>{lang==='zh'?'六个精选岗位未能及时完成最新核验，当前显示其他近期核验的真实职位。':
          'Featured verification is delayed; showing other recently audited jobs.'}</span>
        <button type="button" onClick={()=>setRetry(x=>x+1)}>
          <RefreshCcw size={14}/>{lang==='zh'?'重试精选':'Retry featured'}
        </button>
      </div>}
    <div className="unified-job-footer">
      <span>{lang==='zh'? `共匹配 ${snapshot?.total.toLocaleString()||0} 条 · 本页 ${eligible.length} 条 · 来源更新时间：${formatDate(snapshot?.updated)}`
        : `${snapshot?.total.toLocaleString()||0} matching jobs · ${eligible.length} on this page · Updated ${formatDate(snapshot?.updated)}`}</span>
      {compact?<div className="unified-job-browse-links">
         <Link to="/companies">{lang==='zh'?'浏览企业资料库':'Browse companies'} <ArrowRight size={15}/></Link>
         <Link to="/candidate/jobs">{lang==='zh'?'查看完整招聘市场':'Browse all jobs'} <ArrowRight size={15}/></Link>
       </div>:
        <div className="unified-job-paging">
          <button type="button" disabled={page===0||loading} onClick={()=>setPage(x=>x-1)}>{lang==='zh'?'上一页':'Previous'}</button>
          <span>{page+1}</span>
          <button type="button" disabled={loading||!snapshot||((page+1)*30>=snapshot.total)} onClick={()=>setPage(x=>x+1)}>{lang==='zh'?'下一页':'Next'}</button>
        </div>}
    </div>
    {!compact && <p className="unified-job-history">{lang==='zh'?'了解企业或查阅历史岗位资料：':'Explore companies and historical records: '}
      <Link to="/companies">{lang==='zh'?'企业资料库':'Company directory'}</Link>{' · '}
      <Link to="/candidate/jobs/archive">{lang==='zh'?'历史岗位记录':'Historical jobs'}</Link>
       {' · '}<Link to="/candidate/employer-jobs">{lang==='zh'?'经认证企业自行发布的岗位':'Employer-submitted jobs (separate from official ATS)'}</Link></p>}
  </section>;
  // The existing market is the ONE search surface; never overlay a second AI UI.
  return compact?market:<Shell user={user}>{market}</Shell>;
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
 const [domesticSummary,setDomesticSummary]=useState<DomesticSummary|null>(null);
 const [domesticSummaryError,setDomesticSummaryError]=useState('');
 const [chineseJd,setChineseJd]=useState('');
 const [translationPrepared,setTranslationPrepared]=useState(false);
 const [translateError,setTranslateError]=useState('');

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
   setDomesticSummary(null);setDomesticSummaryError('');
   if(!job||job.recordKind!=='DOMESTIC_ARCHIVE_SNAPSHOT')return;
   const controller=new AbortController();
   loadDomesticSummary(job,controller.signal).then(value=>{
     if(!controller.signal.aborted)setDomesticSummary(value);
   }).catch(err=>{
     if(!controller.signal.aborted)setDomesticSummaryError(err instanceof Error?err.message:'历史职责读取失败');
   });
   return ()=>controller.abort();
 },[job]);
 useEffect(()=>{
   if(!job||job.recordKind==='CURATED_HISTORICAL')return;
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
   setJd(null);setChineseJd('');setTranslateError('');
   setTranslationPrepared(false);setJdError('');setJdLoading(true);
   // Campus summaries have a reviewed source URL; do not trigger the overseas ATS JD reader.
   if(job.recordKind==='CURATED_HISTORICAL'||job.domestic&&job.recordKind==='DOMESTIC_ARCHIVE_SNAPSHOT'){setJdLoading(false);return;}
   if(job.graduationYear===2027&&job.recordKind==='OFFICIAL_JOB_PAGE_OBSERVED'&&
      job.responsibilitiesSummary&&job.requirementsSummary){setJdLoading(false);return;}
   (async()=>{
     const prepared=await fetchPreparedBilingualJd(job,controller.signal);
     if(prepared){
       if(!controller.signal.aborted){
         setJd(prepared.jd);
         setChineseJd(prepared.chinese||'');
         setTranslationPrepared(prepared.ready);
       }
       return;
     }
     // Unprepared postings remain readable in official English. No user-side MT.
     const english=await fetchOfficialJd(job,controller.signal);
     if(!controller.signal.aborted){
       setJd(english);
       setTranslateError('中文完整译文正在后台准备，请使用 English 先阅读官方原文。');
     }
   })().catch(e=>{
     if(!controller.signal.aborted)setJdError(e instanceof Error?e.message:'职位原文暂不可用');
   }).finally(()=>{if(!controller.signal.aborted)setJdLoading(false)});
   return()=>controller.abort();
 },[job,jdRetry]);
 const official=job?safeOfficialJobUrl(job):null;
 const companyProfile=job?companyProfileForJob(job):null;
 const generalCompanyRoute=job?companyPageRouteForJob(job):null;
 const segmentName:Record<string,{zh:string,en:string}>={
   responsibilities:{zh:'岗位职责',en:'Responsibilities'},
   requirements:{zh:'任职资格与技术要求',en:'Requirements and skills'},
   benefits:{zh:'薪资福利',en:'Benefits and compensation'},
   other:{zh:'其他职位说明',en:'Other job information'}
 };
 const sections=jd ? ['responsibilities','requirements','benefits','other'].map(kind=>({
   kind,blocks:jd.blocks.filter(item=>item.section===kind)
 })).filter(group=>group.blocks.length>0):[];
 const returnTarget=getJobReturnTarget();
 return <Shell user={user}><div className="unified-detail">
   <div className="unified-market-heading"><Link to={returnTarget.to} restoreScrollY={returnTarget.scrollY} restoreMarketState={returnTarget.marketState}>
        ← {lang==='zh'?'返回上一页':'Back to previous page'}</Link>
     <LanguageSwitcher lang={lang} change={change}/></div>
   {error?<p className="unified-job-state" role="alert">{lang==='zh'?error:'Job details unavailable.'}</p>:!job?<p className="unified-job-state">
     {lang==='zh'?'正在读取官方岗位信息…':'Loading official job details…'}</p>:
   <article className="unified-detail-card">
     <div className="unified-detail-employer">
       {companyProfile?<Link to={'/companies/'+companyProfile.slug}
         className="unified-detail-company-link"
         title={lang==='zh'?'查看企业介绍':'View company profile'}>
         <EmployerBrandLogo job={job}/><small>{localizedCompany(job,lang)}</small>
         <ArrowRight size={14}/>
       </Link>:generalCompanyRoute?<Link to={generalCompanyRoute}
         className="unified-detail-company-link"
         title={lang==='zh'?'查看企业资料':'View company information'}>
         <EmployerBrandLogo job={job}/><small>{localizedCompany(job,lang)}</small>
         <ArrowRight size={14}/>
       </Link>:<><EmployerBrandLogo job={job}/><small>{localizedCompany(job,lang)}</small></>}
     </div>
     <h1>{featuredTitle(job,lang)}</h1>
     <p><MapPin size={15}/>{localizedLocation(job,lang)}</p>
     <div className="unified-detail-warning"><ShieldCheck size={17}/>
       {job.recordKind==='CURATED_HISTORICAL'?(lang==='zh'?'精选海外历史岗位资料 · 招聘状态尚未重新核实':'Archived overseas role · Current status unverified'):job.recordKind==='DOMESTIC_ARCHIVE_SNAPSHOT'?(lang==='zh'?`历史收录：${formatDate(job.observedAt)}。招聘状态尚未重新核实，以企业官网为准。`:`Archived on ${formatDate(job.observedAt)}. Application status unverified.`):lang==='zh'?'正在核对企业官方职位内容。最新投递状态以官网为准。':
         'Checking the employer’s published job details. Confirm application availability on the official site.'}</div>
     {audit && <p className="unified-job-audit"><ShieldCheck size={16}/>
       {describeAudit(audit.status,lang)}
       {audit.official_checked_at && <small>{lang==='zh'?'核验：':'Checked: '}{audit.official_checked_at.slice(0,10)}</small>}
     </p>}
     <h2>{lang==='zh'?'职位说明与任职要求':'Description and job requirements'}</h2>
     {job.recordKind==='CURATED_HISTORICAL'?<div className="unified-jd-content">
        <p className="unified-jd-source">{lang==='zh'?'岗位资料快照：':'Archived job snapshot: '}{formatDate(job.observedAt)}</p>
        {job.editorial?<>
          <p className="unified-jd-machine-notice">{lang==='zh'?
            '以下为根据公开招聘资料整理的中文说明，不是官网逐字或逐段完整译文；部分历史链接可能已更新，请以企业官网为准。':
            'Editorial summary based on the employer listing, not a verbatim reproduction.'}</p>
          {lang==='zh'?<>
            <section className="unified-jd-section"><h3>职位介绍</h3><p>{job.editorial.overview}</p></section>
            <section className="unified-jd-section"><h3>工作职责</h3>{job.editorial.responsibilities.map((item,i)=><p className="unified-jd-bullet" key={i}>{item}</p>)}</section>
            <section className="unified-jd-section"><h3>任职要求</h3>{job.editorial.requirements.map((item,i)=><p className="unified-jd-bullet" key={i}>{item}</p>)}</section>
            {!!job.editorial.benefits.length&&<section className="unified-jd-section"><h3>薪资福利及工作方式</h3>{job.editorial.benefits.map((item,i)=><p className="unified-jd-bullet" key={i}>{item}</p>)}</section>}
          </>:<section className="unified-jd-section"><h3>Verified English overview</h3><p>{job.editorial.originalSummary}</p>
            <p>The complete original English requirements are available on the employer page; HHBA does not reprint them here.</p></section>}
          <p className="unified-jd-source">{lang==='zh'?'来源核对日期：':'Source checked: '}{job.editorial.sourceVerifiedAt}</p>
        </>:<div className="unified-jd-empty" role="status">
          <p>{lang==='zh'?'已保存真实岗位的中文标题、地点和官网链接。完整职责与任职要求尚未取得可核实的整理内容。':'The role title, location and official link are saved. Detailed requirements are not yet verified.'}</p>
          <small>{lang==='zh'?'不会根据职位名称编造工作内容。':'No requirements are invented from the job title.'}</small>
        </div>}
        {(job.educationLabel||job.experienceLabel||!!job.skillSignals?.length)&&<section className="unified-jd-section">
          <h3>{lang==='zh'?'历史提取线索（可能不完整）':'Extracted archival clues (possibly incomplete)'}</h3>
          {job.educationLabel&&<p>{lang==='zh'?'学历：':'Education: '}{job.educationLabel}</p>}
          {job.experienceLabel&&<p>{lang==='zh'?'经验：':'Experience: '}{job.experienceLabel}</p>}
          {!!job.skillSignals?.length&&<p>{lang==='zh'?'技能：':'Skills: '}{job.skillSignals.join('、')}</p>}
        </section>}
        {official&&<a data-hhba-recruitment-outbound="true" href={official} target="_blank" rel="noopener noreferrer">{lang==='zh'?'查看官方原始岗位':'Original employer listing'} <ExternalLink size={14}/></a>}
      </div>:
      job.recordKind==='DOMESTIC_ARCHIVE_SNAPSHOT'?<div className="unified-jd-content">
       <p className="unified-jd-source">{lang==='zh'?'历史采集日期：':'Archived on: '}{formatDate(job.observedAt)}</p>
       <p className="unified-jd-machine-notice">{lang==='zh'?
         '以下是 HHBA 历史采集整理的岗位摘要，不是完整官方 JD 原文，也未重新确认招聘状态；内容来源及公开使用仍待复核，请以企业官网为准。':
         'HHBA archival paraphrase, not the full official JD. Content rights and application status remain unverified.'}</p>
       {lang==='zh'?(domesticSummary?<>
         <section className="unified-jd-section"><h3>岗位职责（历史整理）</h3><p>{domesticSummary.responsibilities}</p></section>
         <section className="unified-jd-section"><h3>任职要求（历史整理）</h3><p>{domesticSummary.requirements}</p></section>
       </>:domesticSummaryError?
         <p className="unified-jd-machine-notice" role="status">岗位职责读取失败：{domesticSummaryError}</p>:
         <p role="status">正在读取岗位职责与任职要求摘要…</p>):
         <p className="unified-jd-machine-notice">English translation is not available for this historical Chinese summary. Switch to 中文 to read the archived source summary.</p>}
       {job.educationLabel&&<section className="unified-jd-section"><h3>{lang==='zh'?'学历要求':'Education'}</h3><p>{job.educationLabel}</p></section>}
       {job.experienceLabel&&<section className="unified-jd-section"><h3>{lang==='zh'?'经验要求':'Experience'}</h3><p>{job.experienceLabel}</p></section>}
       {official&&<a data-hhba-recruitment-outbound="true" href={official} target="_blank" rel="noopener noreferrer">{lang==='zh'?'前往官网核实完整职位与投递状态':'Check full official job description and availability'} <ExternalLink size={14}/></a>}
     </div>:
     job.graduationYear===2027&&job.responsibilitiesSummary&&job.requirementsSummary?
       <div className="unified-jd-content">
         <p className="unified-jd-source">2027 届校招 · 官网职位详情已观察 · 最近核验：{formatDate(job.observedAt)}</p>
         <p className="unified-jd-machine-notice">以下为 HHBA 整理的中文要点，并非完整官方招聘原文。尚未核验该岗位目前能否提交申请，请以官网为准。</p>
         <section className="unified-jd-section"><h3>岗位职责</h3><p>{job.responsibilitiesSummary}</p></section>
         <section className="unified-jd-section"><h3>任职要求</h3><p>{job.requirementsSummary}</p></section>
         {official&&<a data-hhba-recruitment-outbound="true" href={official} target="_blank" rel="noopener noreferrer">打开企业官方职位详情，核对完整 JD 与投递状态 <ExternalLink size={14}/></a>}
       </div>:
     jdLoading?<p role="status">{lang==='zh'?'正在读取官方岗位职责及任职要求…':'Fetching current employer requirements…'}</p>:
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
           <strong>中文职位说明正在后台准备</strong>
           <p>{translateError||'尚未取得经过完整性校验的中文译文。可直接切换 English 阅读官方原文，稍后刷新页面查看中文。'}</p>
         </div>}
       </div>:null}
     <div className="unified-job-actions unified-detail-actions">
       <SaveJobButton jobId={job.id}/>
       {official&&<a data-hhba-recruitment-outbound="true" href={official} onClick={()=>trackEvent('official_apply_click','/candidate/jobs/:job')} target="_blank" rel="noopener noreferrer" aria-label={job.currentApplicationVerified===false?(lang==='zh'?'打开企业官网核实投递状态':'Check employer application status'):(lang==='zh'?'前往企业官网立即申请':'Apply on official employer website')}>
         {job.currentApplicationVerified===false?(lang==='zh'?'查看原始岗位（状态待核实）':'Check original posting'):(lang==='zh'?'立即申请':'Apply now')} <ExternalLink size={15}/></a>}
     </div>
     <p className="unified-detail-footnote">{lang==='zh'?
       '岗位职责与任职要求直接在 HHBA 白色详情页展示；尚未读取成功的内容不会被编造。申请请以企业官网为准。':
       'Original job requirements are retrieved on demand from public employer endpoints. Job availability may change.'}</p>
   </article>}
 </div></Shell>;
}
