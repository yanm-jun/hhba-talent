import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// A GitHub Pages preview can only publish public job-board metadata.
// Never upload resumes, cookies, JD, ATS raw responses or translation credentials.
const SOURCES=[
 'https://hhba-web-production-024c.up.railway.app/api/jobs',
 'https://hhba-live-jobs-preview-production.up.railway.app/api/jobs'
];
const BOARD_HOSTS={
 greenhouse:new Set(['job-boards.greenhouse.io','boards.greenhouse.io','boards.eu.greenhouse.io']),
 ashby:new Set(['jobs.ashbyhq.com']),
 lever:new Set(['jobs.lever.co','jobs.eu.lever.co'])
};
const BRANDED_GREENHOUSE={
 stripe:{host:'stripe.com',path:'/jobs/search'},
 coinbase:{host:'www.coinbase.com',path:'/careers/positions/'},
 airbnb:{host:'careers.airbnb.com',path:'/positions/'},
 databricks:{host:'databricks.com',path:'/company/careers/open-positions/job'}
};
const CHINA_HOSTS={
 'xiaomi-official':'xiaomi.jobs.f.mioffice.cn',
 'meituan-official':'zhaopin.meituan.com',
 'tencent-official':'careers.tencent.com',
 'baidu-official':'talent.baidu.com'
};
const mojibake=/\uFFFD|(?:Ã.|Â.|â[€Œœ„™])|(?:ä¸|å[\x80-\xBF]|æ[\x80-\xBF])|[\u0000-\u001F\u007F]/u;
const han=/[\u3400-\u9fff]/u;
function clean(value,max=240){
 if(typeof value!=='string')return null;
 const v=value.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
 return !v||v.length>max||mojibake.test(v)?null:v;
}
function safeUrl(job){
 try{
  const u=new URL(job.url),platform=job.platform,source=job.source;
  if(u.protocol!=='https:'||u.port||u.username||u.password)return false;
  if(job.domestic===true)return u.hostname===CHINA_HOSTS[platform];
  if(BOARD_HOSTS[platform]?.has(u.hostname)&&u.pathname.split('/').includes(source))return true;
  const branded=platform==='greenhouse'?BRANDED_GREENHOUSE[source]:null;
  if(!branded)return false;
  const prefix='greenhouse-'+source+'-';
  const native=String(job.id||'').startsWith(prefix)?String(job.id).slice(prefix.length):'';
  return /^[0-9]{5,20}$/.test(native)&&u.hostname===branded.host &&
    (branded.path.endsWith('/')?u.pathname.startsWith(branded.path):u.pathname===branded.path) &&
    u.searchParams.get('gh_jid')===native;
 }catch{return false;}
}
function onlyPublic(job){
 if(!job||typeof job!=='object'||!/^[A-Za-z0-9_-]{1,180}$/.test(String(job.id||'')))return null;
 if(!safeUrl(job))return null;
 const title=clean(job.title,220),company=clean(job.company,180);
 if(!title||!company)return null;
 const titleZh=clean(job.titleZh,220),companyZh=clean(job.companyZh,180);
 const locationZh=clean(job.locationZh,170);
 return {
  id:job.id,company,companyZh:companyZh||null,
  title,titleZh:titleZh&&han.test(titleZh)?titleZh:null,
  titleStatus:clean(job.titleStatus,32)||'pending',
  location:clean(job.location,170)||null,
  locationZh:locationZh&&han.test(locationZh)?locationZh:null,
  url:job.url,platform:job.platform,source:job.source,
  domestic:job.domestic===true,remote:typeof job.remote==='boolean'?job.remote:null,
  recruitmentType:['SOCIAL','CAMPUS','INTERNSHIP','SPECIAL'].includes(job.recruitmentType)?job.recruitmentType:null,
  observedAt:clean(job.observedAt,50)||null,
  recordKind:clean(job.recordKind,60)||null,
  currentApplicationVerified:false
 };
}
async function fetchBoard(url){
 const reply=await fetch(url,{method:'GET',headers:{Accept:'application/json'},redirect:'error',
   signal:AbortSignal.timeout(45000)});
 if(!reply.ok)throw new Error('HTTP '+reply.status);
 if(!reply.headers.get('content-type')?.includes('application/json'))throw new Error('not_json');
 const body=await reply.json();
 if(!Array.isArray(body.jobs)||!Number.isInteger(body.total)||body.total!==body.jobs.length||
    body.jobs.length===0||body.jobs.length>20000||!Number.isInteger(body.boards)||
    body.boards<1||body.failures!==0)throw new Error('incomplete_snapshot');
 const when=Date.parse(body.updated);
 if(!Number.isFinite(when)||when>Date.now()+5*60000||Date.now()-when>24*3600*1000)
   throw new Error('stale_snapshot');
 const seen=new Set(),data=[];
 for(const row of body.jobs){
  const publicJob=onlyPublic(row);
  if(!publicJob||seen.has(publicJob.id))continue;
  seen.add(publicJob.id);data.push(publicJob);
 }
 if(!data.length)throw new Error('no_verified_public_listings');
 return {jobs:data,total:data.length,limit:data.length,offset:0,updated:body.updated,boards:body.boards,failures:0,
  informationalNotice:'Job listings were observed on public employer sources. Current application availability is unconfirmed.'};
}
let snapshot=null,lastError=null;
for(const url of SOURCES) {
 try{snapshot=await fetchBoard(url);break;}catch(e){lastError=e;console.warn('SOURCE_READ_FAILED',new URL(url).hostname,e.message);}
}
if(!snapshot)throw new Error('No complete, recent official source snapshot: '+lastError?.message);
await mkdir(join('dist','data'),{recursive:true});
await writeFile(join('dist','data','jobs.json'),JSON.stringify(snapshot),'utf8');
console.log('HHBA_PAGES_SNAPSHOT',JSON.stringify({count:snapshot.total,boards:snapshot.boards,updated:snapshot.updated}));
