// Private HHBA Phase 3.1 operations dashboard.
// Public recruitment site never serves or serializes these aggregates.
import {Database} from 'bun:sqlite';
import {createHmac,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {validOrigin} from './engagement-core.mjs';

const COOKIE='hhba_admin_v1',TTL=8*3600_000;
const CACHE='no-store, no-cache, must-revalidate';
const HEADERS={'Cache-Control':CACHE,'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:HEADERS});
const bad=(code:string,status:number)=>json({error:code},status);
function password(){const p=Bun.env.HHBA_ADMIN_PASSWORD;return typeof p==='string'&&p.length>=20?p:null}
function mac(value:string,p:string){return createHmac('sha256',p).update('hhba-admin-2026:'+value).digest('hex')}
function authenticated(req:Request,p:string):boolean{
 const token=(req.headers.get('cookie')||'').match(/(?:^|;\s*)hhba_admin_v1=([a-zA-Z0-9_.-]{1,220})(?:;|$)/)?.[1]||'';
 const parts=token.split('.');if(parts.length!==3)return false;
 const [expires,nonce,signature]=parts;
 if(!/^\d{13}$/.test(expires)||!Number.isSafeInteger(Number(expires))||Number(expires)<Date.now()||Number(expires)>Date.now()+TTL||!/^[a-f0-9]{32}$/.test(nonce)||!/^[a-f0-9]{64}$/.test(signature))return false;
 const expected=mac(expires+'.'+nonce,p);
 return timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
}
function cookie(p:string){
 const expiry=String(Date.now()+TTL),nonce=randomBytes(16).toString('hex');
 return `${COOKIE}=${expiry}.${nonce}.${mac(expiry+'.'+nonce,p)}; Max-Age=28800; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
function clearCookie(){return `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;}
function sameOrigin(req:Request){
 const fetchSite=req.headers.get('sec-fetch-site');
 if(fetchSite==='cross-site')return false;
 const configured=Bun.env.RAILWAY_PUBLIC_DOMAIN||'';
 const origin=req.headers.get('origin');
 // A real browser POST supplies Origin; never trust arbitrary forwarded-host headers.
 return validOrigin(origin,req.url,configured);
}
const attempts=new Map<string,{count:number,expires:number}>();
function loginAllowed(key:string){
 if(attempts.size>3000)attempts.clear();
 const now=Date.now(),r=attempts.get(key);
 if(!r||r.expires<now){attempts.set(key,{count:1,expires:now+15*60_000});return true}
 r.count++;return r.count<=8;
}
const html=(content:string,status=200)=>new Response(content,{status,headers:{...HEADERS,'Content-Security-Policy':HEADERS['Content-Security-Policy'].replace("style-src 'self'","style-src 'self' 'unsafe-inline'"),'Content-Type':'text/html; charset=utf-8'}});
function loginPage(error=false,disabled=false){
 return html(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>管理员登录 · HHBA</title>
 <style>:root{font-family:system-ui,"Microsoft YaHei",sans-serif;color:#24362a;background:#f6f9f6}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px}main{width:min(410px,100%);border:1px solid #dfe9e0;background:white;border-radius:18px;padding:36px;box-shadow:0 14px 42px #1b39200e}.logo{font-size:22px;font-weight:850;color:#326247}h1{font-size:23px;margin:27px 0 12px}p{font-size:13px;line-height:1.75;color:#718175}label{display:block;font-size:13px;font-weight:600;margin:23px 0 9px}input{display:block;width:100%;padding:13px;border:1px solid #d8e1d9;border-radius:9px;font-size:15px}button{background:#30674a;color:white;border:0;border-radius:9px;padding:13px;width:100%;margin-top:16px;font-weight:700;cursor:pointer}button:disabled{opacity:.5}.warn{color:#ad4a34}a{color:#386e4d;font-size:12px}</style></head><body><main>
 <div class="logo">HHBA.</div><h1>管理后台</h1><p>独立管理员身份验证 · 访问量、收藏量与岗位聚合数据仅供授权人员查看。</p>
 ${disabled?'<p class="warn">管理员凭据尚未配置。此入口暂时关闭。</p>':`<form action="/management/login" method="POST"><label for="password">管理员访问密码</label><input type="password" id="password" name="password" required autocomplete="current-password" minlength="20" autofocus>
 <button type="submit">进入管理中心</button></form>`}
 ${error?'<p class="warn">密码不正确或暂时访问受限。</p>':''}
 <p>求职者模拟账户不能登录此后台。请勿共享管理员访问凭据。</p><a href="/">返回 HHBA 招聘首页</a></main></body></html>`);
}
function openDb(file:string):Database|null{
 try{const dir=Bun.env.HHBA_ENGAGEMENT_DIR||'/sync-state';const path=dir+'/'+file;
  if(!existsSync(path))return null;
  const d=new Database(path,{readonly:true,strict:true});d.exec('PRAGMA busy_timeout=1000');return d;
 }catch{return null}
}
export function normalizePeriod(raw:string|null,now=new Date(),start:string|null=null,end:string|null=null){
 if(start!==null&&end!==null&&/^\d{4}-\d{2}-\d{2}$/.test(start)&&/^\d{4}-\d{2}-\d{2}$/.test(end)){
  const a=Date.parse(start+'T00:00:00Z'),b=Date.parse(end+'T00:00:00Z');
  const today=new Date(now).toISOString().slice(0,10);
  if(Number.isFinite(a)&&Number.isFinite(b)&&a<=b&&b<=Date.parse(today+'T00:00:00Z')){
   const days=Math.round((b-a)/86400_000)+1;
   if(days>=1&&days<=90)return {days,from:start,today:end};
  }
 }

 const days=raw==='1'?1:raw==='7'?7:raw==='90'?90:30;
 const today=new Date(now).toISOString().slice(0,10);
 const from=new Date(now.getTime()-(days-1)*86400_000).toISOString().slice(0,10);
 return {days,from,today};
}
export function privateGrowth(period:{days:number;from:string;today:string}){
 const rows:Record<string,{date:string;pv:number;uv:number;jobViews:number;searches:number;applyClicks:number}>={};
 for(let i=0;i<period.days;i++){
  const day=new Date(Date.parse(period.from+'T00:00:00Z')+i*86400_000).toISOString().slice(0,10);
  rows[day]={date:day,pv:0,uv:0,jobViews:0,searches:0,applyClicks:0};
 }
 let trafficQuality:'collected'|'unavailable'='unavailable';
 let bookmarksQuality:'collected'|'unavailable'='unavailable';
 let totalActiveBookmarks:number|null=null,devicesWithBookmarks:number|null=null,added=0,removed=0;
 const traffic=openDb('hhba-engagement.sqlite');
 if(traffic){
  try{
   const entries=traffic.query(`SELECT day,
     SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) pv,
     COUNT(DISTINCT CASE WHEN event_type='page_view' THEN visitor_hash END) uv,
     SUM(CASE WHEN event_type='job_view' THEN 1 ELSE 0 END) jobViews,
     SUM(CASE WHEN event_type='job_search' THEN 1 ELSE 0 END) searches,
     SUM(CASE WHEN event_type='official_apply_click' THEN 1 ELSE 0 END) applyClicks
     FROM engagement_events WHERE day BETWEEN ? AND ? GROUP BY day ORDER BY day`).all(period.from,period.today) as any[];
   for(const x of entries){const item=rows[x.day];if(item)for(const key of ['pv','uv','jobViews','searches','applyClicks'] as const)item[key]=Number(x[key]||0)}
   trafficQuality='collected';
  }catch{}finally{traffic.close()}
 }
 const saved=openDb('hhba-saved.sqlite');
 if(saved){
  try{
   totalActiveBookmarks=Number((saved.query('SELECT COUNT(*) n FROM saved_jobs').get() as any)?.n||0);
   devicesWithBookmarks=Number((saved.query('SELECT COUNT(DISTINCT device_hash) n FROM saved_jobs').get() as any)?.n||0);
   const events=saved.query("SELECT event,SUM(quantity) AS quantity FROM saved_events WHERE day BETWEEN ? AND ? AND event IN ('added','removed') GROUP BY event").all(period.from,period.today) as any[];
   for(const item of events){if(item.event==='added')added=Number(item.quantity);if(item.event==='removed')removed=Number(item.quantity)}
   bookmarksQuality='collected';
  }catch{totalActiveBookmarks=null;devicesWithBookmarks=null}finally{saved.close()}
 }
 const series=Object.values(rows);
 const total=(key:keyof typeof series[number])=>series.reduce((n,r)=>n+Number(r[key]||0),0);
 return {kind:'HHBA_PRIVATE_GROWTH_V1',asOf:new Date().toISOString(),
  period:{...period,timezone:'UTC'},
  traffic:{quality:trafficQuality,pv:trafficQuality==='collected'?total('pv'):null,
   dailyUvSum:trafficQuality==='collected'?total('uv'):null,
   jobViews:trafficQuality==='collected'?total('jobViews'):null,
   searches:trafficQuality==='collected'?total('searches'):null,
   applyClicks:trafficQuality==='collected'?total('applyClicks'):null,
   series:trafficQuality==='collected'?series:[]},
  bookmarks:{quality:bookmarksQuality,totalActive:totalActiveBookmarks,
   devicesWithBookmarks,added:bookmarksQuality==='collected'?added:null,removed:bookmarksQuality==='collected'?removed:null,
   scope:'DEVICE_ONLY_NOT_ACCOUNT_USERS'},
  unavailable:{registeredUsers:null,dau:null,mau:null,revenueCny:null},
  definitions:{pv:'经用户主动同意才记录的页面浏览事件；非全站完整流量',dailyUvSum:'按 UTC 天去重访客数之和，同一访客跨天可能重复；不是跨期独立 UV',bookmarks:'当前本设备持久收藏关系，不代表登录用户或投递数'}
 };
}
// Private administrative module directory: readiness metadata only.
// This Railway service does NOT host the isolated employer PostgreSQL workflows,
// and its password-only session does NOT grant any independent reviewer roles.
// Null is deliberately distinct from a measured count of 0.
export function privateAdminWorkspace(){
 const keys=[
  ['recruitment','招聘管理'],
  ['enterprise','企业档案'],
  ['evidence','企业证据核验'],
  ['care','员工关怀'],
  ['scoring','企业双评分'],
  ['appeals','独立申诉'],
  ['improvements','企业改善记录'],
  ['publication','评分发布治理'],
  ['aid','企业发展帮扶'],
  ['commercial','客户对接和订单证明']
 ] as const;
 return {
  kind:'HHBA_ADMIN_WORKSPACE_V1',
  scope:'PRIVATE_ADMIN_NAVIGATION_ONLY',
  sensitiveData:'not_connected',
  productionReviewerAuth:'not_connected',
  workflowDatabase:'not_connected',
  modules:keys.map(([key,title])=>({key,title,
    state:'not_connected',pending:null,total:null,updatedAt:null,
    source:'modules-05-12-isolated-development',
    reviewAllowed:false})),
  notice:'原管理员登录已保护此目录，但独立企业审核服务、数据库与 RBAC 尚未挂载；不得将空缺计作零。'
 };
}
const ROOT='/app/admin-console';
const FILES:{[key:string]:string}={'/management/styles.css':'styles.css','/management/dashboard.js':'dashboard.js','/management/unified-workbench.js':'unified-workbench.js','/management/unified-workbench.css':'unified-workbench.css','/management/favicon.svg':'favicon.svg'};
const TYPES:{[key:string]:string}={css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml'};
export async function handlePrivateAdmin(req:Request,url:URL):Promise<Response|null>{
 const path=url.pathname;
 if(path==='/api/engagement/summary'||path==='/api/saved/summary')
  return bad('ADMIN_AUTH_REQUIRED',401); // Deprecate unauthenticated Phase 3 summary endpoints.
 if(!(path==='/management'||path.startsWith('/management/')||path.startsWith('/api/admin/')))return null;
 const p=password();
 if(path==='/management')return new Response(null,{status:308,headers:{...HEADERS,Location:'/management/'}});
 if(!p)return path.startsWith('/api/')?bad('ADMIN_NOT_CONFIGURED',503):loginPage(false,true);
 if(path==='/management/login'&&req.method==='POST'){
  // Password verification, request size cap and server rate limit protect this
  // unauthenticated login endpoint. A strict Origin gate is brittle behind
  // Railway TLS termination and browser form POSTs (which may omit Origin).
  // No existing privileged session state is mutated without the admin secret.
  // Keep same-origin checks for authenticated state-changing actions, e.g. logout.
  if(!(req.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded'))return bad('BAD_CONTENT_TYPE',415);
  const key='admin-login-global'; // Fixed bucket; forwarded IP headers must not bypass brute-force throttling.
  if(!loginAllowed(key))return loginPage(true);
  if(Number(req.headers.get('content-length')||0)>512)return bad('PAYLOAD_TOO_LARGE',413);
  const body=await req.text();if(body.length>512)return bad('PAYLOAD_TOO_LARGE',413);
  const proposed=new URLSearchParams(body).get('password')||'';
  const a=createHash('sha256').update(proposed).digest(),b=createHash('sha256').update(p).digest();
  if(!timingSafeEqual(a,b))return loginPage(true);
  return new Response(null,{status:303,headers:{...HEADERS,Location:'/management/','Set-Cookie':cookie(p)}});
 }
 if(!authenticated(req,p)){
  return path.startsWith('/api/')?bad('ADMIN_AUTH_REQUIRED',401):loginPage();
 }
 if(path==='/management/login')return new Response(null,{status:303,headers:{...HEADERS,Location:'/management/'}});
 if(path==='/management/logout'){
  if(req.method!=='POST')return bad('METHOD_NOT_ALLOWED',405);
  if(!sameOrigin(req))return bad('ORIGIN_DENIED',403);
  return new Response(null,{status:303,headers:{...HEADERS,Location:'/management/login','Set-Cookie':clearCookie()}});
 }
 if(path==='/api/admin/workspace'&&req.method==='GET')return json(privateAdminWorkspace());
 if(path==='/api/admin/growth'&&req.method==='GET')return json(privateGrowth(normalizePeriod(url.searchParams.get('days'),new Date(),url.searchParams.get('from'),url.searchParams.get('to'))));
 if(path==='/api/admin/jobs'&&req.method==='GET'){
  try{
   const upstream=await fetch('https://yanm-jun.github.io/hhba-talent/admin-preview/data/overview.json',{
    method:'GET',headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000),cache:'no-store'});
   if(!upstream.ok||Number(upstream.headers.get('content-length')||0)>30000)return bad('JOB_SNAPSHOT_UNAVAILABLE',503);
   const data=await upstream.json() as any;
   if(data?.kind!=='HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2'||!['current','partial','stale','unavailable'].includes(data.quality)||!data.counts)return bad('JOB_SNAPSHOT_INVALID',503);
   return json(data);
  }catch{return bad('JOB_SNAPSHOT_UNAVAILABLE',503)}
 }

 if(path.startsWith('/api/admin/'))return bad('NOT_FOUND',404);
 if(!['GET','HEAD'].includes(req.method))return bad('METHOD_NOT_ALLOWED',405);
 let file:string;
 if(path==='/management'||path==='/management/'||path==='/management/index.html')file='index.html';
 else if(FILES[path])file=FILES[path];
 else return bad('NOT_FOUND',404);
 const asset=Bun.file(ROOT+'/'+file);
 if(!await asset.exists())return bad('ADMIN_FRONTEND_UNAVAILABLE',503);
 const ext=file.split('.').pop()||'html';
 return new Response(req.method==='HEAD'?null:asset,{headers:{...HEADERS,'Content-Type':TYPES[ext]||'text/html; charset=utf-8'}});
}
