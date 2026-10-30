import {Database} from "bun:sqlite";
import {mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {dirname,resolve,sep} from "node:path";

const ID=/^(greenhouse|ashby|lever)-[A-Za-z0-9_-]{1,170}$/;
const HASH=/^[a-f0-9]{64}$/;
const TTL=30*86400000;
const MAX_READY_AGE=7*86400000;
const FEATURED_PREWARM_IDS=new Set([
 "ashby-openai-18e64608-5881-4b8f-b5cf-abd09a8ff086",
 "ashby-openai-7ba0b390-b198-4101-80bb-b49a6dd62607",
 "greenhouse-anthropic-5426627008",
 "greenhouse-anthropic-5391293008",
 "greenhouse-spacex-8885762002",
 "greenhouse-spacex-8621995002"
]);
function verify(id,hash,part,total){
 if(typeof id!=="string"||!ID.test(id))throw Error("INVALID_JOB_ID");
 if(hash!==undefined&&(typeof hash!=="string"||!HASH.test(hash)))throw Error("INVALID_SOURCE_HASH");
 if(part!==undefined&&(!Number.isInteger(total)||total<1||total>150||!Number.isInteger(part)||part<0||part>=total))throw Error("INVALID_JD_PART");
}
export function openJobSyncStore(file,{now=()=>Date.now(),root="/sync-state"}={}){
 if(typeof file!=="string"||!file.endsWith(".sqlite")||!resolve(file).startsWith(resolve(root)+sep))
   throw Error("JOB_SYNC_MUST_USE_PRIVATE_VOLUME");
 mkdirSync(dirname(file),{recursive:true});
 const db=new Database(file,{create:true});
 db.exec("PRAGMA journal_mode=WAL;PRAGMA busy_timeout=3000");
 db.exec("CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY,platform TEXT NOT NULL,company TEXT NOT NULL,url TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'QUEUED',hash TEXT,total INTEGER,done INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,next_ms INTEGER NOT NULL DEFAULT 0,lease_ms INTEGER NOT NULL DEFAULT 0,seen_ms INTEGER NOT NULL,checked_ms INTEGER,error TEXT,priority INTEGER NOT NULL DEFAULT 0)");
 db.exec("CREATE TABLE IF NOT EXISTS parts (id TEXT NOT NULL,hash TEXT NOT NULL,part INTEGER NOT NULL,total INTEGER NOT NULL,zh TEXT NOT NULL,expire_ms INTEGER NOT NULL,PRIMARY KEY(id,hash,part))");
 db.exec("CREATE INDEX IF NOT EXISTS idx_jd_sync_queue ON jobs(state,next_ms,priority)");
 db.exec("CREATE INDEX IF NOT EXISTS idx_jd_sync_expire ON parts(expire_ms)");
 db.exec("CREATE TABLE IF NOT EXISTS sync_budget(day TEXT PRIMARY KEY,used INTEGER NOT NULL DEFAULT 0)");
 // Private bounded cache; not included in public search snapshots or GitHub.
 db.exec("CREATE TABLE IF NOT EXISTS source_documents (id TEXT PRIMARY KEY,hash TEXT NOT NULL,english TEXT NOT NULL,checked_ms INTEGER NOT NULL,expire_ms INTEGER NOT NULL)");
 db.exec("CREATE INDEX IF NOT EXISTS idx_jd_english_expiry ON source_documents(expire_ms)");
 const upsertEnglish=db.query("INSERT INTO source_documents(id,hash,english,checked_ms,expire_ms) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash,english=excluded.english,checked_ms=excluded.checked_ms,expire_ms=excluded.expire_ms");
 const readEnglish=db.query("SELECT hash,english,checked_ms,expire_ms FROM source_documents WHERE id=?");
 const readParts=db.query("SELECT part,total,zh,expire_ms FROM parts WHERE id=? AND hash=? ORDER BY part ASC");
 const read=db.query("SELECT * FROM jobs WHERE id=?");
 const count=db.query("SELECT COUNT(*) AS n FROM parts WHERE id=? AND hash=? AND expire_ms>?");
 const getPart=db.query("SELECT zh,total,expire_ms FROM parts WHERE id=? AND hash=? AND part=?");
 const removeParts=db.query("DELETE FROM parts WHERE id=?");
 const updateSource=db.query("UPDATE jobs SET hash=?,total=?,done=?,state=?,checked_ms=?,lease_ms=CASE WHEN state='WORKING' AND lease_ms>? THEN lease_ms ELSE 0 END,next_ms=0,error=NULL,attempts=CASE WHEN ?=1 THEN 0 WHEN hash IS NOT ? THEN CASE WHEN state='WORKING' THEN 1 ELSE 0 END ELSE attempts END WHERE id=?");
 const insertPart=db.query("INSERT INTO parts(id,hash,part,total,zh,expire_ms) VALUES(?,?,?,?,?,?) ON CONFLICT(id,hash,part) DO UPDATE SET zh=excluded.zh,total=excluded.total,expire_ms=excluded.expire_ms");
 const updatePart=db.query("UPDATE jobs SET done=?,state=?,checked_ms=?,lease_ms=CASE WHEN state='WORKING' AND lease_ms>? THEN lease_ms ELSE 0 END,next_ms=0,error=NULL WHERE id=?");
 const upsert=db.query("INSERT INTO jobs(id,platform,company,url,seen_ms,priority) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET platform=excluded.platform,company=excluded.company,url=excluded.url,seen_ms=excluded.seen_ms,priority=excluded.priority,state=CASE WHEN jobs.url<>excluded.url OR jobs.state='REMOVED' THEN 'QUEUED' ELSE jobs.state END,hash=CASE WHEN jobs.url<>excluded.url THEN NULL ELSE jobs.hash END,total=CASE WHEN jobs.url<>excluded.url THEN NULL ELSE jobs.total END,done=CASE WHEN jobs.url<>excluded.url THEN 0 ELSE jobs.done END,next_ms=CASE WHEN jobs.url<>excluded.url THEN 0 ELSE jobs.next_ms END,lease_ms=CASE WHEN jobs.url<>excluded.url THEN 0 ELSE jobs.lease_ms END");
 function catalogSync(rows,{complete=false}={}){
  if(!Array.isArray(rows)||rows.length>100000)throw Error("INVALID_INDEX");
  const latest=Number(db.query("SELECT COALESCE(MAX(seen_ms),0) AS value FROM jobs").get().value)||0;
  const ts=Math.max(now(),latest+1),seen=new Set(),clean=[];
  for(const j of rows){
   if(!j||j.domestic||!["greenhouse","ashby","lever"].includes(j.platform)||!ID.test(j.id)||seen.has(j.id))continue;
   try{const u=new URL(j.url);if(u.protocol!=="https:"||u.port||u.username||u.password)continue}catch{continue}
   seen.add(j.id);clean.push(j);
  }
  if(complete&&!clean.length)throw Error("EMPTY_COMPLETE_ATS_FEED");
  db.transaction(()=>{
   for(const j of clean){
    const priority=FEATURED_PREWARM_IDS.has(j.id)?100:["SpaceX","Anthropic","OpenAI","Stripe","Airbnb"].includes(j.company)?1:0;
    upsert.run(j.id,j.platform,String(j.company||"UNKNOWN").slice(0,180),j.url,ts,priority);
   }
   if(complete)db.query("UPDATE jobs SET state='REMOVED',lease_ms=0,error='MISSING_FROM_COMPLETE_ATS_FEED' WHERE seen_ms<?").run(ts);
  })();
  return {discovered:clean.length,complete_snapshot:complete};
 }
 function sourceVersion(id,hash,total,english){
  verify(id,hash,0,total);
  return db.transaction(()=>{
   const j=read.get(id);
   if(!j||j.state==="REMOVED")throw Error("JOB_NOT_IN_CURRENT_INDEX");
   if(j.hash!==hash)removeParts.run(id);
   if(english!==undefined){
    if(typeof english!=="string"||!english.trim()||english.length>100000||
       createHash("sha256").update(english).digest("hex")!==hash)
      throw Error("ENGLISH_SOURCE_HASH_INVALID");
    upsertEnglish.run(id,hash,english,now(),now()+TTL);
   }
   const n=Number(count.get(id,hash,now()).n);
   updateSource.run(hash,total,n,n===total?"COMPLETE":j.state==="WORKING"&&j.lease_ms>now()?"WORKING":"TRANSLATING",now(),now(),n===total?1:0,hash,id);
   return {total,done:n,complete:n===total,source_changed:j.hash!==hash};
  })();
 }
 function readyDocument(id,expectedUrl){
  verify(id);
  const job=read.get(id);
  if(!job||job.state==="REMOVED"||
     (expectedUrl&&job.url!==expectedUrl)||!HASH.test(job.hash||"")||
     !Number.isInteger(job.total)||job.total<1||job.total>150)return null;
  const original=readEnglish.get(id);
  if(!original||original.hash!==job.hash||
     original.expire_ms<=now()||original.checked_ms<now()-MAX_READY_AGE||
     createHash("sha256").update(original.english).digest("hex")!==job.hash)return null;
  const parts=readParts.all(id,job.hash);
  const complete=parts.length===job.total&&parts.every((p,index)=>
    p.part===index&&p.total===job.total&&p.expire_ms>now()&&
    typeof p.zh==="string"&&/[一-龥]/.test(p.zh));
  return {jobId:id,sourceHash:job.hash,sourceUrl:job.url,
    checkedAt:new Date(original.checked_ms).toISOString(),originalText:original.english,
    chineseText:complete?parts.map(p=>p.zh).join("\n\n"):null,
    ready:complete,done:complete?job.total:parts.filter(p=>p.expire_ms>now()).length,total:job.total};
 }
 function cachedPart(id,hash,part,total){
  verify(id,hash,part,total);
  const p=getPart.get(id,hash,part);
  return p&&p.total===total&&p.expire_ms>now()?p.zh:null;
 }
 function saveVerifiedPart(id,hash,part,total,zh){
  verify(id,hash,part,total);
  if(typeof zh!=="string"||zh.length<2||zh.length>16000||!/[一-龥]/.test(zh)||/\uFFFD/.test(zh))
   throw Error("INVALID_TRANSLATION");
  return db.transaction(()=>{
   const j=read.get(id);
   if(!j||j.state==="REMOVED"||j.hash!==hash||j.total!==total)throw Error("SOURCE_VERSION_CHANGED");
   const ts=now();
   insertPart.run(id,hash,part,total,zh,ts+TTL);
   const n=Number(count.get(id,hash,ts).n);
   const complete=n===total;
   updatePart.run(n,complete?"COMPLETE":j.state==="WORKING"&&j.lease_ms>ts?"WORKING":"TRANSLATING",ts,ts,id);
   return {done:n,total,complete};
  })();
 }
 const claimTxn=db.transaction(()=>{
  const ts=now();
  const job=db.query("SELECT * FROM jobs WHERE ((state IN ('QUEUED','TRANSLATING','RETRY') AND next_ms<=?) OR (state='WORKING' AND lease_ms<?) OR (state='COMPLETE' AND checked_ms<?)) AND attempts<12 ORDER BY CASE WHEN state='COMPLETE' THEN 1 ELSE 0 END ASC,priority DESC,next_ms ASC,seen_ms ASC,id LIMIT 1").get(ts,ts,ts-7*86400000);
  if(!job)return null;
  db.query("UPDATE jobs SET state='WORKING',attempts=attempts+1,lease_ms=? WHERE id=?").run(ts+180000,job.id);
  return job;
 });
 function fail(id,reason,{permanent=false}={}){
  verify(id);
  const j=read.get(id);if(!j||j.state==="REMOVED")return;
  const delay=Math.min(12*3600000,60000*2**Math.min(9,j.attempts||1));
  db.query("UPDATE jobs SET state=?,error=?,next_ms=?,lease_ms=0 WHERE id=?")
   .run(permanent||j.attempts>=12?"NEEDS_REVIEW":"RETRY",String(reason).slice(0,120),now()+delay,id);
 }
 function release(id){
  verify(id);
  db.query("UPDATE jobs SET state=CASE WHEN hash IS NULL THEN 'QUEUED' ELSE 'TRANSLATING' END,lease_ms=0,attempts=0 WHERE id=? AND state='WORKING'").run(id);
 }
 function cleanup(){
  const ts=now();
  const expired=db.query("DELETE FROM parts WHERE expire_ms<=?").run(ts).changes;
  db.query("DELETE FROM source_documents WHERE expire_ms<=?").run(ts);
  db.query("UPDATE jobs SET done=(SELECT COUNT(*) FROM parts WHERE parts.id=jobs.id AND parts.hash=jobs.hash AND parts.expire_ms>?) WHERE state='COMPLETE'").run(ts);
  db.query("UPDATE jobs SET state='TRANSLATING',next_ms=0 WHERE state='COMPLETE' AND done<total").run();
  return {expired};
 }
 const budgetTxn=db.transaction(limit=>{
  if(!Number.isInteger(limit)||limit<1||limit>100000)throw Error("INVALID_SYNC_BUDGET");
  const day=new Date(now()).toISOString().slice(0,10);
  const used=Number(db.query("SELECT used FROM sync_budget WHERE day=?").get(day)?.used||0);
  if(used>=limit)return false;
  db.query("INSERT INTO sync_budget(day,used) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET used=used+1").run(day);
  return true;
 });
 function remainingBudget(limit){
  const day=new Date(now()).toISOString().slice(0,10);
  const used=Number(db.query("SELECT used FROM sync_budget WHERE day=?").get(day)?.used||0);
  return Math.max(0,Math.min(100000,limit)-used);
 }
 function coverage(){
  const groups=db.query("SELECT state,COUNT(*) AS n FROM jobs GROUP BY state").all();
  const counts=Object.fromEntries(groups.map(g=>[g.state,g.n]));
  const all=db.query("SELECT COUNT(*) AS total,COALESCE(SUM(done),0) AS translated_parts,COALESCE(SUM(total),0) AS expected_parts FROM jobs WHERE state<>'REMOVED'").get();
  return {kind:"HHBA_OVERSEAS_JD_SYNC_V1",total_current:all.total,complete:counts.COMPLETE||0,translated_parts:all.translated_parts,
   expected_parts:all.expected_parts,states:counts,checked_at:new Date(now()).toISOString(),translation_quality:"MACHINE_UNREVIEWED",
   note:"COMPLETE only means all source-hash-bound segments passed mechanical validation; human and rights review not implied"};
 }
 function metadata(id){
  verify(id);
  const j=read.get(id);
  if(!j)return null;
  return {id:j.id,state:j.state,done:j.done,total:j.total,last_error:j.error,
   checked_at:j.checked_ms?new Date(j.checked_ms).toISOString():null};
 }
 return {db,catalogSync,sourceVersion,readyDocument,cachedPart,saveVerifiedPart,claim:()=>claimTxn(),fail,release,cleanup,coverage,metadata,reserveBudget:limit=>budgetTxn(limit),remainingBudget,close:()=>db.close()};
}
