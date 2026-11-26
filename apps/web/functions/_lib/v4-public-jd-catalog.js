// Background collection of public, independently verified structured JDs.
// No CV, account information, model credentials or AI calls enter this module.
import {v4PublicJobUrl,v4ReadEmployerJob,v4ReadPublicJobDocument} from './v4-open-job-evidence.js';
import {isCommercialRecruitmentBoard} from './match-employer-source.js';
import {looksTruncatedJd} from './v4-jd-completeness.js';
import {saveV4PublicJobJd,jdArchiveConfigured} from './job-jd-archive.js';
import {phaseResourceBudget} from './v4-phase-budget.js';
export const PUBLIC_CATALOG_KEY='official-jds/catalog-v1/snapshot.json';
export const PUBLIC_CATALOG_CRON='*/15 * * * *';
const DAY=86400000,MAX_ROWS=2000,BATCH=4;
const text=v=>typeof v==='string'?v.trim():'';
const norm=v=>text(v).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const goodUrl=value=>{const u=v4PublicJobUrl(value);return u&&!isCommercialRecruitmentBoard(u)?u:null};
const validRow=(j,now)=>!!goodUrl(j?.url)&&!!text(j.company)&&!!text(j.title)&&!!text(j.location)&&Number.isFinite(Date.parse(j.checked_at))&&Date.parse(j.checked_at)<=now&&now-Date.parse(j.checked_at)<DAY;
async function snapshot(bucket){
 const object=await bucket.get(PUBLIC_CATALOG_KEY);
 if(!object)return {version:1,offset:0,jobs:[]};
 const saved=JSON.parse(await object.text());
 if(saved.version!==1||!Number.isSafeInteger(saved.offset)||saved.offset<0||!Array.isArray(saved.jobs))throw Error('PUBLIC_CATALOG_INVALID');
 return saved;
}
// Data stays local to the collector. Revalidate every selected JD in the
// foreground; even a recent snapshot is only a discovery hint.
export async function publicCatalogHints(env,profile,roleHint,{now=Date.now(),limit=40}={}){
 if(env?.HHBA_PUBLIC_JD_CATALOG_READ!=='1'||!env.HHBA_JOB_JD_R2?.get)return [];
 try{
  const saved=await snapshot(env.HHBA_JOB_JD_R2),seen=new Set();
  const keywords=[...(Array.isArray(profile?.target_roles)?profile.target_roles:[]),roleHint].flatMap(v=>text(v).split(/[\s、，,;；/]+/)).map(norm).filter(v=>v.length>=2);
  const rows=saved.jobs.filter(j=>validRow(j,now)&&!seen.has(j.url)&&seen.add(j.url));
  const rank=j=>keywords.reduce((n,k)=>n+(norm(j.title).includes(k)?4:0)+(norm(j.location).includes(k)?1:0),0);
  return rows.sort((a,b)=>rank(b)-rank(a)||b.checked_at.localeCompare(a.checked_at)).slice(0,limit).map(j=>({url:j.url,company:j.company,title:j.title,location:j.location,checked_at:j.checked_at}));
 }catch{return [];}
}
// Conservative robots policy for unattended collection: opt out if any
// applicable group has a restriction or crawl delay. No login or cookies.
async function robotsAllows(origin,fetcher,signal){
 try{
  const r=await fetcher(origin+'/robots.txt',{method:'GET',redirect:'manual',headers:{'User-Agent':'HHBA-Public-JD-Catalog/1.0'},signal});
  if(r.status===404||r.status===410){await r.body?.cancel();return true;}
  if(!r.ok||!r.body)return false;
  const reader=r.body.getReader();let total=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>131072){await reader.cancel();return false;}chunks.push(value);}}finally{reader.releaseLock();}
  const data=new Uint8Array(total);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  const lines=new TextDecoder().decode(data).split(/\r?\n/);
  // Deliberately conservative: any nonempty restriction prevents collection.
  return !lines.some(line=>/^\s*(?:disallow|crawl-delay|request-rate)\s*:\s*[^\s#]/i.test(line));
 }catch{return false;}
}
export async function runPublicJdCatalog(env,{now=new Date(),fetcher=fetch}={}){
 const result={enabled:false,entries:0,checked:0,saved:0,failed:0};
 if(env?.HHBA_PUBLIC_JD_CATALOG_COLLECT!=='1'||!jdArchiveConfigured(env))return result;
 result.enabled=true;
 const bucket=env.HHBA_JOB_JD_R2,old=await snapshot(bucket);
 const budget=phaseResourceBudget({initial:4,soft:20,hard:28});
 const scoped=budget.env(env),fetchPublic=budget.fetch(fetcher);
 const jobs=new Map(old.jobs.filter(j=>validRow(j,now.getTime())).map(j=>[j.url,j]));
 let offset=old.offset;
 // Only trusted source types are scheduled; this is not a search scope limit.
 const query="SELECT DISTINCT enterprise,recruitment_url FROM hhba_industry_employer_links WHERE source_kind IN ('official_public_careers_evidence','previously_reviewed_official','historical_employer_profile_official_portal') AND recruitment_url LIKE 'https://%' ORDER BY enterprise,recruitment_url LIMIT ? OFFSET ?";
 let page=(await scoped.HHBA_JOB_JD_DB.prepare(query).bind(BATCH,offset).all()).results||[];
 if(!page.length&&offset){offset=0;page=(await scoped.HHBA_JOB_JD_DB.prepare(query).bind(BATCH,0).all()).results||[];}
 const signal=AbortSignal.timeout(45000);
 for(const row of page){
  if(!budget.canStart()||signal.aborted)break;
  result.entries++;offset++;
  const entry=goodUrl(row.recruitment_url);if(!entry||!norm(row.enterprise))continue;
  const origin=new URL(entry).origin;
  // All requests, including redirect follow-ups, must stay on the declared
  // employer origin. Cross-origin/JS-heavy jobs stay with live AI research.
  const localFetch=(url,opts)=>{if(new URL(url).origin!==origin)throw Error('CATALOG_CROSS_ORIGIN');return fetchPublic(url,{...opts,headers:{...opts?.headers,'User-Agent':'HHBA-Public-JD-Catalog/1.0'}});};
  if(!await robotsAllows(origin,localFetch,signal))continue;
  const targets=[entry];
  try{
   const doc=await v4ReadPublicJobDocument(entry,{fetcher:localFetch,signal});
   const links=(doc.declared_resource_hints||[]).filter(h=>h.kind==='link'&&goodUrl(h.url)&&new URL(h.url).origin===origin).map(h=>h.url);
   // Rotate the small prefetch batch through actual links over repeated runs.
   const shift=links.length?Math.floor(now.getTime()/DAY)%links.length:0;
   targets.push(...links.slice(shift),...links.slice(0,shift));
  }catch{/* a direct JobPosting may still be readable */}
  for(const url of [...new Set(targets)].slice(0,4)){
   if(!budget.canStart()||signal.aborted)break;
   result.checked++;
   try{
    const jd=await v4ReadEmployerJob(url,{fetcher:localFetch,signal,cacheBucket:scoped.HHBA_JOB_JD_R2,expected:jobs.get(url)||{company:row.enterprise},now,catalogWarm:true});
    if(jd.proof_method!=='V4_STRUCTURED_JOBPOSTING'||jd.source_confirmed!==true||jd.independently_read!==true||!jd.full_jd||looksTruncatedJd(jd.full_jd)||norm(jd.company)!==norm(row.enterprise)||!goodUrl(jd.canonical_url)||!text(jd.title)||!text(jd.location))continue;
    const saved=await saveV4PublicJobJd(scoped,jd,{now});
    if(!saved?.id)continue;
    jobs.set(jd.canonical_url,{url:jd.canonical_url,company:jd.company,title:jd.title,location:jd.location,checked_at:now.toISOString(),jd_version_id:saved.id});
    result.saved++;
   }catch(e){result.failed++;if(e?.message==='V4_JOB_CLOSED')jobs.delete(url);}
  }
 }
 // One atomic snapshot write; no archived JD deletion. Cursor advances only
 // for attempted employers. Preserve fresh earlier successes across batches.
 const next={version:1,offset,jobs:[...jobs.values()].sort((a,b)=>b.checked_at.localeCompare(a.checked_at)).slice(0,MAX_ROWS)};
 await bucket.put(PUBLIC_CATALOG_KEY,JSON.stringify(next),{httpMetadata:{contentType:'application/json'}});
 return result;
}
