import {Database} from 'bun:sqlite';
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {existsSync} from 'node:fs';
import {validOrigin} from './engagement-core.mjs';
const COOKIE='hhba_saved_v1';
let db:Database|null=null,secret='';
const response=(obj:unknown,status=200,headers:Record<string,string>={})=>
 Response.json(obj,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function database(){
 if(db)return db;
 const dir=Bun.env.HHBA_ENGAGEMENT_DIR||'/sync-state';
 if(!existsSync(dir))throw Error('SAVED_VOLUME_UNAVAILABLE');
 const x=new Database(dir+'/hhba-saved.sqlite',{create:true,strict:true});
 x.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS saved_secret(id INTEGER PRIMARY KEY CHECK(id=1),secret TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS saved_jobs(device_hash TEXT NOT NULL,job_id TEXT NOT NULL,
 created_at TEXT NOT NULL,PRIMARY KEY(device_hash,job_id));
 CREATE INDEX IF NOT EXISTS saved_job_count ON saved_jobs(job_id);
 CREATE TABLE IF NOT EXISTS saved_events(day TEXT NOT NULL,event TEXT NOT NULL,quantity INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,event));`);
 let row=x.query('SELECT secret FROM saved_secret WHERE id=1').get() as {secret:string}|null;
 if(!row){
  x.query('INSERT OR IGNORE INTO saved_secret VALUES(1,?)').run(randomBytes(32).toString('hex'));
  row=x.query('SELECT secret FROM saved_secret WHERE id=1').get() as {secret:string}|null;
 }
 if(!row?.secret)throw Error('SAVED_SECRET_UNAVAILABLE');
 secret=row.secret;db=x;return x;
}
const h=(s:string)=>createHmac('sha256',secret).update(s).digest('hex');
function owner(req:Request,create=false){
 const cookieString=req.headers.get('cookie')||'';
 const raw=cookieString.match(/(?:^|;\s*)hhba_saved_v1=([A-Za-z0-9_.-]{1,150})(?:;|$)/)?.[1]||'';
 const [id,sig]=raw.split('.');
 if(/^[a-f0-9]{32}$/.test(id||'')&&/^[a-f0-9]{64}$/.test(sig||'')&&
 timingSafeEqual(Buffer.from(sig),Buffer.from(h('device:'+id))))
  return {hash:h('device-hash:'+id),setCookie:null};
 if(!create)return null;
 const newId=randomBytes(16).toString('hex');
 return {hash:h('device-hash:'+newId),setCookie:`${COOKIE}=${newId}.${h('device:'+newId)}; Path=/; Max-Age=7776000; HttpOnly; SameSite=Lax; Secure`};
}
const jobId=/^[A-Za-z0-9_-]{1,180}$/;
const methodAllowed=(req:Request)=>validOrigin(req.headers.get('origin'),req.url,Bun.env.RAILWAY_PUBLIC_DOMAIN||'')&&req.headers.get('sec-fetch-site')!=='cross-site';
export async function handleSavedJobs(req:Request,url:URL,jobExists:(id:string)=>Promise<boolean>):Promise<Response|null>{
 if(!url.pathname.startsWith('/api/saved'))return null;
 if(url.pathname==='/api/saved/summary'){
  if(req.method!=='GET')return response({error:'method_not_allowed'},405);
  try{
   const d=database(),total=(d.query('SELECT COUNT(*) n FROM saved_jobs').get() as {n:number}).n;
   const devices=(d.query('SELECT COUNT(DISTINCT device_hash) n FROM saved_jobs').get() as {n:number}).n;
   const events=d.query("SELECT day,event,quantity FROM saved_events WHERE day>=date('now','-29 days') ORDER BY day ASC").all();
   return response({kind:'HHBA_ANONYMOUS_SAVED_SUMMARY_V1',quality:'collected',
    scope:'device_scoped_not_authenticated',totalActiveBookmarks:total,
    devicesWithBookmarks:devices,events,asOf:new Date().toISOString()});
  }catch{return response({quality:'unavailable',error:'storage_unavailable'},503)}
 }
 if(url.pathname==='/api/saved'){
  if(req.method!=='GET')return response({error:'method_not_allowed'},405);
  try{const d=database(),o=owner(req);
   const items=o?d.query('SELECT job_id as jobId,created_at as savedAt FROM saved_jobs WHERE device_hash=? ORDER BY created_at DESC LIMIT 300').all(o.hash):[];
   return response({kind:'HHBA_DEVICE_SAVED_JOBS_V1',scope:'this_browser_only',items});}
  catch{return response({error:'storage_unavailable'},503)}
 }
 const match=url.pathname.match(/^\/api\/saved\/([A-Za-z0-9_-]{1,180})$/);
 if(!match)return response({error:'not_found'},404);
 if(!['PUT','DELETE'].includes(req.method))return response({error:'method_not_allowed'},405);
 if(!methodAllowed(req))return response({error:'origin_denied'},403);
 const id=match[1];
 if(!jobId.test(id))return response({error:'invalid_job_id'},400);
 try{
  const d=database(),o=owner(req,req.method==='PUT');
  if(!o)return response({saved:false,id});
  if(req.method==='PUT'&&!(await jobExists(id)))return response({error:'job_not_in_index'},404);
  const day=new Date().toISOString().slice(0,10);
  const changed=d.transaction(()=>{
   if(req.method==='PUT'){
    const size=(d.query('SELECT COUNT(*) n FROM saved_jobs WHERE device_hash=?').get(o.hash) as {n:number}).n;
    if(size>=300)throw Error('SAVED_LIMIT_REACHED');
    const update=d.query('INSERT OR IGNORE INTO saved_jobs(device_hash,job_id,created_at) VALUES(?,?,?)').run(o.hash,id,new Date().toISOString());
    return Number(update.changes)>0?'added':null;
   }
   const removed=d.query('DELETE FROM saved_jobs WHERE device_hash=? AND job_id=?').run(o.hash,id);
   return Number(removed.changes)>0?'removed':null;
  })();
  if(changed){
   d.query('INSERT INTO saved_events(day,event,quantity) VALUES(?,?,1) ON CONFLICT(day,event) DO UPDATE SET quantity=quantity+1').run(day,changed);
  }
  return response({saved:req.method==='PUT',jobId:id,changed:Boolean(changed),scope:'this_browser_only'},200,
   o.setCookie?{'Set-Cookie':o.setCookie}:{});
 }catch(e){
  return response({error:e instanceof Error&&e.message==='SAVED_LIMIT_REACHED'?'saved_limit_reached':'storage_unavailable'},503);
 }
}
