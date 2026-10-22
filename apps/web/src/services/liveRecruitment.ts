// One source and one public-job identity for the home market and candidate market.
import {loadPublicJobAudit} from './jobSyncStatus';
import {searchJobs, type SearchFacet} from './jobSearchFacets.mjs';
import {loadOfficialSearchFacets} from './officialSearchIndex';
export type Language = 'zh' | 'en';
export type LiveJob = {
  id: string; company: string; companyZh?: string; title: string; titleZh?: string;
  titleStatus?: string; location?: string; locationZh?: string; platform?: string;
  source?: string; url: string; domestic?: boolean; remote?: boolean | null;
  recruitmentType?: string; observedAt?: string; recordKind?: string;
  currentApplicationVerified?: boolean;
  graduationYear?: number; responsibilitiesSummary?: string; requirementsSummary?: string;
  educationLabel?: string; experienceLabel?: string;
};
export type LiveFilters = {
  q: string; company: string; country: '' | 'cn' | 'global'; remote: boolean;
  recruitment_type: '' | 'REGULAR' | 'SOCIAL' | 'CAMPUS' | 'INTERNSHIP';
  location_country?: string; city?: string; education?: string; experience?: string;
};
export type LivePage = {
  jobs: LiveJob[]; total: number; limit: number; offset: number;
  updated: string; boards: number; failures: number;
};
export type LiveDetail = {
  job: LiveJob; description?: string | null; richHtml?: string | null;
  applyUrl?: string | null; recordKind?: string;
};
const PREFIX = '/live-recruitment';
const safeId = (v: string) => /^[A-Za-z0-9_-]{1,180}$/.test(v);
const allowedHost: Record<string,string[]> = {
  ashby: ['jobs.ashbyhq.com'],
  greenhouse: ['boards.greenhouse.io','boards.eu.greenhouse.io','job-boards.greenhouse.io'],
  lever: ['jobs.lever.co','jobs.eu.lever.co'],
};
const BRANDED_GREENHOUSE:Record<string,{host:string;path:string}>={
 stripe:{host:'stripe.com',path:'/jobs/search'},
 coinbase:{host:'www.coinbase.com',path:'/careers/positions/'},
 airbnb:{host:'careers.airbnb.com',path:'/positions/'},
 databricks:{host:'databricks.com',path:'/company/careers/open-positions/job'}
};
export function safeOfficialJobUrl(job: LiveJob) {
  try {
    const u = new URL(job.url);
    if(u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if (!job.domestic) {
      const hosts = allowedHost[String(job.platform||'').toLowerCase()] || [];
      const standard=hosts.includes(u.hostname) && u.pathname.split('/').includes(job.source||'');
      const branded=job.platform==='greenhouse'?BRANDED_GREENHOUSE[job.source||'']:null;
      const prefix='greenhouse-'+job.source+'-';
      const native=job.id.startsWith(prefix)?job.id.slice(prefix.length):'';
      const corporate=!!branded && /^[0-9]{5,20}$/.test(native) && u.hostname===branded.host &&
        (branded.path.endsWith('/')?u.pathname.startsWith(branded.path):u.pathname===branded.path) &&
        u.searchParams.get('gh_jid')===native;
      if(!standard&&!corporate)return null;
    } else {
      const domesticHosts: Record<string,string> = {
        'xiaomi-official': 'xiaomi.jobs.f.mioffice.cn',
        'meituan-official': 'zhaopin.meituan.com',
        'tencent-official': 'careers.tencent.com',
        'baidu-official': 'talent.baidu.com'
      };
      if (u.hostname !== domesticHosts[job.platform || '']) return null;
    }
    return u.href;
  } catch { return null; }
}
export function officialStatus(job: LiveJob, updated: string) {
  if (!safeOfficialJobUrl(job) || !safeId(job.id)) return 'invalid' as const;
  if (!job.domestic) {
    const observed = Date.parse(updated);
    if (!Number.isFinite(observed) || Math.abs(Date.now() - observed) > 24 * 60 * 60_000) return 'unverified' as const;
    return 'recent' as const;
  }
  const observed = Date.parse(job.observedAt || '');
  if (job.recordKind === 'DOMESTIC_ARCHIVE_SNAPSHOT' && Number.isFinite(observed) && observed <= Date.now()+5*60_000) return 'historical' as const;
  if (job.recordKind !== 'OFFICIAL_JOB_PAGE_OBSERVED' || !Number.isFinite(observed) ||
      observed > Date.now() + 5 * 60_000 || Date.now() - observed > 72 * 60 * 60_000) return 'historical' as const;
  return 'recent' as const;
}
const han = /[\u3400-\u9fff]/u;
const corrupted = /\uFFFD|(?:Ã.|Â.|â[€Œœ„™])|(?:ä¸|å[\x80-\xBF]|æ[\x80-\xBF])|[\u0000-\u001F\u007F]/u;
export function cleanLocaleText(value?:string|null) {
  const text = typeof value === 'string' ? value.trim().replace(/<[^>]*>/g, '').replace(/\s+/g, ' ') : '';
  if (!text || corrupted.test(text) || text.length > 240) return null;
  return text;
}
export function localizedTitle(job: LiveJob, lang: Language) {
  const original=cleanLocaleText(job.title);
  const translated=cleanLocaleText(job.titleZh);
  if(lang==='zh') {
    if(translated && han.test(translated) && job.titleStatus!=='pending') return translated;
    return original && han.test(original) ? original : '职位名称待翻译';
  }
  return original && !han.test(original) ? original : 'Title translation pending';
}
export function localizedCompany(job: LiveJob, lang: Language) {
  const original=cleanLocaleText(job.company)||'Unknown company';
  const zh=cleanLocaleText(job.companyZh);
  return lang==='zh'?(zh||original):original;
}
export function localizedLocation(job: LiveJob, lang: Language) {
  const original=cleanLocaleText(job.location), zh=cleanLocaleText(job.locationZh);
  if(lang==='zh')return zh&&han.test(zh)?zh:original&&han.test(original)?original:'地点待翻译';
  return original&&!han.test(original)?original:'Location translation pending';
}
async function readJSON<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(PREFIX + path, {
    method: 'GET', cache: 'no-store', credentials: 'omit',
    headers: { Accept: 'application/json' }, signal,
  });
  if (!response.ok) throw new Error('职位数据暂时无法读取，请稍后重试');
  return response.json() as Promise<T>;
}
// White HHBA on Railway uses the same source-validated snapshot and search facets
// as GitHub Pages, proxied by our own read-only /data/ route during migration.
const PAGES_PREVIEW=import.meta.env.BASE_URL==='/hhba-talent/' || import.meta.env.VITE_HHBA_VERIFIED_SNAPSHOT==='1';
let cachedSnapshot: Promise<LivePage>|null=null;
let domesticCache:Promise<{jobs:LiveJob[];updated:string}>|null=null;
// Independent historical domestic snapshot; never relax overseas audit/freshness gates.
async function loadDomesticSnapshot():Promise<{jobs:LiveJob[];updated:string}>{
  if(!domesticCache){
    domesticCache=fetch(import.meta.env.BASE_URL+'data/domestic-jobs.json',{
      headers:{Accept:'application/json'},credentials:'omit',cache:'no-store'
    }).then(async response=>{
      if(!response.ok)throw new Error('国内岗位快照不可用');
      const data=await response.json() as {kind?:string;updated?:string;total?:number;jobs?:LiveJob[]};
      if(data.kind!=='HHBA_DOMESTIC_SNAPSHOT_V1'||!Array.isArray(data.jobs)||
         data.jobs.length>10000||data.jobs.length!==data.total||
         !Number.isFinite(Date.parse(data.updated||''))||
         Date.parse(data.updated!)>Date.now()+5*60_000)throw new Error('国内快照格式异常');
      const ids=new Set<string>(),urls=new Set<string>(),checked:LiveJob[]=[];
      for(const j of data.jobs){
        const observed=Date.parse(j.observedAt||'');
        if(!safeId(j.id)||ids.has(j.id)||urls.has(j.url)||!j.domestic||
           j.recordKind!=='DOMESTIC_ARCHIVE_SNAPSHOT'||j.currentApplicationVerified!==false||
           !safeOfficialJobUrl(j)||!Number.isFinite(observed)||
           observed>Date.now()+5*60_000||!cleanLocaleText(j.title)||
           !cleanLocaleText(j.company))throw new Error('国内岗位来源或字段校验失败');
        ids.add(j.id);urls.add(j.url);checked.push(j);
      }
      return {jobs:checked,updated:data.updated!};
    }).catch(error=>{domesticCache=null;throw error});
  }
  return domesticCache;
}


// Railway-only public campus sidecar. The main ATS snapshot/audit stays unchanged.
// Fail closed independently: a campus network error never invalidates overseas jobs.
let campus2027Cache:Promise<LiveJob[]>|null=null;
async function loadCampus2027():Promise<LiveJob[]>{
 if(!PAGES_PREVIEW || import.meta.env.BASE_URL==='/hhba-talent/')return [];
 if(!campus2027Cache){
  campus2027Cache=fetch('/api/campus-2027/jobs',{credentials:'omit',cache:'no-store',
    headers:{Accept:'application/json'}}).then(async response=>{
   if(!response.ok)return [];
   const data=await response.json() as {kind?:string;jobs?:LiveJob[];total?:number};
   if(data.kind!=='HHBA_CAMPUS_2027_WAVE1_VERIFIED_DETAILS_V1'||
      !Array.isArray(data.jobs)||data.jobs.length>100||data.jobs.length!==data.total)return [];
   const now=Date.now(),ids=new Set<string>(),urls=new Set<string>(),accepted:LiveJob[]=[];
   for(const j of data.jobs){
    const observed=Date.parse(j.observedAt||'');
    if(!safeId(j.id)||ids.has(j.id)||urls.has(j.url)||!j.domestic||
       j.recordKind!=='OFFICIAL_JOB_PAGE_OBSERVED'||j.currentApplicationVerified!==false||
       j.graduationYear!==2027||j.recruitmentType!=='CAMPUS'||!safeOfficialJobUrl(j)||
       !Number.isFinite(observed)||observed>now+300000||now-observed>72*3600000)continue;
    ids.add(j.id);urls.add(j.url);accepted.push(j);
   }
   return accepted;
  }).catch(()=>{campus2027Cache=null;return []});
 }
 return campus2027Cache;
}

async function previewSnapshot(signal:AbortSignal):Promise<LivePage> {
  if(!cachedSnapshot) {
    const url=import.meta.env.BASE_URL+'data/jobs.json';
    cachedSnapshot=fetch(url,{method:'GET',headers:{Accept:'application/json'},cache:'no-store',credentials:'omit'})
      .then(async response=>{if(!response.ok)throw new Error('岗位数据快照尚未更新');return response.json() as Promise<LivePage>})
      .then(data=>{
        if(!Array.isArray(data.jobs) || !Number.isInteger(data.total) ||
          !Number.isFinite(Date.parse(data.updated)) || data.failures!==0)
          throw new Error('招聘数据快照无效');
        if(Date.now()-Date.parse(data.updated)>24*60*60_000 ||
           Date.now()<Date.parse(data.updated)-5*60_000)
          throw new Error('岗位数据已过期，等待重新同步');
        return data;
      }).catch(e=>{cachedSnapshot=null;throw e});
  }
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  return cachedSnapshot;
}
// Reuse the ONE already source-validated public snapshot shared by the market.
// Never refetch and rescan the 15k+ jobs once per featured company.
export function loadOfficialPublicSnapshot(signal:AbortSignal):Promise<LivePage>{
 if(!PAGES_PREVIEW)return Promise.reject(new Error('经验证的岗位快照暂不可用'));
 return previewSnapshot(signal);
}
function searchPreview(data:LivePage,filters:LiveFilters,offset:number,facets:Map<string,SearchFacet>):LivePage{
  const matches=searchJobs(data.jobs,filters,facets);
  return {...data,jobs:matches.rows.slice(offset,offset+30),total:matches.counted,offset,limit:30};
}
export async function listJobs(filters: LiveFilters, offset: number, signal: AbortSignal) {
  if(PAGES_PREVIEW) {
    const [overseasResult,domesticResult]=await Promise.allSettled([
      previewSnapshot(signal),loadDomesticSnapshot()
    ]);
    const snapshot=overseasResult.status==='fulfilled'?overseasResult.value:null;
    const domestic=domesticResult.status==='fulfilled'?domesticResult.value:
      {jobs:[] as LiveJob[],updated:''};
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    if(!snapshot && !domestic.jobs.length)throw new Error('国内外岗位快照暂时无法读取');
    const unfiltered=!filters.q.trim()&&!filters.company.trim()&&!filters.country&&
      !filters.remote&&!filters.recruitment_type&&!filters.location_country&&
      !filters.city&&!filters.education&&!filters.experience;
    let overseas:LiveJob[]=[];
    let facets=new Map<string,SearchFacet>();
    if(snapshot){
      // Overseas jobs retain their strict audit + 24h index checks.
      try{
        const audit=await loadPublicJobAudit();
        if(audit?.summary.indexed_as_of===snapshot.updated){
          const index=await (unfiltered?Promise.resolve(null):loadOfficialSearchFacets());
          if(!index||index.indexed_as_of===snapshot.updated){
            if(index)facets=index.facets;
            const excluded=new Set(audit.jobs.filter(entry=>[
              'MISSING_FROM_OFFICIAL_BOARD','OFFICIAL_URL_CHANGED',
              'OFFICIAL_SOURCE_READ_FAILED','OFFICIAL_TITLE_CHANGED',
              'INVALID_ATS_ID_OR_URL','DUPLICATE_JOB_ID','INVALID_JOB_ID'
            ].includes(entry.status)).map(entry=>entry.job_id));
            overseas=snapshot.jobs.filter(job=>!job.domestic&&!excluded.has(job.id));
          }
        }
      }catch{/* A failed overseas validation never discards source-checked domestic records. */}
    }
    const domesticUrls=new Set(domestic.jobs.map(j=>j.url));
    const campus=await loadCampus2027();
    const jobs=[...campus.filter(j=>!domesticUrls.has(j.url)),...domestic.jobs,
      ...overseas.filter(j=>!domesticUrls.has(j.url))];
    const combined:LivePage={jobs,total:jobs.length,limit:jobs.length,offset:0,
      updated:snapshot?.updated||domestic.updated,boards:snapshot?.boards||0,failures:0};
    if(unfiltered)return {...combined,jobs:jobs.slice(offset,offset+30),offset,limit:30};
    return searchPreview(combined,filters,offset,facets);
  }
  const p = new URLSearchParams({ limit:'30',offset:String(offset) });
  if (filters.q.trim()) p.set('q', filters.q.trim().slice(0,100));
  if (filters.company.trim()) p.set('company',filters.company.trim().slice(0,100));
  if (filters.country) p.set('country', filters.country);
  if (filters.remote) p.set('remote','true');
  if (filters.recruitment_type) p.set('recruitment_type',filters.recruitment_type);
  const data = await readJSON<LivePage>('/api/jobs/page?' + p,signal);
  if(!Array.isArray(data.jobs) || !Number.isInteger(data.total) ||
     !Number.isInteger(data.failures) || !Number.isFinite(Date.parse(data.updated))) throw new Error('岗位来源数据异常');
  if (data.failures > 0) throw new Error('部分招聘来源暂时无法核验，请稍后重试');
  if (Math.abs(Date.now()-Date.parse(data.updated)) > 24 * 60 * 60_000) throw new Error('岗位同步时间过久，暂不展示');
  return data;
}
export async function getJob(id: string,signal: AbortSignal) {
  if(!safeId(id)) throw new Error('无效的岗位编号');
  if(PAGES_PREVIEW){
    const domestic=await loadDomesticSnapshot().catch(()=>({jobs:[] as LiveJob[],updated:''}));
    const fromDomestic=domestic.jobs.find(j=>j.id===id);
    if(fromDomestic)return {job:fromDomestic,description:null,richHtml:null,applyUrl:null} as LiveDetail;
    const campus=(await loadCampus2027()).find(j=>j.id===id);
    const listing=campus||(await previewSnapshot(signal)).jobs.find(j=>j.id===id);
    if(!listing||!safeOfficialJobUrl(listing))throw new Error('岗位不存在或来源无效');
    return {job:listing,description:null,richHtml:null,applyUrl:null} as LiveDetail;
  }
  const detail = await readJSON<LiveDetail>('/api/jobs/' + encodeURIComponent(id), signal);
  if(!detail?.job || detail.job.id !== id || !safeOfficialJobUrl(detail.job)) throw new Error('岗位来源核验失败');
  return detail;
}
