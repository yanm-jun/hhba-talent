// One source and one public-job identity for the home market and candidate market.
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
export function safeOfficialJobUrl(job: LiveJob) {
  try {
    const u = new URL(job.url);
    if(u.protocol !== 'https:' || u.username || u.password) return null;
    if (!job.domestic) {
      const hosts = allowedHost[String(job.platform||'').toLowerCase()] || [];
      if (!hosts.includes(u.hostname) || !u.pathname.split('/').includes(job.source||'')) return null;
    } else if (!['xiaomi-official','meituan-official','tencent-official','baidu-official'].includes(job.platform || '')) {
      return null;
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
export function localizedTitle(job: LiveJob, lang: Language) {
  return lang === 'zh' && job.titleZh && /[\u3400-\u9fff]/u.test(job.titleZh) &&
    job.titleStatus !== 'pending' ? job.titleZh : job.title;
}
export function localizedCompany(job: LiveJob, lang: Language) {
  return lang === 'zh' ? (job.companyZh || job.company) : job.company;
}
export function localizedLocation(job: LiveJob, lang: Language) {
  return lang === 'zh' ? (job.locationZh || job.location || '地点未披露') : (job.location || 'Not specified');
}
async function readJSON<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(PREFIX + path, {
    method: 'GET', cache: 'no-store', credentials: 'omit',
    headers: { Accept: 'application/json' }, signal,
  });
  if (!response.ok) throw new Error('职位数据暂时无法读取，请稍后重试');
  return response.json() as Promise<T>;
}
export async function listJobs(filters: LiveFilters, offset: number, signal: AbortSignal) {
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
  return data;
}
export async function getJob(id: string,signal: AbortSignal) {
  if(!safeId(id)) throw new Error('无效的岗位编号');
  const detail = await readJSON<LiveDetail>('/api/jobs/' + encodeURIComponent(id), signal);
  if(!detail?.job || detail.job.id !== id || !safeOfficialJobUrl(detail.job)) throw new Error('岗位来源核验失败');
  return detail;
}
