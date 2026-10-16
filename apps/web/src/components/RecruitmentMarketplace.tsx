import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Building2, MapPin, RefreshCcw, Search, ShieldCheck } from 'lucide-react';
import { Link } from '../router';
import '../styles/recruitment-marketplace.css';

type Channel = '' | 'CAMPUS' | 'SOCIAL' | 'INTERNSHIP';
type MarketJob = {
  job_id: string;
  job_title?: string | null;
  company_display_name?: string | null;
  work_city?: string | null;
  education_min?: string | null;
  primary_recruitment_type?: string | null;
  last_verified_at?: string | null;
  published_at?: string | null;
  source_platform?: string | null;
  source_id?: string | null;
  official_detail_url?: string | null;
  application_url?: string | null;
  application_link_status?: 'VERIFIED_DIRECT' | 'OFFICIAL_DETAIL_ONLY' | 'UNAVAILABLE';
  application_verified_at?: string | null;
  application_expires_at?: string | null;
  salary_display?: string | null;
  marketplace_status: string;
  current_application_verified: boolean;
  record_kind: string;
};
type MarketResponse = {
  data_mode: string;
  all_current_application_statuses_unverified: boolean;
  total: number;
  items: MarketJob[];
};
const tags: Record<string,string> = { CAMPUS: '校园招聘', SOCIAL: '社会招聘', INTERNSHIP: '实习招聘', SPECIAL: '专项招聘' };
const channels: readonly [Channel, string][] = [['', '全部岗位'], ['CAMPUS', '校园招聘'], ['SOCIAL', '社会招聘'], ['INTERNSHIP', '实习招聘']];
const sourceUrl = '/recruitment/api/v1/marketplace';
const validId = (value: string) => /^[A-Za-z0-9_-]{1,64}$/.test(value);
const published = (value?: string | null) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0,10) : '未公开';
const readable = (value?: string | null, otherwise='未公开') =>
  typeof value === 'string' && value.trim() ? value.trim() : otherwise;
const safeOfficial = (value?: string | null) => {
  if(!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password ? url.href : null;
  } catch {return null;}
};
function MarketCard({job}: {job: MarketJob}) {
  const href = validId(job.job_id) ? '/candidate/jobs/' + encodeURIComponent(job.job_id) : null;
  const official = safeOfficial(job.official_detail_url);
  const application = job.current_application_verified === true
    && job.application_link_status === 'VERIFIED_DIRECT'
    ? safeOfficial(job.application_url) : null;
  return <article className="market-card">
    <div className="market-card-top"><span className="market-company"><Building2 size={15}/>{readable(job.company_display_name, '企业名称未披露')}</span><span className="market-source">官方来源 · {readable(job.source_platform, '平台未标注')}</span></div>
    <h3>{application ? <a href={application} target="_blank" rel="noopener noreferrer" aria-label={'直达'+readable(job.job_title)+'官方岗位投递入口'}>{readable(job.job_title, '职位未命名')} ↗</a>
      : href ? <Link to={href}>{readable(job.job_title, '职位未命名')}</Link> : readable(job.job_title, '职位未命名')}</h3>
    <div className="market-meta">
      <span className="market-type">{tags[job.primary_recruitment_type || ''] || '类型未分类'}</span>
      <span><MapPin size={13}/>{readable(job.work_city, '地点未公开')}</span>
      <span>学历 {readable(job.education_min)}</span>
      <span>薪资 {readable(job.salary_display)}</span>
    </div>
    <div className="market-card-proof"><ShieldCheck size={14}/><span>{application ? '岗位申请入口已近期核验 · 请以官网为准' : '真实官方历史记录 · 当前投递待核实'}</span></div>
    <div className="market-card-foot"><div><span>最近来源核验 {published(job.last_verified_at)}</span><span>发布时间 {published(job.published_at)}</span></div>
      <div className="market-card-links">{href && <Link to={href}>查看记录 <ArrowRight size={14}/></Link>}
        {application
          ? <a className="market-verified-apply" href={application} target="_blank" rel="noopener noreferrer">去官方投递 ↗</a>
          : official && <a href={official} target="_blank" rel="noopener noreferrer">官网核对 · 投递未确认 ↗</a>}</div></div>
  </article>;
}
export function RecruitmentMarketplace() {
  const [type,setType] = useState<Channel>('');
  const [query,setQuery] = useState('');
  const [city,setCity] = useState('');
  const [filters,setFilters] = useState({q:'',city:''});
  const [data,setData] = useState<MarketResponse|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(false);
  const [attempt,setAttempt] = useState(0);

  useEffect(()=>{
    const controller = new AbortController();
    const params = new URLSearchParams({limit:'8'});
    if(type) params.set('recruitment_type', type);
    if(filters.q) params.set('q',filters.q);
    if(filters.city) params.set('city',filters.city);
    setLoading(true);setError(false);setData(null);
    fetch(sourceUrl+'?'+params.toString(), {
      method:'GET', credentials:'omit',cache:'no-store',
      headers:{Accept:'application/json'},signal:controller.signal
    }).then(async response=>{
      if(!response.ok) throw new Error('official marketplace unavailable');
      return await response.json() as MarketResponse;
    }).then(result=>{
      if(controller.signal.aborted)return;
      if(result.data_mode !== 'official_source_historical_not_live'
        || typeof result.all_current_application_statuses_unverified !== 'boolean'
        || !Number.isInteger(result.total) || result.total < 0
        || !Array.isArray(result.items)
        || result.items.some(job=>
          job.record_kind!=='HISTORICAL_MASTER'
          || job.marketplace_status!=='OFFICIAL_HISTORICAL_UNCONFIRMED'
          || typeof job.current_application_verified !== 'boolean'
          || (job.current_application_verified === true &&
              (job.application_link_status !== 'VERIFIED_DIRECT' || !safeOfficial(job.application_url)))
          || (job.current_application_verified === false &&
              (job.application_link_status === 'VERIFIED_DIRECT' || !!job.application_url))
          || !validId(job.job_id)
          || !safeOfficial(job.official_detail_url)
          || !job.source_id || !job.job_title || !job.company_display_name
        )
      ) throw new Error('untrusted marketplace response');
      if(result.all_current_application_statuses_unverified &&
         result.items.some(job=>job.current_application_verified)) throw new Error('contradictory application status');
      setData(result);
    }).catch(()=>{
      if(!controller.signal.aborted){setError(true);setData(null);}
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[type,filters,attempt]);
  function submit(event: FormEvent) {
    event.preventDefault();
    setFilters({q:query.trim(),city:city.trim()});
  }
  return <section className="home-marketplace" aria-labelledby="marketplace-title" id="recruitment-marketplace">
    <div className="market-head">
      <div><div className="market-eyebrow"><span className="market-eyebrow-line"/> OFFICIAL RECRUITMENT RECORDS</div>
        <h2 id="marketplace-title">招聘市场</h2>
        <p>真实企业官方招聘信息，校招、社招、实习独立分类。所有岗位都标注来源，当前投递状态未核实的不冒充在招。</p>
      </div>
      <Link to="/candidate/jobs" className="market-more">进入完整岗位搜索 <ArrowRight size={16}/></Link>
    </div>
    <form className="market-search" onSubmit={submit} aria-label="搜索真实招聘记录">
      <label htmlFor="market-q">岗位或企业</label>
      <div className="market-input"><Search size={17}/><input id="market-q" maxLength={120} value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索岗位或企业名称"/></div>
      <label htmlFor="market-city">城市</label>
      <input className="market-city" id="market-city" value={city} maxLength={120} onChange={event=>setCity(event.target.value)} placeholder="城市"/>
      <button type="submit">搜索市场 <ArrowRight size={15}/></button>
    </form>
    <div className="market-channels" role="group" aria-label="招聘市场分类">
      {channels.map(([key,value])=><button key={key} type="button" aria-pressed={type===key} className={type===key?'active':''} onClick={()=>setType(key)}>{value}</button>)}
      <span className="market-total">{!loading&&!error&&data ? data.total+' 条合规公开历史记录' : '来源实时读取'}</span>
    </div>
    <div className="market-caution"><ShieldCheck size={18}/><span>这里展示的是真实官方来源的<strong>历史岗位记录</strong>，不是已确认当前在招岗位。岗位职责、专业、薪资与投递日期等未公开信息不会编造；申请前请核对官网。</span></div>
    {loading ? <div className="market-state" role="status">正在向 HHBA 招聘数据引擎读取真实岗位…</div>
      : error ? <div className="market-state" role="alert"><p>真实招聘数据暂不可用。当前不展示任何示例或假岗位。</p><button type="button" onClick={()=>setAttempt(n=>n+1)}><RefreshCcw size={15}/> 重新读取</button></div>
      : !data?.items.length ? <div className="market-state"><strong>当前没有符合筛选条件的已核对官方岗位记录</strong><p>我们不会用虚构岗位填补列表，也不会把未核验的候选标为正在招聘。</p></div>
      : <div className="market-list">{data.items.map(job=><MarketCard key={job.job_id} job={job}/>)}</div>}
    <div className="market-bottom"><span>内容以企业官方招聘系统为来源。信息未披露时直接显示“未公开”。</span><Link to="/candidate/jobs">浏览更多历史岗位 <ArrowRight size={16}/></Link></div>
  </section>;
}
