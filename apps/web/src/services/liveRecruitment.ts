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
  // Optional display labels for domestic-company search cards; no change to live job source, filtering or freshness.
  educationLabel?: string; experienceLabel?: string;
  currentApplicationVerified?: boolean;
  graduationYear?: number; responsibilitiesSummary?: string; requirementsSummary?: string;
  editorial?: CuratedEditorial; experienceMinYears?: number|null; skillSignals?: string[];
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

type CuratedEditorial={
  sourceVerifiedAt:string;verification:string;overview:string;
  responsibilities:string[];requirements:string[];benefits:string[];
  originalSummary:string;source:string;
};
type CuratedArchiveRow={
  id:string;company:string;companyZh:string;titleEn:string;titleZh:string;
  locationEn:string;locationZh:string;countryCode:string|null;cityKey:string|null;
  education:string|null;experienceMinYears:number|null;skillSignals:string[];
  jobCategory:string;jobType:string|null;originalPlatform:string;originalSource:string;
  originalUrl:string;snapshotObservedAt:string;status:string;currentApplicationVerified:boolean;
  editorial?:CuratedEditorial;
};
const CURATED_100=import.meta.env.VITE_HHBA_CURATED_STATIC==='1';
// Replace ONLY overseas ATS records on GitHub Pages; preserve existing domestic feed and detail readers.
const OVERSEAS_CURATED_100=PAGES_PREVIEW && import.meta.env.VITE_HHBA_OVERSEAS_CURATED_100==='1';
let archivedCache:Promise<CuratedArchiveRow[]>|null=null;
async function loadArchivedHundred(signal:AbortSignal):Promise<CuratedArchiveRow[]>{
  if(!archivedCache){
    archivedCache=fetch(import.meta.env.BASE_URL+'curated/v1/jobs.json',{
      method:'GET',cache:'force-cache',credentials:'omit',headers:{Accept:'application/json'}
    }).then(async response=>{
      if(!response.ok)throw Error('本地岗位文件未找到');
      const data=await response.json() as {kind:string;jobs:CuratedArchiveRow[]};
      if(data.kind!=='HHBA_CURATED_JOBS_V1'||!Array.isArray(data.jobs)||data.jobs.length!==100||
          new Set(data.jobs.map(j=>j.id)).size!==100)throw Error('岗位资料库数量校验失败');
      const counts=new Map<string,number>();
      for(const row of data.jobs){
        if(!/^curated-(ashby|greenhouse|lever)-[A-Za-z0-9_-]{2,170}$/.test(row.id)||
           !row.originalUrl.startsWith('https://')||row.currentApplicationVerified!==false||
           row.status!=='historical_public_posting'||!row.titleZh||!row.titleEn)
          throw Error('岗位资料库来源校验失败');
        counts.set(row.company,(counts.get(row.company)||0)+1);
      }
      if(counts.size!==10||[...counts.values()].some(n=>n!==10))
        throw Error('企业岗位配比校验失败');
      return data.jobs;
    }).catch(e=>{archivedCache=null;throw e});
  }
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  return archivedCache;
}
function archivedJob(j:CuratedArchiveRow):LiveJob{
  const degree:Record<string,string>={BACHELOR:'本科',MASTER:'硕士',PHD:'博士',
    ASSOCIATE:'专科',HIGH_SCHOOL:'高中'};
  return {
    id:j.id.replace(/^curated-/,''),company:j.company,companyZh:j.companyZh,
    title:j.titleEn,titleZh:j.titleZh,titleStatus:'editorial_checked',
    location:j.locationEn,locationZh:j.locationZh,platform:j.originalPlatform,
    source:j.originalSource,url:j.originalUrl,domestic:false,
    remote:/\bremote\b/i.test(j.locationEn)?true:null,
    recruitmentType:j.jobType==='REGULAR'?'REGULAR':undefined,
    observedAt:j.snapshotObservedAt,recordKind:'CURATED_HISTORICAL',
    currentApplicationVerified:false,
    educationLabel:j.education?degree[j.education]||j.education:undefined,
    experienceLabel:j.experienceMinYears!==null?j.experienceMinYears+' 年及以上':undefined,
    experienceMinYears:j.experienceMinYears,skillSignals:j.skillSignals,
    editorial:j.editorial
  };
}
// The original 100 independently authored records already live in the GitHub repository.
// Their saved job IDs remain unchanged, and this path makes no external network request.
export async function loadCuratedOverseasJobs(signal:AbortSignal):Promise<LiveJob[]>{
  const records=await loadArchivedHundred(signal);
  const jobs=records.map(archivedJob);
  if(jobs.length!==100||new Set(jobs.map(job=>job.id)).size!==100||
     jobs.some(job=>job.domestic||job.recordKind!=='CURATED_HISTORICAL'||
       !job.editorial?.responsibilities?.length||!job.editorial?.requirements?.length||
       !safeOfficialJobUrl(job)))throw new Error('海外精选职位资料完整性核对失败');
  return jobs;
}

async function listArchivedJobs(filters:LiveFilters,offset:number,signal:AbortSignal):Promise<LivePage>{
  const rows=await loadArchivedHundred(signal);
  const parts=filters.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const allowed=rows.filter(j=>{
    if(filters.country==='cn'||(filters.company&&j.company!==filters.company))return false;
    if(filters.location_country&&j.countryCode?.toLowerCase()!==filters.location_country.toLowerCase())return false;
    if(filters.city&&j.cityKey!==filters.city)return false;
    if(filters.remote&&!/\bremote\b/i.test(j.locationEn))return false;
    if(filters.recruitment_type&&filters.recruitment_type!==j.jobType)return false;
    if(filters.education&&filters.education!=='UNRESTRICTED_OR_UNREPORTED'&&filters.education!==j.education)return false;
    if(filters.education==='UNRESTRICTED_OR_UNREPORTED'&&j.education!==null&&j.education!=='UNRESTRICTED')return false;
    if(filters.experience==='unreported'&&j.experienceMinYears!==null)return false;
    if(filters.experience==='0'&&j.experienceMinYears!==0)return false;
    if(filters.experience==='1-3'&&(j.experienceMinYears===null||j.experienceMinYears<1||j.experienceMinYears>3))return false;
    if(filters.experience==='3-5'&&(j.experienceMinYears===null||j.experienceMinYears<3||j.experienceMinYears>5))return false;
    if(filters.experience==='5+'&&(j.experienceMinYears===null||j.experienceMinYears<5))return false;
    const searchable=[j.company,j.companyZh,j.titleEn,j.titleZh,j.locationEn,j.locationZh,
      j.countryCode,j.cityKey,...j.skillSignals].filter(Boolean).join(' ').toLowerCase();
    return parts.every(term=>searchable.includes(term));
  });
  const updated=rows[0]?.snapshotObservedAt||'2026-10-24';
  return {jobs:allowed.slice(offset,offset+30).map(archivedJob),
    total:allowed.length,limit:30,offset,updated,boards:10,failures:0};
}

export async function listJobs(filters: LiveFilters, offset: number, signal: AbortSignal) {
  if(CURATED_100)return listArchivedJobs(filters,offset,signal);
  if(PAGES_PREVIEW) {
    const [snapshot,overseas]=await Promise.all([
      previewSnapshot(signal),
      OVERSEAS_CURATED_100?loadCuratedOverseasJobs(signal):Promise.resolve([] as LiveJob[])
    ]);
    // The unfiltered first paint does not use JD-derived education, skills or
    // experience filters. Loading the 14k-row facets file on every initial
    // visit needlessly blocks the home page and the six curated employers.
    // Keep the official audit gate; load the expensive facets only when search
    // and/or user-selected filters actually need them.
    const unfiltered=!filters.q.trim()&&!filters.company.trim()&&!filters.country&&
      !filters.remote&&!filters.recruitment_type&&!filters.location_country&&
      !filters.city&&!filters.education&&!filters.experience;
    const [audit,index,campus]=await Promise.all([
      loadPublicJobAudit(),
      unfiltered?Promise.resolve(null):loadOfficialSearchFacets(),
      loadCampus2027()
    ]);
    if(!audit || audit.summary.indexed_as_of!==snapshot.updated)
      throw new Error('官方岗位核验结果尚未与列表同步，暂不显示旧数据');
    if(index&&index.indexed_as_of!==snapshot.updated)
      throw new Error('中英文岗位条件索引尚未与官网同步，暂不使用过期筛选信息');
    const excluded=new Set(audit.jobs.filter(entry=>[
      'MISSING_FROM_OFFICIAL_BOARD','OFFICIAL_URL_CHANGED',
      'OFFICIAL_SOURCE_READ_FAILED','OFFICIAL_TITLE_CHANGED',
      'INVALID_ATS_ID_OR_URL','DUPLICATE_JOB_ID','INVALID_JOB_ID'
    ].includes(entry.status)).map(entry=>entry.job_id));
    // Fresh official campus entries take precedence over matching historical URLs.
    const campusUrls=new Set(campus.map(job=>job.url));
    const existing=snapshot.jobs.filter(job=>(!OVERSEAS_CURATED_100||job.domestic)&&
      !excluded.has(job.id)&&!campusUrls.has(job.url));
    // All 100 overseas jobs are archived, not asserted to be currently open.
    // Domestic positions keep their original source list, status, sorting and readers.
    const combined=[...overseas,...campus,...existing];
    const current={...snapshot,jobs:combined,total:combined.length};
    // No facet projection is needed to browse the audited, complete index.
    if(unfiltered)return {...current,jobs:current.jobs.slice(offset,offset+30),
      offset,limit:30};
    // Curated records have their own saved metadata. They must not borrow facts
    // or source hashes from current ATS jobs, even when original IDs overlap.
    const searchFacets=new Map(index!.facets);
    const archivedRows=new Map((await loadArchivedHundred(signal)).map(r=>[r.id,r]));
    for(const job of overseas){
      const archive=archivedRows.get('curated-'+job.id)!;
      searchFacets.set(job.id,{
        countryCode:archive.countryCode,cityKey:archive.cityKey,
        education:archive.education,experienceMinYears:archive.experienceMinYears,
        skills:archive.skillSignals,jobType:archive.jobType==='REGULAR'?'SOCIAL':archive.jobType||'UNKNOWN'
      });
    }
    return searchPreview(current,filters,offset,searchFacets);
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
  if(CURATED_100){
    const original=(await loadArchivedHundred(signal)).find(row=>row.id==='curated-'+id);
    if(!original)throw Error('该岗位未在精选资料库中');
    const job=archivedJob(original);
    if(!safeOfficialJobUrl(job))throw Error('原始岗位来源异常');
    return {job,description:null,richHtml:null,applyUrl:null} as LiveDetail;
  }
  if(PAGES_PREVIEW){
    if(OVERSEAS_CURATED_100){
      const archived=(await loadArchivedHundred(signal)).find(row=>row.id==='curated-'+id);
      if(archived){
        const job=archivedJob(archived);
        if(!safeOfficialJobUrl(job))throw new Error('海外岗位来源无效');
        return {job,description:null,richHtml:null,applyUrl:null} as LiveDetail;
      }
    }
    const campus=(await loadCampus2027()).find(j=>j.id===id);
    const listing=campus||(await previewSnapshot(signal)).jobs.find(j=>j.id===id);
    // Do not expose uncurated overseas direct URLs via the older live-ATS reader.
    // All existing domestic detail lookups and their original status checks stay intact.
    if(OVERSEAS_CURATED_100&&listing&&!listing.domestic)
      throw new Error('此海外岗位不在 HHBA 精选静态资料库中');
    if(!listing||!safeOfficialJobUrl(listing))throw new Error('岗位不存在或来源无效');
    return {job:listing,description:null,richHtml:null,applyUrl:null} as LiveDetail;
  }
  const detail = await readJSON<LiveDetail>('/api/jobs/' + encodeURIComponent(id), signal);
  if(!detail?.job || detail.job.id !== id || !safeOfficialJobUrl(detail.job)) throw new Error('岗位来源核验失败');
  return detail;
}
