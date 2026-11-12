// HHBA recruitment library. Uses the existing metrics D1; NEVER available without
// signed Cloudflare Access and the existing single-admin allowlist.
import {verifyAdmin} from '../../_lib/admin-access.js';
import {json,bad,metricDb,sameOrigin} from '../../_lib/metric-utils.js';

export const INDUSTRIES=[
 ['automotive','汽车馆'],['semiconductor','电子半导体馆'],['internet-ai','互联网与AI馆'],
 ['energy','能源电力馆'],['manufacturing','智能制造馆'],['finance','金融馆'],
 ['telecom','通信馆'],['biomed','医药生物馆'],['aerospace','航空航天馆'],
 ['logistics','交通物流馆'],['construction','建筑工程馆'],
 ['consumer-hardware','家电与智能硬件馆'],['chem-materials','化工新材料馆'],
 ['retail','商贸零售馆'],['agri-food','农业食品馆'],['culture-media','文化传媒馆'],
 ['education-research','教育科研馆']
];
const hallIds=new Set(INDUSTRIES.map(x=>x[0]));
const URL_MAX=1500,NAME_MAX=120,IMPORT_MAX=100,LIST_MAX=25;
const API_KIND='HHBA_RECRUITMENT_LIBRARY_V1';
let summaryCache=null;
const number=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):0;
const clean=v=>typeof v==='string'?v.trim():'';
const canonical=v=>clean(v).replace(/\/+$/,'').toLowerCase();
const failed=(code,status=400)=>bad(code,status);
function dbError(e){
 const message=String(e?.message||'');
 if(/row read limit|quota|exceeded|7500/i.test(message))return failed('D1_DAILY_LIMIT_REACHED',503);
 console.error('HHBA_RECRUITMENT_LIBRARY_QUERY_FAILED',e?.name||'Error');
 return failed('LIBRARY_DATABASE_UNAVAILABLE',503);
}
function normalizeUrl(v){
 if(typeof v!=='string'||v.length>URL_MAX)return null;
 const s=clean(v);if(!s)return null;
 try{
  const u=new URL(s);
  if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||u.hostname==='localhost'
   ||/[\u0000-\u001f\u007f]/.test(s)||/\s/.test(s))return null;
  return u.href;
 }catch{return null}
}
function validatedRow(value,{requireUrl=true}={}){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const industry_id=clean(value.industry_id),enterprise=clean(value.enterprise);
 const recruitment_url=clean(value.recruitment_url);
 if(!hallIds.has(industry_id)||!enterprise||enterprise.length>NAME_MAX||/[\u0000-\u001f\u007f]/.test(enterprise))return null;
 const url=recruitment_url?normalizeUrl(recruitment_url):null;
 if((requireUrl&&!url)||(recruitment_url&&!url))return null;
 const verified=value.verified===true;
 return {industry_id,enterprise,recruitment_url:url,source_kind:verified?'admin_verified_official':'admin_candidate_unverified'};
}
function statusOf(row){
 if(!row.recruitment_url)return 'missing';
 if(row.source_kind==='admin_verified_official')return 'verified';
 if(row.source_kind==='previously_reviewed_official')return 'previously_verified';
 return 'candidate';
}
function publicRow(r){
 return {source_key:r.source_key,industry_id:r.industry_id,enterprise:r.enterprise,
  recruitment_url:r.recruitment_url||null,source_kind:r.source_kind||'',
  source_batch:r.source_batch||'',source_sequence:r.source_sequence??null,
  updated_at:r.updated_at||null,status:statusOf(r)};
}
async function gate(request,env){
 const actor=await verifyAdmin(request,env);
 if(!actor.ok)return {response:failed(actor.code,actor.status)};
 const db=metricDb(env);
 if(!db)return {response:failed('LIBRARY_DATABASE_NOT_CONNECTED',503)};
 return {db,actor};
}
function isMutationSafe(request){
 return sameOrigin(request)&&request.headers.get('x-hhba-library-request')==='1'
  &&(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json');
}
async function bodyJson(request){
 const raw=await request.text();
 if(raw.length>180000)throw Error('BODY_TOO_LARGE');
 return JSON.parse(raw);
}
async function audit(db,action,actor,before,after,sourceKey){
 // This append-only table is provisioned by 0020_recruitment_library_audit.sql.
 // Writes fail closed rather than skip the audit or bypass Access.
 return db.prepare('INSERT INTO hhba_library_admin_audit(id,action,actor_email,source_key,industry_id,enterprise,before_json,after_json) VALUES(?,?,?,?,?,?,?,?)')
  .bind(crypto.randomUUID(),action,actor.email,sourceKey,
   (after||before).industry_id,(after||before).enterprise,
   before?JSON.stringify(before):null,after?JSON.stringify(after):null);
}
async function collectExisting(db,industries){
 // One bounded-table pass per import; do not run one full scan per incoming URL.
 const placeholders=industries.map(()=>'?').join(',');
 const rows=await db.prepare('SELECT industry_id,recruitment_url FROM hhba_industry_employer_links WHERE recruitment_url IS NOT NULL AND industry_id IN ('+placeholders+')')
  .bind(...industries).all();
 return new Set((rows.results||[]).map(r=>r.industry_id+'|'+canonical(r.recruitment_url)));
}
function invalidate(){summaryCache=null}
async function summary(db){
 if(summaryCache&&Date.now()<summaryCache.until)return summaryCache.data;
 const [byIndustry,total]=await Promise.all([
  db.prepare("SELECT industry_id,COUNT(*) records,COUNT(recruitment_url) linked,COUNT(DISTINCT lower(trim(recruitment_url))) unique_urls,SUM(CASE WHEN recruitment_url IS NULL OR trim(recruitment_url)='' THEN 1 ELSE 0 END) missing FROM hhba_industry_employer_links GROUP BY industry_id").all(),
  db.prepare("SELECT COUNT(*) records,COUNT(recruitment_url) linked,COUNT(DISTINCT lower(trim(recruitment_url))) unique_urls,SUM(CASE WHEN recruitment_url IS NULL OR trim(recruitment_url)='' THEN 1 ELSE 0 END) missing FROM hhba_industry_employer_links").first()
 ]);
 const map=new Map((byIndustry.results||[]).map(r=>[r.industry_id,r]));
 const data={kind:API_KIND,mode:'summary',asOf:new Date().toISOString(),
  total:{records:number(total?.records),linked:number(total?.linked),unique_urls:number(total?.unique_urls),missing:number(total?.missing)},
  industries:INDUSTRIES.map(([id,label])=>{const r=map.get(id)||{};return {id,label,records:number(r.records),linked:number(r.linked),unique_urls:number(r.unique_urls),missing:number(r.missing)}}),
  note:'全库网址去重数不等于各馆去重数之和；候选网址不代表当前全部有效。'};
 summaryCache={until:Date.now()+300000,data};return data;
}
async function list(db,url){
 const industry=clean(url.searchParams.get('industry')||'');
 const q=clean(url.searchParams.get('q')||'');
 const status=url.searchParams.get('status')||'all';
 const page=Number(url.searchParams.get('page')||'1');
 if((industry&&!hallIds.has(industry))||q.length>80||!['all','linked','missing'].includes(status)
  ||!Number.isInteger(page)||page<1||page>200||(!industry&&q.length<2))return failed('INVALID_LIST_FILTER');
 const where=[],args=[];
 if(industry){where.push('industry_id=?');args.push(industry)}
 if(q){where.push('(instr(lower(enterprise),lower(?))>0 OR instr(lower(coalesce(recruitment_url,\'\')),lower(?))>0)');args.push(q,q)}
 if(status==='missing')where.push("(recruitment_url IS NULL OR trim(recruitment_url)='')");
 if(status==='linked')where.push("(recruitment_url IS NOT NULL AND trim(recruitment_url)<>'')");
 const condition=where.length?' WHERE '+where.join(' AND '):'';
 const rows=await db.prepare('SELECT source_key,industry_id,enterprise,recruitment_url,source_kind,source_batch,source_sequence,updated_at FROM hhba_industry_employer_links'+condition+' ORDER BY enterprise,source_key LIMIT ? OFFSET ?')
  .bind(...args,LIST_MAX+1,(page-1)*LIST_MAX).all();
 const listRows=rows.results||[];
 return json({kind:API_KIND,mode:'list',industry,q,status,page,pageSize:LIST_MAX,hasMore:listRows.length>LIST_MAX,
  rows:listRows.slice(0,LIST_MAX).map(publicRow)});
}
export async function onRequestGet({request,env}){
 const g=await gate(request,env);if(g.response)return g.response;
 const url=new URL(request.url);
 try{
  if(url.searchParams.get('mode')==='summary')return json(await summary(g.db));
  if(url.searchParams.get('mode')==='list')return await list(g.db,url);
  return failed('INVALID_LIBRARY_MODE');
 }catch(e){return dbError(e)}
}
async function createRows(db,actor,values,action){
 const incoming=new Set(),accepted=[];
 for(const raw of values){
  const row=validatedRow(raw);
  if(!row)return failed('INVALID_LIBRARY_RECORD');
  const key=row.industry_id+'|'+canonical(row.recruitment_url);
  if(!incoming.has(key)){accepted.push(row);incoming.add(key)}
 }
 const existing=await collectExisting(db,[...new Set(accepted.map(x=>x.industry_id))]);
 const pending=accepted.filter(r=>!existing.has(r.industry_id+'|'+canonical(r.recruitment_url)));
 if(!pending.length)return json({kind:API_KIND,inserted:0,skipped:values.length});
 const statements=[];
 for(const r of pending){
  const key='admin:'+crypto.randomUUID();
  const after={...r,source_key:key,source_batch:'admin-library'};
  statements.push(db.prepare("INSERT INTO hhba_industry_employer_links(source_key,industry_id,enterprise,recruitment_url,source_kind,source_batch) VALUES(?,?,?,?,?,'admin-library')")
   .bind(key,r.industry_id,r.enterprise,r.recruitment_url,r.source_kind));
  statements.push(await audit(db,action,actor,null,after,key));
 }
 await db.batch(statements);invalidate();
 return json({kind:API_KIND,inserted:pending.length,skipped:values.length-pending.length});
}
export async function onRequestPost({request,env}){
 const g=await gate(request,env);if(g.response)return g.response;
 if(!isMutationSafe(request))return failed('MUTATION_ORIGIN_DENIED',403);
 try{
  const payload=await bodyJson(request);
  if(payload?.action==='add')return await createRows(g.db,g.actor,[payload.row],'add');
  if(payload?.action==='import'&&Array.isArray(payload.rows)&&payload.rows.length>=1&&payload.rows.length<=IMPORT_MAX)
   return await createRows(g.db,g.actor,payload.rows,'import');
  return failed('INVALID_LIBRARY_ACTION');
 }catch(e){return /BODY_TOO_LARGE|SyntaxError/.test(String(e))?failed('INVALID_REQUEST_BODY'):dbError(e)}
}
async function existingRecord(db,key){
 const r=await db.prepare('SELECT source_key,industry_id,enterprise,recruitment_url,source_kind,source_batch,source_sequence,updated_at FROM hhba_industry_employer_links WHERE source_key=?').bind(key).first();
 return r?publicRow(r):null;
}
export async function onRequestPatch({request,env}){
 const g=await gate(request,env);if(g.response)return g.response;
 if(!isMutationSafe(request))return failed('MUTATION_ORIGIN_DENIED',403);
 try{
  const payload=await bodyJson(request),key=clean(payload?.source_key);
  if(!key||key.length>200)return failed('INVALID_RECORD_KEY');
  const next=validatedRow(payload.row);if(!next)return failed('INVALID_LIBRARY_RECORD');
  const before=await existingRecord(g.db,key);if(!before)return failed('LIBRARY_RECORD_NOT_FOUND',404);
  const duplicates=await g.db.prepare('SELECT source_key FROM hhba_industry_employer_links WHERE industry_id=? AND lower(rtrim(recruitment_url,\'/\'))=lower(rtrim(?,\'/\')) AND source_key<>? LIMIT 1').bind(next.industry_id,next.recruitment_url,key).first();
  if(duplicates)return failed('DUPLICATE_IN_INDUSTRY',409);
  const after={...before,...next};
  await g.db.batch([
   g.db.prepare('UPDATE hhba_industry_employer_links SET industry_id=?,enterprise=?,recruitment_url=?,source_kind=?,updated_at=CURRENT_TIMESTAMP WHERE source_key=?')
    .bind(next.industry_id,next.enterprise,next.recruitment_url,next.source_kind,key),
   await audit(g.db,'edit',g.actor,before,after,key)
  ]);
  invalidate();return json({kind:API_KIND,updated:1});
 }catch(e){return /BODY_TOO_LARGE|SyntaxError/.test(String(e))?failed('INVALID_REQUEST_BODY'):dbError(e)}
}
export async function onRequestDelete({request,env}){
 const g=await gate(request,env);if(g.response)return g.response;
 if(!isMutationSafe(request))return failed('MUTATION_ORIGIN_DENIED',403);
 try{
  const payload=await bodyJson(request),key=clean(payload?.source_key);
  if(!key||key.length>200||payload?.confirm!=='DELETE')return failed('DELETE_CONFIRMATION_REQUIRED');
  const before=await existingRecord(g.db,key);if(!before)return failed('LIBRARY_RECORD_NOT_FOUND',404);
  await g.db.batch([
   g.db.prepare('DELETE FROM hhba_industry_employer_links WHERE source_key=?').bind(key),
   await audit(g.db,'delete',g.actor,before,null,key)
  ]);
  invalidate();return json({kind:API_KIND,deleted:1});
 }catch(e){return /BODY_TOO_LARGE|SyntaxError/.test(String(e))?failed('INVALID_REQUEST_BODY'):dbError(e)}
}
