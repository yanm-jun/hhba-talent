import http from "node:http";
import {readFileSync} from "node:fs";
import {boards,snapshot,sourceStatus,refresh,filterJobs} from "./store.mjs";
import {home} from "./page.mjs";
const port=Number(process.env.PORT||8080);
const app=readFileSync(new URL("./app.js",import.meta.url),"utf8");
function headers(type){return {"content-type":type,"cache-control":"no-store","x-content-type-options":"nosniff",
 "referrer-policy":"strict-origin-when-cross-origin","x-frame-options":"DENY"}}
function send(res,status,payload){res.writeHead(status,headers("application/json; charset=utf-8"));res.end(JSON.stringify(payload))}
const server=http.createServer((req,res)=>{
 try{
  if(req.method!=="GET")return send(res,405,{error:"method_not_allowed"});
  const u=new URL(req.url||"/","http://localhost");
  if(u.pathname==="/health")return send(res,200,{online:true,ready:!!snapshot.updatedAt,allJobs:snapshot.jobs.length,
    boards:boards.length,successBoards:snapshot.successBoards,failedBoards:snapshot.failedBoards,
    staleBoards:snapshot.staleBoards,updatedAt:snapshot.updatedAt});
  if(u.pathname==="/ready")return send(res,snapshot.jobs.length?200:503,{ready:!!snapshot.jobs.length});
  if(u.pathname==="/api/boards")return send(res,200,{boards:sourceStatus(),updatedAt:snapshot.updatedAt});
  if(u.pathname==="/api/jobs/page"){
   const limit=Math.max(1,Math.min(60,Number.parseInt(u.searchParams.get("limit")||"30",10)||30));
   const offset=Math.max(0,Math.min(50000,Number.parseInt(u.searchParams.get("offset")||"0",10)||0));
   const rows=filterJobs(u.searchParams);
   return send(res,snapshot.updatedAt?200:503,{jobs:rows.slice(offset,offset+limit),total:rows.length,
     allJobs:snapshot.jobs.length,limit,offset,boards:boards.length,
     successBoards:snapshot.successBoards,failedBoards:snapshot.failedBoards,staleBoards:snapshot.staleBoards,
     updatedAt:snapshot.updatedAt});
  }
  if(u.pathname.startsWith("/api/jobs/")){
   const id=u.pathname.slice("/api/jobs/".length);
   if(!/^[a-f0-9]{32}$/.test(id))return send(res,404,{error:"not_found"});
   const job=snapshot.jobs.find(j=>j.id===id);
   return send(res,job?200:404,job?{job}:{error:"not_found"});
  }
  if(u.pathname==="/app.js"){res.writeHead(200,headers("text/javascript; charset=utf-8"));return res.end(app)}
  if(u.pathname==="/"||u.pathname.startsWith("/jobs/")){res.writeHead(200,headers("text/html; charset=utf-8"));return res.end(home())}
  return send(res,404,{error:"not_found"});
 }catch(e){console.error("HHBA_INDEXER_REQUEST_ERROR",e?.message);return send(res,500,{error:"server_error"})}
});
server.listen(port,"0.0.0.0",()=>{
 console.log("HHBA_INDEXER_READY",JSON.stringify({port,configuredBoards:boards.length}));
 refresh().then(async()=>{
  const base="http://127.0.0.1:"+port;
  const checks=[];
  for(const company of ["OpenAI","Cursor","Mercor","Form Energy","ShopBack","AlphaSights Campus Recruiting","General Robotics"]){
   const r=await fetch(base+"/api/jobs/page?company="+encodeURIComponent(company)+"&limit=2",{signal:AbortSignal.timeout(8000)});
   const body=r.ok?await r.json():{};
   checks.push({company,http:r.status,total:body.total??null,firstMatched:body.jobs?.[0]?.company===company||false});
  }
  const health=await fetch(base+"/health",{signal:AbortSignal.timeout(8000)}),ready=await fetch(base+"/ready",{signal:AbortSignal.timeout(8000)});
  const first=snapshot.jobs[0];
  const detail=first?await fetch(base+"/api/jobs/"+first.id,{signal:AbortSignal.timeout(8000)}):null;
  const p1=await(await fetch(base+"/api/jobs/page?company=OpenAI&limit=1&offset=0")).json();
  const p2=await(await fetch(base+"/api/jobs/page?company=OpenAI&limit=1&offset=1")).json();
  const pagesDistinct=!!p1.jobs?.length&&!!p2.jobs?.length&&p1.jobs[0].id!==p2.jobs[0].id;
  console.log("HHBA_INDEXER_E2E",JSON.stringify({health:health.status,ready:ready.status,detail:detail?.status||null,pagesDistinct,checks,
   pass:health.ok&&ready.ok&&detail?.ok&&pagesDistinct&&checks.every(c=>c.http===200)}));
 }).catch(e=>console.error("HHBA_INDEXER_E2E_ERROR",e?.message));
 setInterval(()=>refresh().catch(e=>console.error("HHBA_INDEXER_SYNC_FAILED",e?.message)),15*60*1000).unref();
});
