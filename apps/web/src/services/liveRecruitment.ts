// One source and one public-job identity for the home market and candidate market.
import {loadPublicJobAudit} from './jobSyncStatus';
export type Language = 'zh' | 'en';
export type LiveJob = {
  id: string; company: string; companyZh?: string; title: string; titleZh?: string;
  titleStatus?: string; location?: string; locationZh?: string; platform?: string;
  source?: string; url: string; domestic?: boolean; remote?: boolean | null;
  recruitmentType?: string; observedAt?: string; recordKind?: string;
  currentApplicationVerified?: boolean;
};
export type LiveFilters = {
  q: string; company: string; country: '' | 'cn' | 'global'; remote: boolean;
  recruitment_type: '' | 'SOCIAL' | 'CAMPUS' | 'INTERNSHIP';
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
// GitHub Pages has no backend or CORS proxy; it uses the read-only, source-validated
// public metadata snapshot generated at build time. Railway stays unchanged.
const PAGES_PREVIEW=import.meta.env.BASE_URL==='/hhba-talent/';
let cachedSnapshot: Promise<LivePage>|null=null;
async function previewSnapshot(signal:AbortSignal):Promise<LivePage> {
  if(!cachedSnapshot) {
    const url=import.meta.env.BASE_URL+'data/jobs.json';
    cachedSnapshot=fetch(url,{method:'GET',headers:{Accept:'application/json'},cache:'no-store',credentials:'omit'})
      .then(async response=>{if(!response.ok)throw new Error('Pages 岗位快照尚未发布');return response.json() as Promise<LivePage>})
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
const searchAliases: Record<string,string[]> = {
  '销售':['sales','account executive','business development'],
  '工程师':['engineer','engineering','developer'],
  '财务':['finance','accountant','accounting'],
  '产品':['product','product manager'],
  '实习':['intern','internship'],
  '运营':['operations','operation'],
  '设计':['design','designer'],
};
function searchPreview(data:LivePage,filters:LiveFilters,offset:number):LivePage{
  const q=filters.q.trim().toLocaleLowerCase();
  const aliases=Object.entries(searchAliases).filter(([term])=>q.includes(term)).flatMap(([,values])=>values);
  const company=filters.company.trim().toLocaleLowerCase();
  const rows=data.jobs.filter(j=>{
    if(filters.country==='cn'&&!j.domestic||filters.country==='global'&&j.domestic)return false;
    if(filters.recruitment_type&&j.recruitmentType!==filters.recruitment_type)return false;
    if(filters.remote&&j.remote!==true)return false;
    if(company && ![j.company,j.companyZh].some(v=>String(v||'').toLocaleLowerCase().includes(company)))return false;
    if(!q)return true;
    const fields=[j.title,j.titleZh,j.company,j.companyZh,j.location,j.locationZh];
    return fields.some(v=>String(v||'').toLocaleLowerCase().includes(q)) ||
      aliases.some(v=>String(j.title||'').toLocaleLowerCase().includes(v));
  });
  return {...data,jobs:rows.slice(offset,offset+30),total:rows.length,offset,limit:30};
}
export async function listJobs(filters: LiveFilters, offset: number, signal: AbortSignal) {
  if(PAGES_PREVIEW) {
    const snapshot=await previewSnapshot(signal);
    const audit=await loadPublicJobAudit();
    if(!audit || audit.summary.indexed_as_of!==snapshot.updated)
      throw new Error('官方岗位核验结果尚未与列表同步，暂不显示旧数据');
    const excluded=new Set(audit.jobs.filter(entry=>[
      'MISSING_FROM_OFFICIAL_BOARD','OFFICIAL_URL_CHANGED',
      'OFFICIAL_SOURCE_READ_FAILED','OFFICIAL_TITLE_CHANGED',
      'INVALID_ATS_ID_OR_URL','DUPLICATE_JOB_ID','INVALID_JOB_ID'
    ].includes(entry.status)).map(entry=>entry.job_id));
    const current={...snapshot,jobs:snapshot.jobs.filter(job=>!excluded.has(job.id)),
      total:snapshot.jobs.length-excluded.size};
    return searchPreview(current,filters,offset);
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
    const listing=(await previewSnapshot(signal)).jobs.find(j=>j.id===id);
    if(!listing||!safeOfficialJobUrl(listing))throw new Error('岗位不存在或来源无效');
    return {job:listing,description:null,richHtml:null,applyUrl:null} as LiveDetail;
  }
  const detail = await readJSON<LiveDetail>('/api/jobs/' + encodeURIComponent(id), signal);
  if(!detail?.job || detail.job.id !== id || !safeOfficialJobUrl(detail.job)) throw new Error('岗位来源核验失败');
  return detail;
}
