import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 classificationForCheck,recordJdPostingCheck,readJdPostingState,
 jdLifecycleReady,isUsablePosting
} from '../functions/_lib/jd-posting-lifecycle.js';
import {runJdRetentionSweep,verifyJdMaintenanceSource,runJdLifecycleMaintenance}
 from '../functions/_lib/jd-lifecycle-maintenance.js';
import {fetchPublicAtsJd} from '../functions/_lib/public-ats-jd.js';
import {directOfficialJobEvidence} from '../functions/_lib/official-job-evidence.js';
const URL='https://job-boards.greenhouse.io/hhbaexample/jobs/1234567';
const ID='jd_'+'a'.repeat(32);
const HASH='b'.repeat(64);
const KEY='official-jds/v1/'+'c'.repeat(32)+'/'+HASH+'.json';
const HO=1000*60*60,DAY=24*HO;
const at=daysBefore=>new Date(Date.now()-daysBefore*DAY);
const httpGone=status=>Object.assign(new Error('original source gone'),{httpStatus:status});

function stateDB(){
 const records=new Map(),versions=new Map(),audit=[];
 const db={records,versions,audit,
  prepare(sql){let args=[];
   const q={
    bind(...v){args=v;return q},
    async all(){
     if(sql.includes('sqlite_master'))return {results:[
      {name:'hhba_jd_posting_lifecycle'},{name:'hhba_jd_retention_audit'}]};
     if(sql.startsWith('SELECT canonical_url,proof_method,status'))return {
      results:[...records.values()].filter(x=>x.next_check_at<=args[0]).slice(0,args[1])};
     throw Error('Unexpected lifecycle list '+sql);
    },
    async first(){
     if(sql.includes('WHERE canonical_url=?'))return records.get(args[0])||null;
     throw Error('Unexpected lifecycle read '+sql);
    },
    async run(){
     if(sql.startsWith('INSERT INTO hhba_jd_posting_lifecycle')){
      const [canonical_url,proof_method,status,last_active_at,last_checked_at,
       next_check_at,first_gone_at,last_gone_at,gone_count,closed_at,
       uncertain_count,last_reason,updated_at]=args;
      records.set(canonical_url,{canonical_url,proof_method,status,last_active_at,last_checked_at,
       next_check_at,first_gone_at,last_gone_at,gone_count,closed_at,
       uncertain_count,last_reason,updated_at});
      return {success:true,meta:{changes:1}};
     }
     if(sql.startsWith('DELETE FROM hhba_job_ats_jd_versions')){
      const row=versions.get(args[0]);
      const ok=Boolean(row&&row.canonical_url===args[1]&&row.object_key===args[2]);
      if(ok)versions.delete(args[0]);
      return {success:true,meta:{changes:ok?1:0}};
     }
     if(sql.startsWith('INSERT INTO hhba_jd_retention_audit')){
      audit.push(args);return {success:true,meta:{changes:1}};
     }
     throw Error('Unexpected lifecycle write '+sql);
    }
   };
   return q;
  }
 };
 return db;
}
function makeEnv({pinned=false,historyError=false}={}){
 const db=stateDB(),objects=new Map([[KEY,{customMetadata:{jd_sha256:HASH}}]]);
 let deletes=0,historyReads=0;
 const r2={
  async head(key){return objects.get(key)||null},
  async delete(key){deletes++;objects.delete(key)},
  async get(key){return objects.get(key)||null},
  async put(){}
 };
 const auth={prepare(sql){
  assert.match(sql,/hhba_ai_match_history/);
  assert.match(sql,/json_each/);
  return {bind(id){return {async first(){historyReads++;
   if(historyError)throw Error('history D1 unavailable');
   return pinned&&id===ID?{pinned:1}:null;
  }}}};
 }};
 return {HHBA_JOB_JD_DB:db,HHBA_JOB_JD_R2:r2,HHBA_PNVS_AUTH_DB:auth,
  HHBA_AUTH_ROLLOUT:'preview',
  _db:db,_objects:objects,
  get deletionCount(){return deletes},
  get historyReads(){return historyReads}};
}
async function closePosting(env,now=new Date()){
 await recordJdPostingCheck(env,URL,{now:new Date(now.getTime()-36*DAY)});
 await recordJdPostingCheck(env,URL,{error:httpGone(404),
  now:new Date(now.getTime()-35*DAY-8*HO)});
 await recordJdPostingCheck(env,URL,{error:httpGone(410),
  now:new Date(now.getTime()-35*DAY)});
 const row=await readJdPostingState(env,URL);
 assert.equal(row.status,'CLOSED');
 return row;
}
function candidate(state){
 return {id:ID,canonical_url:URL,object_key:KEY,jd_sha256:HASH,
  last_verified_at:at(37).toISOString(),closed_at:state.closed_at,
  status:state.status,table:'hhba_job_ats_jd_versions'};
}

test('two distinct original detail 404/410 checks, at least 6h apart, are required to close',()=>{
 const a=new Date('2026-11-01T00:00:00Z');
 let s=classificationForCheck(null,null,a);
 assert.equal(s.status,'ACTIVE');
 s=classificationForCheck(s,httpGone(404),new Date(a.getTime()+HO));
 assert.equal(s.status,'RECHECK');
 assert.equal(s.gone_count,1);
 const first=s.first_gone_at;
 s=classificationForCheck(s,httpGone(404),new Date(a.getTime()+2*HO));
 assert.equal(s.gone_count,1);
 assert.equal(s.first_gone_at,first);
 assert.equal(s.status,'RECHECK');
 s=classificationForCheck(s,httpGone(410),new Date(a.getTime()+8*HO));
 assert.equal(s.status,'CLOSED');
 assert.equal(s.gone_count,2);
 assert.ok(s.closed_at);
 assert.equal(isUsablePosting(s),false);
 const later=classificationForCheck(s,new Error('502'),new Date(a.getTime()+11*HO));
 assert.equal(later.status,'CLOSED','a 502 cannot re-open a closed job');
 const reopened=classificationForCheck(s,null,new Date(a.getTime()+DAY));
 assert.equal(reopened.status,'ACTIVE');
 assert.equal(reopened.closed_at,null);
 assert.equal(reopened.gone_count,0);
});
test('network timeout, 403, 429 and 503 never confirm vacancy closure',()=>{
 for(const error of [
  new Error('TIMEOUT'),httpGone(403),httpGone(429),httpGone(503)]){
  let s=classificationForCheck(null,error);
  assert.equal(s.status,'RECHECK');
  assert.equal(s.gone_count,0);
  s=classificationForCheck(s,error);
  assert.equal(s.status,'RECHECK');
 }
});
test('fail-closed preview D1 state and immutable lifecycle save',async()=>{
 const env=makeEnv();
 assert.equal(await jdLifecycleReady(env),true);
 const start=new Date();
 await recordJdPostingCheck(env,URL,{now:start});
 assert.equal((await readJdPostingState(env,URL)).status,'ACTIVE');
 await recordJdPostingCheck(env,URL,{error:httpGone(404),now:new Date(start.getTime()+HO)});
 assert.equal((await readJdPostingState(env,URL)).status,'RECHECK');
 await recordJdPostingCheck(env,URL,{error:httpGone(410),now:new Date(start.getTime()+9*HO)});
 assert.equal((await readJdPostingState(env,URL)).status,'CLOSED');
});
test('real ATS 404 retains HTTP status needed for closure evidence',async()=>{
 await assert.rejects(fetchPublicAtsJd(URL,{
  fetcher:async()=>new Response('',{status:404,headers:{'Content-Type':'application/json'}})
 }),e=>e.httpStatus===404);
 await assert.rejects(fetchPublicAtsJd(URL,{
  fetcher:async()=>new Response('',{status:429,headers:{'Content-Type':'application/json'}})
 }),e=>e.httpStatus===undefined);
});
test('indeterminate scheduled verification cannot close or delete a JD',async()=>{
 const env=makeEnv(),now=new Date();
 await recordJdPostingCheck(env,URL,{now:new Date(now.getTime()-DAY)});
 const result=await verifyJdMaintenanceSource(env,{
  canonical_url:URL,proof_method:'PUBLIC_EMPLOYER_ATS_V1',status:'ACTIVE'},
  {now,deps:{fetchAts:async()=>{throw httpGone(429)}}});
 assert.equal(result.status,'RECHECK');
 assert.equal((await readJdPostingState(env,URL)).gone_count,0);
});
test('retention is DRY RUN even when closed 35 days and no history references',async()=>{
 const env=makeEnv(),state=await closePosting(env);
 const row=candidate(state);
 env._db.versions.set(ID,row);
 const result=await runJdRetentionSweep(env,{deps:{candidates:[row]}});
 assert.equal(result.eligible,1);
 assert.equal(result.purged,0);
 assert.equal(result.dry_run,true);
 assert.equal(env.deletionCount,0);
 assert.equal(env._db.versions.has(ID),true);
});
test('historical reference always prevents deletion, even with deletion enabled',async()=>{
 const env=makeEnv({pinned:true}),state=await closePosting(env),row=candidate(state);
 env._db.versions.set(ID,row);
 env.HHBA_JD_RETENTION_DELETE_ENABLED='1';
 const result=await runJdRetentionSweep(env,{dryRun:false,deps:{candidates:[row]}});
 assert.equal(result.pinned,1);
 assert.equal(result.purged,0);
 assert.equal(env.deletionCount,0);
});
test('history unavailable prevents deletion rather than treating missing data as unreferenced',async()=>{
 const env=makeEnv({historyError:true}),state=await closePosting(env),row=candidate(state);
 env._db.versions.set(ID,row);env.HHBA_JD_RETENTION_DELETE_ENABLED='1';
 const result=await runJdRetentionSweep(env,{dryRun:false,deps:{candidates:[row]}});
 assert.equal(result.blocked,1);
 assert.equal(result.purged,0);
 assert.equal(env.deletionCount,0);
});
test('explicitly enabled retention removes only old, closed, unreferenced version with audit',async()=>{
 const env=makeEnv(),state=await closePosting(env),row=candidate(state);
 env._db.versions.set(ID,row);env.HHBA_JD_RETENTION_DELETE_ENABLED='1';
 const result=await runJdRetentionSweep(env,{dryRun:false,deps:{candidates:[row]}});
 assert.equal(result.purged,1);
 assert.equal(env.deletionCount,1);
 assert.equal(env._db.versions.has(ID),false);
 assert.equal(env._db.audit.length,1);
 assert.equal(env._db.audit[0][2],'PURGED');
 assert.ok(env.historyReads>=2);
});
test('active or 29-day closed vacancies never qualify for deletion',async()=>{
 const env=makeEnv();const state=await closePosting(env),row=candidate(state);
 env.HHBA_JD_RETENTION_DELETE_ENABLED='1';
 const newer={...row,closed_at:at(29).toISOString()};
 // Even a caller injecting a candidate cannot bypass the current state guard.
 const result=await runJdRetentionSweep(env,{dryRun:false,deps:{candidates:[newer]}});
 assert.equal(result.purged,0);
 assert.equal(env.deletionCount,0);
});
test('daily maintenance is off by default, preview no automatic R2 deletion',async()=>{
 const env=makeEnv();
 const disabled=await runJdLifecycleMaintenance(env);
 assert.equal(disabled.enabled,false);
 env.HHBA_JD_MAINTENANCE_ENABLED='1';
 const result=await runJdLifecycleMaintenance(env);
 assert.equal(result.enabled,true);
 assert.equal(result.checked,0);
 assert.equal(result.retention.dry_run,true);
});
test('Word and candidate histories remain separate from the shared D1/R2 cleanup',()=>{
 const module=readFileSync(new URL('../functions/_lib/jd-lifecycle-maintenance.js',import.meta.url),'utf8');
 const cron=readFileSync(new URL('../ops/jd-lifecycle-cron-worker.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(module,/HHBA_PRIVATE_RESUMES|\.delete\(.*resume|candidate_resume_body/);
 assert.match(module,/json_each\(h.jobs_json\)/);
 assert.match(module,/HHBA_JD_RETENTION_DELETE_ENABLED/);
 assert.match(cron,/scheduled\(event,env\)/);
 assert.match(cron,/HHBA_JD_MAINTENANCE_ENABLED/);
});
