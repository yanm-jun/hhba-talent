import { useEffect, useState } from 'react';
import { JobFilterPanel, emptyJobFilters, filtersToQuery, type JobFilterSelection } from './JobFilterPanel';
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
  official_list_url?: string | null;
  application_url?: string | null;
  application_link_status?: 'VERIFIED_DIRECT' | 'OFFICIAL_DETAIL_ONLY' | 'UNAVAILABLE';
  application_verified_at?: string | null;
  application_expires_at?: string | null;
  salary_display?: string | null;
  marketplace_status: string;
  current_application_verified: boolean;
  record_kind: string;
  source_review_status?: string | null;
};
type MarketResponse = {
  data_mode: string;
  all_current_application_statuses_unverified: boolean;
  staging_notice?: string;
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
  const listOnly = job.record_kind === 'OFFICIAL_LIST_OBSERVED';
  const stagingOnly = job.record_kind === 'ATS_STAGING_PREVIEW';
  const officialATS = job.record_kind === 'ATS_OFFICIAL_METADATA';
  const listUrl = listOnly ? safeOfficial(job.official_list_url) : null;
  const application = job.current_application_verified === true
    && job.application_link_status === 'VERIFIED_DIRECT'
    ? safeOfficial(job.application_url) : null;
  return <article className="market-card">
    <div className="market-card-top"><span className="market-company"><Building2 size={15}/>{readable(job.company_display_name, '企业名称未披露')}</span><span className="market-source">官方来源 · {readable(job.source_platform, '平台未标注')}</span></div>
    <h3>{officialATS && href ? <Link to={href}>{readable(job.job_title, '职位未命名')}</Link>
      : application ? <a data-hhba-recruitment-outbound="true" href={application} target="_blank" rel="noopener noreferrer" aria-label={'直达'+readable(job.job_title)+'官方岗位投递入口'}>{readable(job.job_title, '职位未命名')} ↗</a>
      : href ? <Link to={href}>{readable(job.job_title, '职位未命名')}</Link> : readable(job.job_title, '职位未命名')}</h3>
    <div className="market-meta">
      <span className="market-type">{tags[job.primary_recruitment_type || ''] || '类型未分类'}</span>
      <span><MapPin size={13}/>{readable(job.work_city, '地点未公开')}</span>
      <span>学历 {readable(job.education_min)}</span>
      <span>薪资 {readable(job.salary_display)}</span>
    </div>
    <div className="market-card-proof"><ShieldCheck size={14}/><span>{stagingOnly ? '内部验收数据 · 来源归属与发布权限待审核' : officialATS ? '招聘板来源已审核 · 最近完整快照已同步 · 具体申请状态以官网为准' : application ? '岗位申请入口已近期核验 · 请以官网为准' : listOnly ? '官方真实岗位列表已采集 · 详情及投递待核实' : '真实官方历史记录 · 当前投递待核实'}</span></div>
    <div className="market-card-foot"><div><span>最近来源核验 {published(job.last_verified_at)}</span><span>发布时间 {published(job.published_at)}</span></div>
      <div className="market-card-links">{href && <Link to={href}>{officialATS?"站内查看职位详情":"查看记录"} <ArrowRight size={14}/></Link>}
        {application
          ? <a data-hhba-recruitment-outbound="true" className="market-verified-apply" href={application} target="_blank" rel="noopener noreferrer">去官方投递 ↗</a>
          : listOnly && listUrl
            ? <a data-hhba-recruitment-outbound="true" href={listUrl} target="_blank" rel="noopener noreferrer">查看企业招聘频道 · 非岗位直达 ↗</a>
            : official && <a data-hhba-recruitment-outbound="true" href={official} target="_blank" rel="noopener noreferrer">{officialATS ? '企业官方岗位详情 · 查看要求 ↗' : '官网核对 · 投递未确认 ↗'}</a>}</div></div>
  </article>;
}
export function RecruitmentMarketplace() {
  const [filters,setFilters] = useState<JobFilterSelection>(emptyJobFilters);
  const [data,setData] = useState<MarketResponse|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(false);
  const [attempt,setAttempt] = useState(0);

  useEffect(()=>{
    const controller = new AbortController();
    const params = new URLSearchParams({limit:'8'});
    filtersToQuery(filters).forEach((value,key)=>params.set(key,value));
    setLoading(true);setError(false);setData(null);
    fetch(sourceUrl+'?'+params.toString(), {
      method:'GET', credentials:'omit',cache:'no-store',
      headers:{Accept:'application/json'},signal:controller.signal
    }).then(async response=>{
      if(!response.ok) throw new Error('official marketplace unavailable');
      return await response.json() as MarketResponse;
    }).then(result=>{
      if(controller.signal.aborted)return;
      const stagingMode = result.data_mode === 'official_source_staging_only';
      const localPreviewHost = typeof window !== 'undefined' &&
        ['localhost','127.0.0.1','::1','[::1]'].includes(window.location.hostname);
      if((result.data_mode !== 'official_source_historical_not_live' && !(stagingMode && localPreviewHost))
        || typeof result.all_current_application_statuses_unverified !== 'boolean'
        || !Number.isInteger(result.total) || result.total < 0
        || !Array.isArray(result.items)
        || result.items.some(job=>
          !((job.record_kind==='HISTORICAL_MASTER' && job.marketplace_status==='OFFICIAL_HISTORICAL_UNCONFIRMED') ||
            (job.record_kind==='ATS_OFFICIAL_METADATA' &&
              job.marketplace_status==='ATS_METADATA_SOURCE_REVIEWED' &&
              job.current_application_verified===false && !job.application_url &&
              !!safeOfficial(job.official_detail_url)) ||
            (job.record_kind==='OFFICIAL_LIST_OBSERVED' && job.marketplace_status==='OFFICIAL_LIST_UNCONFIRMED') ||
            (stagingMode && localPreviewHost && job.record_kind==='ATS_STAGING_PREVIEW' &&
              job.marketplace_status==='STAGING_SOURCE_REVIEW_REQUIRED' &&
              job.source_review_status==='NOT_APPROVED_FOR_PUBLICATION' &&
              job.current_application_verified===false && !job.application_url &&
              !!safeOfficial(job.official_detail_url)))
          || typeof job.current_application_verified !== 'boolean'
          || (job.current_application_verified === true &&
              (job.application_link_status !== 'VERIFIED_DIRECT' || !safeOfficial(job.application_url)))
          || (job.current_application_verified === false &&
              (job.application_link_status === 'VERIFIED_DIRECT' || !!job.application_url))
          || !validId(job.job_id)
          || (job.record_kind==='HISTORICAL_MASTER' && !safeOfficial(job.official_detail_url))
          || (job.record_kind==='OFFICIAL_LIST_OBSERVED' &&
              (!safeOfficial(job.official_list_url) || !!job.official_detail_url ||
                job.current_application_verified!==false || !!job.application_url))
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
  },[filters,attempt]);
  return <section className="home-marketplace" aria-labelledby="marketplace-title" id="recruitment-marketplace">
    <div className="market-head">
      <div><div className="market-eyebrow"><span className="market-eyebrow-line"/> OFFICIAL RECRUITMENT RECORDS</div>
        <h2 id="marketplace-title">统一招聘市场</h2>
        <p>国内外企业官方岗位统一展示，不拆分中国与全球岗位库。你可以搜索岗位、企业和城市，也可以按校招、社招或实习筛选；投递状态未核实的岗位不会冒充正在招聘。</p>
      </div>
      <Link to="/candidate/jobs" className="market-more">进入完整岗位搜索 <ArrowRight size={16}/></Link>
    </div>
    {data?.data_mode === 'official_source_staging_only' && <div className="market-staging-notice" role="alert"><ShieldCheck size={18}/><span>{data.staging_notice || '内部验收预览：ATS 来源与发布权限尚未人工审核，禁止作为公网正式数据发布。'}</span></div>}
    <JobFilterPanel value={filters} onChange={setFilters}/>
    <div className="market-channels" aria-label="当前查询的岗位数量"><span className="market-total">{!loading&&!error&&data ? data.total+(data.data_mode === 'official_source_staging_only' ? ' 条内部 ATS 预览记录' : ' 条官方岗位记录') : '读取真实数据'}</span></div>
    <div className="market-caution"><ShieldCheck size={18}/><span>这里包括真实企业官方列表采集记录与历史岗位，<strong>均不代表已确认当前在招</strong>。岗位职责、专业、薪资与投递日期等未公开信息不会编造；申请前请核对官网。</span></div>
    {loading ? <div className="market-state" role="status">正在向 HHBA 招聘数据引擎读取真实岗位…</div>
      : error ? <div className="market-state" role="alert"><p>真实招聘数据暂不可用。当前不展示任何示例或假岗位。</p><button type="button" onClick={()=>setAttempt(n=>n+1)}><RefreshCcw size={15}/> 重新读取</button></div>
      : !data?.items.length ? <div className="market-state"><strong>当前没有符合筛选条件的已核对官方岗位记录</strong><p>我们不会用虚构岗位填补列表，也不会把未核验的候选标为正在招聘。</p></div>
      : <div className="market-list">{data.items.map(job=><MarketCard key={job.job_id} job={job}/>)}</div>}
    <div className="market-bottom"><span>内容以企业官方招聘系统为来源。信息未披露时直接显示“未公开”。</span><Link to="/candidate/jobs">浏览更多历史岗位 <ArrowRight size={16}/></Link></div>
  </section>;
}
