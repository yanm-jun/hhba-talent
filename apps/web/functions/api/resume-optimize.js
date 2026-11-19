// Candidate-only, opt-in, server-side AI resume suggestion route.
// No API key, resume content or session token is stored in D1 or response logs.
import {sessionOfBearer,getUserByPhone,sha256Hex} from '../_lib/real-auth.js';
import {generateSuggestions,selectProvider} from '../_lib/resume-ai-provider.js';

const send=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex'
}});
const fail=(code,status)=>send({ok:false,error:code},status);
const MAX_BODY=18000,MAX_BLOCKS=12,MAX_GLOBAL=50,MAX_PERSONAL=3;
function active(env){
 return (env?.HHBA_AUTH_ROLLOUT==='preview'||env?.HHBA_MATCH_RUNTIME_MODE==='production')&&
  env?.HHBA_RESUME_OPTIMIZATION_ENABLED==='1'&&
  typeof env?.HHBA_MATCH_LIMIT_PEPPER==='string'&&env.HHBA_MATCH_LIMIT_PEPPER.length>=24&&
  typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';
}
async function dbReady(db){
 try{const row=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hhba_resume_optimization_requests'").first();
 return row?.name==='hhba_resume_optimization_requests';}catch{return false;}
}
function sameOrigin(request){
 const url=new URL(request.url);
 return request.headers.get('Origin')===url.origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
async function readSmallJson(request){
 const declared=request.headers.get('Content-Length');
 if(!request.body||declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BODY))throw Error('INVALID_REQUEST');
 const reader=request.body.getReader();let bytes=0;const chunks=[];
 try{for(;;){const x=await reader.read();if(x.done)break;bytes+=x.value.byteLength;
  if(bytes>MAX_BODY){await reader.cancel();throw Error('INVALID_REQUEST');}chunks.push(x.value);}
 }finally{reader.releaseLock();}
 const all=new Uint8Array(bytes);let pos=0;for(const c of chunks){all.set(c,pos);pos+=c.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}catch{throw Error('INVALID_REQUEST');}
}
function valid(body){
 if(!body||Array.isArray(body)||typeof body!=='object'||body.consent_ai!==true||
  !Array.isArray(body.blocks)||body.blocks.length<1||body.blocks.length>MAX_BLOCKS)return false;
 if(!body.job||typeof body.job!=='object'||typeof body.job.title!=='string'||
  body.job.title.length<2||body.job.title.length>120||
  typeof body.job.requirements!=='string'||body.job.requirements.length>2500)return false;
 const ids=new Set();
 return body.blocks.every(b=>{
  if(!b||typeof b!=='object'||typeof b.id!=='string'||!/^[a-z0-9_-]{1,64}$/i.test(b.id)||
   typeof b.text!=='string'||!b.text.trim()||b.text.length>1600||ids.has(b.id))return false;
  ids.add(b.id);return ['experience','skills','summary','education','projects'].includes(b.section);
 });
}
function redact(text){
 return text.replace(/[a-z\d._%+-]+@[a-z\d.-]+\.[a-z]{2,}/gi,'[邮箱已脱敏]')
  .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g,'[电话已脱敏]')
  .replace(/(?<!\d)\d{17}[\dXx](?!\d)/g,'[证件号已脱敏]');
}
async function reserve(db,hash){
 const id=crypto.randomUUID(),time=new Date().toISOString(),day=time.slice(0,10);
 const row=await db.prepare(
  'INSERT INTO hhba_resume_optimization_requests(request_id,day_utc,account_hash,created_at) SELECT ?,?,?,? WHERE '+
  '(SELECT COUNT(*) FROM hhba_resume_optimization_requests WHERE day_utc=?)<? AND '+
  '(SELECT COUNT(*) FROM hhba_resume_optimization_requests WHERE day_utc=? AND account_hash=?)<?'
 ).bind(id,day,hash,time,day,MAX_GLOBAL,day,hash,MAX_PERSONAL).run();
 return row?.success===true&&row?.meta?.changes===1;
}
export async function onRequestGet({env}){
 let configured=false;
 try{selectProvider(env);configured=true;}catch{}
 return send({kind:'HHBA_RESUME_OPTIMIZATION_V1',enabled:active(env)&&configured&&await dbReady(env.HHBA_PNVS_AUTH_DB),
  configured,per_account_daily_limit:MAX_PERSONAL,global_daily_limit:MAX_GLOBAL});
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return fail('ORIGIN_REQUIRED',403);
 if(!active(env))return fail('RESUME_OPTIMIZATION_NOT_ENABLED',503);
 const db=env.HHBA_PNVS_AUTH_DB;
 if(!await dbReady(db))return fail('RESUME_OPTIMIZATION_DB_NOT_READY',503);
 try{selectProvider(env);}catch{return fail('AI_PROVIDER_NOT_CONFIGURED',503);}
 let session;
 try{session=await sessionOfBearer(db,request,Date.now());
  if(!session)return fail('SESSION_INVALID',401);
  const user=await getUserByPhone(db,session.phone);
  if(user?.role!=='candidate')return fail('FORBIDDEN',403);
 }catch{return fail('SESSION_INVALID',401);}
 let input;
 try{input=await readSmallJson(request);}catch{return fail('INVALID_REQUEST',400);}
 if(!valid(input))return fail('INVALID_OPTIMIZATION_INPUT',400);
 const hash=await sha256Hex(env.HHBA_MATCH_LIMIT_PEPPER+':resume-opt:'+session.phone);
 try{if(!await reserve(db,hash))return fail('RESUME_OPTIMIZATION_LIMIT',429);}
 catch{return fail('RESUME_OPTIMIZATION_DB_NOT_READY',503);}
 // Mask common contact identifiers before third-party processing.
 const blocks=input.blocks.map(b=>({id:b.id,section:b.section,text:redact(b.text)}));
 const job={title:redact(input.job.title),requirements:redact(input.job.requirements)};
 try{
  const result=await generateSuggestions({env,blocks,job,signal:AbortSignal.timeout(25000)});
  const originalById=new Map(input.blocks.map(b=>[b.id,b.text]));
  const suggestions=result.suggestions.filter(s=>originalById.has(s.blockId)).map(s=>({
   ...s,original:originalById.get(s.blockId),
   // AI is never authoritative evidence of a new fact. User must explicitly accept.
   evidenceStatus:'needs_user_confirmation'
  }));
  return send({ok:true,kind:'HHBA_RESUME_OPTIMIZATION_V1',provider:result.provider,suggestions,
   disclaimer:'建议仅用于优化表达，用户须逐条核实；不会修改原始简历或自动提高岗位匹配分。'});
 }catch(error){
  const code=['AI_PROVIDER_NOT_CONFIGURED','AI_PROVIDER_UNSUPPORTED'].includes(error?.message)?
   'AI_PROVIDER_NOT_CONFIGURED':'AI_OPTIMIZATION_UNAVAILABLE';
  console.warn('HHBA_RESUME_OPTIMIZATION_FAILED',code);
  return fail(code,502);
 }
}
