// Public assets accumulated within authorized matching tasks, never by a paid
// background crawl. This module receives public evidence, not candidate data.
import {sha256Hex} from './real-auth.js';
import {v4PublicJobUrl} from './v4-open-job-evidence.js';
import {isCommercialRecruitmentBoard} from './match-employer-source.js';
import {referenceMaterialErrors} from './v4-curated-reports.js';
const TTL=86400000;
const text=v=>typeof v==='string'?v.trim():'';
const url=v=>{const u=v4PublicJobUrl(v);return u&&!isCommercialRecruitmentBoard(u)?u:null;};
const KIND='HHBA_PUBLIC_REFERENCE_ASSET_V1';
const OUTBOX='official-jds/asset-outbox-v1/';
const iso=now=>new Date(now).toISOString();
export function publicAssetsEnabled(env){return env?.HHBA_V4_PUBLIC_ASSETS_ENABLED==='1'&&typeof env.HHBA_JOB_JD_R2?.get==='function'&&typeof env.HHBA_JOB_JD_R2?.put==='function';}
export function publicVacancyIdentity(jd){
 if(jd?.source_confirmed!==true||jd.independently_read!==true||jd.vacancy_confirmed!==true||jd.excluded_closed||jd.excluded_board||!url(jd.canonical_url)||!text(jd.company)||!text(jd.title)||!text(jd.location))return null;
 return {url:url(jd.canonical_url),company:text(jd.company),title:text(jd.title),location:text(jd.location),partial_jd:text(jd.partial_jd)};
}
const key=async id=>'official-jds/reference-assets-v1/'+await sha256Hex(JSON.stringify(id))+'.json';
const factRows=facts=>(Array.isArray(facts)?facts:[]).flatMap(f=>url(f?.url)&&text(f?.quote)?[{url:url(f.url),quote:text(f.quote),context:f.context==='same_job'?'same_job':'related_context'}]:[]);
const anchor=a=>({kind:text(a?.kind),url:a?.url?url(a.url)||'':'',quote:text(a?.quote)});
const review=r=>({status:text(r?.status),explanation:text(r?.explanation),missing:Array.isArray(r?.missing)?r.missing.map(text).filter(Boolean):[]});
export function normalizePublicReference(value,job,facts){
 // Only call on public-only model responses, with independently grounded facts.
 const data={reference_jd:text(value?.reference_jd),reference_basis:text(value?.reference_basis),reference_coverage:{duties_quote:text(value?.reference_coverage?.duties_quote),capabilities_quote:text(value?.reference_coverage?.capabilities_quote)},reference_source_anchors:{duties:anchor(value?.reference_source_anchors?.duties),capabilities:anchor(value?.reference_source_anchors?.capabilities)},reference_material_review:review(value?.reference_material_review)};
 const publicFacts=factRows(facts);
 if(data.reference_material_review.status!=='complete'||referenceMaterialErrors(data,{title:job.title,jd_research:{facts:publicFacts}}).length)return null;
 return {data,facts:publicFacts};
}
export async function readPublicReferenceAsset(env,id,now=Date.now()){
 if(!publicAssetsEnabled(env)||!id)return null;
 try{
  const obj=await env.HHBA_JOB_JD_R2.get(await key(id));if(!obj)return null;
  const rec=JSON.parse(await obj.text());
  if(rec.kind!==KIND||JSON.stringify(rec.identity)!==JSON.stringify(id)||!Number.isFinite(rec.saved_at)||rec.saved_at>now||now-rec.saved_at>=TTL)return null;
  if(rec.hash!==await sha256Hex(JSON.stringify([rec.identity,rec.saved_at,rec.material])))return null;
  return normalizePublicReference(rec.material?.data,id,rec.material?.facts);
 }catch{return null;}
}
export async function savePublicReferenceAsset(env,id,material,now=Date.now()){
 if(!publicAssetsEnabled(env)||!id)return false;
 const safe=normalizePublicReference(material?.data,id,material?.facts);if(!safe)return false;
 const rec={kind:KIND,identity:id,saved_at:now,material:safe};
 rec.hash=await sha256Hex(JSON.stringify([rec.identity,rec.saved_at,rec.material]));
 try{await env.HHBA_JOB_JD_R2.put(await key(id),JSON.stringify(rec),{httpMetadata:{contentType:'application/json'}});return true;}catch{return false;}
}
export async function indexPublicJobAsset(env,jd,{reference=false,versionId=null,now=Date.now()}={}){
 if(!publicAssetsEnabled(env)||!env.HHBA_JOB_JD_DB?.prepare)return false;
 const canonical=url(jd?.canonical_url),company=text(jd?.company),title=text(jd?.title),location=text(jd?.location);
 if(!canonical||!company||!title||!location||jd.source_confirmed!==true||jd.independently_read!==true||jd.excluded_closed||jd.excluded_board)return false;
 if(reference?!publicVacancyIdentity(jd):!jd.full_jd||!/^jd_[a-f0-9]{32}$/.test(versionId||''))return false;
 try{
  const result=await env.HHBA_JOB_JD_DB.prepare("INSERT INTO hhba_v4_public_job_assets(url,company,title,location,kind,jd_version_id,checked_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM hhba_v4_public_job_closed WHERE url=? AND closed_at>=?) ON CONFLICT(url) DO UPDATE SET company=excluded.company,title=excluded.title,location=excluded.location,kind=excluded.kind,jd_version_id=excluded.jd_version_id,checked_at=excluded.checked_at WHERE excluded.checked_at>=hhba_v4_public_job_assets.checked_at AND (excluded.kind='OFFICIAL' OR hhba_v4_public_job_assets.kind<>'OFFICIAL' OR hhba_v4_public_job_assets.checked_at<?)").bind(canonical,company,title,location,reference?'REFERENCE':'OFFICIAL',reference?null:versionId,iso(now),canonical,iso(now),iso(now-TTL)).run();
  return result?.success===true;
 }catch{return false;}
}
export async function publicAssetHints(env,profile,{now=Date.now(),limit=40}={}){
 if(!publicAssetsEnabled(env)||!env.HHBA_JOB_JD_DB?.prepare)return [];
 const roles=(Array.isArray(profile?.target_roles)?profile.target_roles:[]).filter(x=>typeof x==='string').map(x=>x.trim()).filter(x=>x.length>=2);
 if(!roles.length)return [];
 const terms=[...new Set(roles)].slice(0,8);
 try{
  const sql="SELECT url,company,title,location,kind,checked_at FROM (SELECT url,company,title,location,kind,checked_at FROM hhba_v4_public_job_assets UNION ALL SELECT l.url,l.company,l.title,l.location,'LEAD',l.checked_at FROM hhba_v4_public_job_leads l WHERE NOT EXISTS(SELECT 1 FROM hhba_v4_public_job_assets a WHERE a.url=l.url AND a.checked_at>=l.checked_at)) a WHERE checked_at>=? AND checked_at<=? AND NOT EXISTS(SELECT 1 FROM hhba_v4_public_job_closed c WHERE c.url=a.url AND c.closed_at>=a.checked_at) AND ("+terms.map(()=> "instr(title,?)>0").join(" OR ")+") ORDER BY checked_at DESC LIMIT ?";
  const result=await env.HHBA_JOB_JD_DB.prepare(sql).bind(new Date(now-TTL).toISOString(),new Date(now).toISOString(),...terms,Math.min(40,limit)).all();
  return (result?.results||[]).filter(j=>url(j.url)&&text(j.company)&&text(j.title)&&text(j.location)).map(j=>({url:j.url,company:j.company,title:j.title,location:j.location,checked_at:j.checked_at,material_kind:j.kind}));
 }catch{return [];}
}
export async function removeClosedPublicAsset(env,raw){
 const canonical=url(raw);if(!publicAssetsEnabled(env)||!canonical||!env.HHBA_JOB_JD_DB?.prepare)return;
 try{await env.HHBA_JOB_JD_DB.prepare('INSERT INTO hhba_v4_public_job_closed(url,closed_at) VALUES(?,?) ON CONFLICT(url) DO UPDATE SET closed_at=MAX(closed_at,excluded.closed_at)').bind(canonical,iso(Date.now())).run();}catch{}
}

// All records are constructed from independently verified public evidence.
// Normal writes use the existing R2 and D1; failure leaves a durable public
// outbox record in whichever store still works. No AI call during recovery.
export function publicAssetRecord(jd,{material,versionId,now=Date.now()}={}){
 const id=publicVacancyIdentity(jd);
 if(material){if(!id)return null;const safe=normalizePublicReference(material.data,id,material.facts);return safe?{kind:'reference',identity:id,material:safe,at:now}:null;}
 if(versionId){if(!/^jd_[a-f0-9]{32}$/.test(versionId)||jd?.source_confirmed!==true||jd?.independently_read!==true||jd.excluded_closed||jd.excluded_board||!jd.full_jd||!url(jd.canonical_url)||!text(jd.company)||!text(jd.title)||!text(jd.location))return null;
  return {kind:'official',identity:{url:url(jd.canonical_url),company:text(jd.company),title:text(jd.title),location:text(jd.location),partial_jd:''},versionId,at:now};}
 return id?{kind:'lead',identity:{...id,partial_jd:''},at:now}:null;
}
const validRecord=(r,now)=>r&&['reference','official','lead'].includes(r.kind)&&Number.isFinite(r.at)&&r.at<=now&&!!url(r.identity?.url)&&!!text(r.identity.company)&&!!text(r.identity.title)&&!!text(r.identity.location)&&(r.kind==='reference'?!!normalizePublicReference(r.material?.data,r.identity,r.material?.facts):r.kind==='lead'||/^jd_[a-f0-9]{32}$/.test(r.versionId||''));
const indexJd=r=>({...r.identity,canonical_url:r.identity.url,source_confirmed:true,independently_read:true,vacancy_confirmed:true,full_jd:r.kind==='official'?'archived':undefined});
async function publishRecord(env,r){
 if(r.kind==='lead'){
  try{const j=r.identity,d=iso(r.at);const result=await env.HHBA_JOB_JD_DB.prepare("INSERT INTO hhba_v4_public_job_leads(url,company,title,location,checked_at) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM hhba_v4_public_job_closed WHERE url=? AND closed_at>=?) ON CONFLICT(url) DO UPDATE SET company=excluded.company,title=excluded.title,location=excluded.location,checked_at=excluded.checked_at WHERE excluded.checked_at>=hhba_v4_public_job_leads.checked_at").bind(j.url,j.company,j.title,j.location,d,j.url,d).run();return result?.success===true;}catch{return false;}
 }
 if(r.kind==='reference'&&!await savePublicReferenceAsset(env,r.identity,r.material,r.at))return false;
 return indexPublicJobAsset(env,indexJd(r),{reference:r.kind==='reference',versionId:r.versionId,now:r.at});
}
export async function publishPublicAsset(env,r,{now=Date.now(),note=()=>{}}={}){
 if(!publicAssetsEnabled(env)||!validRecord(r,now))return false;
 if(now-r.at>=TTL)return true;
 if(await publishRecord(env,r)){note('PUBLIC_JOB_ASSET_INDEXED');return true;}
 const id=await sha256Hex(JSON.stringify(r)),payload=JSON.stringify(r);
 try{const result=await env.HHBA_JOB_JD_DB.prepare('INSERT OR IGNORE INTO hhba_v4_public_asset_outbox(id,payload,created_at) VALUES(?,?,?)').bind(id,payload,iso(now)).run();if(result?.success){note('PUBLIC_ASSET_WRITE_DEFERRED');return true;}}catch{}
 try{await env.HHBA_JOB_JD_R2.put(OUTBOX+id+'.json',payload);note('PUBLIC_ASSET_WRITE_DEFERRED');return true;}catch{}
 note('PUBLIC_ASSET_WRITE_PENDING_CHECKPOINT');return false;
}
export async function drainPublicAssetOutbox(env,{now=Date.now(),canStart=()=>true,note=()=>{}}={}){
 if(!publicAssetsEnabled(env)||!canStart())return;
 const db=env.HHBA_JOB_JD_DB,bucket=env.HHBA_JOB_JD_R2;
 try{
  const rows=(await db.prepare('SELECT id,payload FROM hhba_v4_public_asset_outbox ORDER BY created_at LIMIT 2').bind().all()).results||[];
  for(const row of rows){if(!canStart())return;let r;try{r=JSON.parse(row.payload);}catch{}
   if(!validRecord(r,now)||now-r.at>=TTL||await publishRecord(env,r)){await db.prepare('DELETE FROM hhba_v4_public_asset_outbox WHERE id=?').bind(row.id).run();note('PUBLIC_ASSET_OUTBOX_DRAINED');}
  }
 }catch{}
 if(!canStart()||typeof bucket.list!=='function'||typeof bucket.delete!=='function')return;
 try{
  const rows=(await bucket.list({prefix:OUTBOX,limit:2})).objects||[];
  for(const row of rows){if(!canStart())return;const obj=await bucket.get(row.key);if(!obj)continue;let r;try{r=JSON.parse(await obj.text());}catch{}
   if(!validRecord(r,now)||now-r.at>=TTL||await publishRecord(env,r)){await bucket.delete(row.key);note('PUBLIC_ASSET_OUTBOX_DRAINED');}
  }
 }catch{}
}
// Employer sources are reusable hints, never newly verified JD facts. Keep
// observed excerpts on the verified employer's origin, not personal reports.
const employerKey=id=>JSON.stringify([id.company.normalize('NFKC').trim().toLowerCase(),new URL(id.url).origin]);
export async function savePublicEmployerResearch(env,id,facts,now=Date.now()){
 if(!publicAssetsEnabled(env)||!id||!env.HHBA_JOB_JD_DB?.prepare)return false;
 const origin=new URL(id.url).origin;
 const related=factRows(facts).filter(f=>f.context==='related_context'&&f.url!==id.url&&new URL(f.url).origin===origin);
 if(!related.length)return false;
 const payload=JSON.stringify([...new Map(related.map(f=>[f.url+'\n'+f.quote,f])).values()]);if(new TextEncoder().encode(payload).length>500000)return false;
 try{const r=await env.HHBA_JOB_JD_DB.prepare("INSERT INTO hhba_v4_public_employer_research(employer_key,company,origin,excerpts,checked_at) VALUES(?,?,?,?,?) ON CONFLICT(employer_key) DO UPDATE SET excerpts=excluded.excerpts,checked_at=excluded.checked_at WHERE excluded.checked_at>=hhba_v4_public_employer_research.checked_at").bind(employerKey(id),id.company,origin,payload,iso(now)).run();return r?.success===true;}catch{return false;}
}
export async function publicEmployerSources(env,id,now=Date.now()){
 if(!publicAssetsEnabled(env)||!id||!env.HHBA_JOB_JD_DB?.prepare)return [];
 try{const row=await env.HHBA_JOB_JD_DB.prepare('SELECT excerpts FROM hhba_v4_public_employer_research WHERE employer_key=? AND checked_at>=? AND checked_at<=?').bind(employerKey(id),iso(now-7*TTL),iso(now)).first();
 return [...new Set(factRows(JSON.parse(row?.excerpts||'[]')).filter(f=>new URL(f.url).origin===new URL(id.url).origin&&f.url!==id.url).map(f=>f.url))];
 }catch{return [];}
}
export async function recordPublicAssetReuse(env,now=Date.now()){
 if(!publicAssetsEnabled(env)||!env.HHBA_JOB_JD_DB?.prepare)return;
 try{await env.HHBA_JOB_JD_DB.prepare("INSERT INTO hhba_v4_public_asset_daily(day,reference_hits) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET reference_hits=reference_hits+1").bind(iso(now).slice(0,10)).run();}catch{}
}
export async function readPublicAssetMetrics(env,since,until,now=Date.now()){
 const db=env.HHBA_JOB_JD_DB;if(!db?.prepare)return {quality:'unavailable'};
 try{
  const j=await db.prepare("SELECT COUNT(*) AS jobs,COUNT(DISTINCT company) AS companies,COALESCE(SUM(kind='OFFICIAL'),0) AS official,COALESCE(SUM(kind='REFERENCE'),0) AS reference,COALESCE(SUM(kind='LEAD'),0) AS leads,COALESCE(SUM(checked_at>=? AND NOT EXISTS(SELECT 1 FROM hhba_v4_public_job_closed c WHERE c.url=a.url AND c.closed_at>=a.checked_at)),0) AS fresh FROM (SELECT url,company,kind,checked_at FROM hhba_v4_public_job_assets UNION ALL SELECT l.url,l.company,'LEAD',l.checked_at FROM hhba_v4_public_job_leads l WHERE NOT EXISTS(SELECT 1 FROM hhba_v4_public_job_assets j WHERE j.url=l.url)) a").bind(iso(now-TTL)).first();
  const e=await db.prepare('SELECT COUNT(*) AS employers FROM hhba_v4_public_employer_research').bind().first();
  const q=await db.prepare('SELECT COUNT(*) AS pending FROM hhba_v4_public_asset_outbox').bind().first();
  const hits=await db.prepare('SELECT COALESCE(SUM(reference_hits),0) AS hits FROM hhba_v4_public_asset_daily WHERE day>=? AND day<=?').bind(since,until).first();
  return {quality:'collected',jobs:Number(j.jobs),companies:Number(j.companies),official:Number(j.official),reference:Number(j.reference),leads:Number(j.leads),fresh:Number(j.fresh),employers:Number(e.employers),pendingD1:Number(q.pending),referenceHits:Number(hits.hits),scope:'DEMAND_DRIVEN_INDEX_NOT_CURRENT_OPENINGS'};
 }catch{return {quality:'unavailable'};}
}
