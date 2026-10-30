import {Database} from 'bun:sqlite';
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {existsSync,mkdirSync} from 'node:fs';
import {normalizeEngagement,validOrigin} from './engagement-core.mjs';

const COOKIE='hhba_visit_v1';
const RETENTION_DAYS=90;
let db:Database|null=null,secret='';
let lastCleanup=0;
const hits=new Map<string,{count:number,until:number}>();
function store(){
 if(db)return db;
 // In production, refuse non-persistent storage: /sync-state is an existing Railway volume.
 const dir=Bun.env.HHBA_ENGAGEMENT_DIR||'/sync-state';
 if(!existsSync(dir))throw Error('ENGAGEMENT_VOLUME_UNAVAILABLE');
 mkdirSync(dir,{recursive:true});
 const file=dir+'/hhba-engagement.sqlite';
 const next=new Database(file,{create:true,strict:true});
 next.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 next.exec(`CREATE TABLE IF NOT EXISTS engagement_config (id INTEGER PRIMARY KEY CHECK(id=1), secret TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS engagement_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 day TEXT NOT NULL, event_type TEXT NOT NULL, route TEXT NOT NULL,
 visitor_hash TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS engagement_day_event ON engagement_events(day,event_type);
 CREATE INDEX IF NOT EXISTS engagement_unique_visitor ON engagement_events(day,visitor_hash,event_type);`);
 let row=next.query('SELECT secret FROM engagement_config WHERE id=1').get() as {secret:string}|null;
 if(!row){const key=randomBytes(32).toString('hex');
   next.query('INSERT OR IGNORE INTO engagement_config(id,secret) VALUES(1,?)').run(key);
   row=next.query('SELECT secret FROM engagement_config WHERE id=1').get() as {secret:string}|null;
 }
 if(!row?.secret)throw Error('ENGAGEMENT_SECRET_UNAVAILABLE');
 secret=row.secret;db=next;return next;
}
function hash(value:string){return createHmac('sha256',secret).update(value).digest('hex');}
function cookie(req:Request):{raw:string,newCookie:string|null}{
 const matched=(req.headers.get('cookie')||'').match(/(?:^|;\s*)hhba_visit_v1=([A-Za-z0-9_.-]{1,150})(?:;|$)/);
 const token=matched?.[1]||'';
 const [value,sig]=token.split('.');
 if(value&&/^[a-f0-9]{32}$/.test(value)&&sig&&/^[a-f0-9]{64}$/.test(sig)){
  const correct=hash('cookie:'+value);
  if(timingSafeEqual(Buffer.from(sig),Buffer.from(correct)))return {raw:value,newCookie:null};
 }
 const id=randomBytes(16).toString('hex');
 const signed=id+'.'+hash('cookie:'+id);
 return {raw:id,newCookie:`${COOKIE}=${signed}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax; Secure`};
}
const json=(body:unknown,status=200,headers:Record<string,string>={})=>
 Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function prune(now:number){
 if(now-lastCleanup<86400000)return;
 lastCleanup=now;
 try{store().query('DELETE FROM engagement_events WHERE day < ?').run(new Date(now-RETENTION_DAYS*86400000).toISOString().slice(0,10));}catch{}
}
function throttle(id:string,now:number){
 if(hits.size>20000)hits.clear();
 const row=hits.get(id);
 if(!row||now>row.until){hits.set(id,{count:1,until:now+600000});return true;}
 row.count++;return row.count<=80;
}
export async function handleEngagement(req:Request,url:URL):Promise<Response|null>{
 if(!url.pathname.startsWith('/api/engagement/'))return null;
 if(url.pathname==='/api/engagement/event'){
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  if(!validOrigin(req.headers.get('origin'),req.url,Bun.env.RAILWAY_PUBLIC_DOMAIN||'')||req.headers.get('sec-fetch-site')==='cross-site')
   return json({error:'origin_denied'},403);
  if(req.headers.get('dnt')==='1'||req.headers.get('sec-gpc')==='1')
   return json({accepted:false,reason:'privacy_preference'},200);
  if(!(req.headers.get('content-type')||'').startsWith('application/json'))return json({error:'unsupported_type'},415);
  if(Number(req.headers.get('content-length')||0)>2048)return json({error:'oversized_event'},413);
  let item:any;
  try{item=normalizeEngagement(JSON.parse(await req.text()));}catch{return json({error:'invalid_json'},400)}
  if(!item)return json({error:'invalid_event'},400);
  try{
   const conn=store(),now=Date.now(),visitor=cookie(req);
   if(!throttle(visitor.raw,now))return json({accepted:false,reason:'rate_limited'},429);
   const day=new Date(now).toISOString().slice(0,10);
   // Pseudonym changes daily; cannot reconstruct a user's cross-day click history.
   conn.query('INSERT INTO engagement_events(day,event_type,route,visitor_hash,created_at) VALUES(?,?,?,?,?)')
    .run(day,item.type,item.path,hash(day+':'+visitor.raw),new Date(now).toISOString());
   prune(now);
   return json({accepted:true},200,visitor.newCookie?{'Set-Cookie':visitor.newCookie}:{});
  }catch(error){console.error('HHBA_ENGAGEMENT_STORE_UNAVAILABLE',error instanceof Error?error.message:'unknown');
   return json({error:'analytics_unavailable'},503);}
 }
 if(url.pathname==='/api/engagement/summary'){
  if(req.method!=='GET')return json({error:'method_not_allowed'},405);
  try{
   const conn=store();
   const days=Math.min(90,Math.max(1,Number.parseInt(url.searchParams.get('days')||'30',10)||30));
   const since=new Date(Date.now()-(days-1)*86400000).toISOString().slice(0,10);
   const rows=conn.query(`SELECT day,
    SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) AS pv,
    COUNT(DISTINCT CASE WHEN event_type='page_view' THEN visitor_hash ELSE NULL END) AS uv,
    SUM(CASE WHEN event_type='job_view' THEN 1 ELSE 0 END) AS jobViews,
    SUM(CASE WHEN event_type='job_search' THEN 1 ELSE 0 END) AS searches,
    SUM(CASE WHEN event_type='official_apply_click' THEN 1 ELSE 0 END) AS applyClicks
    FROM engagement_events WHERE day>=? GROUP BY day ORDER BY day ASC`).all(since) as any[];
   return json({kind:'HHBA_ENGAGEMENT_SUMMARY_V1',quality:'collected',
    definition:'Only same-origin opt-in anonymous events; UTC day. UV is distinct visitors per UTC day, not cross-day unique users.',
    since,asOf:new Date().toISOString(),days,series:rows.map(r=>({
     date:r.day,pv:Number(r.pv),uv:Number(r.uv),jobViews:Number(r.jobViews),
     searches:Number(r.searches),applyClicks:Number(r.applyClicks)}))});
  }catch{return json({kind:'HHBA_ENGAGEMENT_SUMMARY_V1',quality:'unavailable',series:[]},503);}
 }
 return json({error:'not_found'},404);
}
