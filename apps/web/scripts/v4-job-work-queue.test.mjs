import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {candidateRevision} from '../functions/_lib/v4-research-pipeline.js';
import {desiredV4JobWork,reconcileV4JobWork,claimV4JobWork,renewV4JobWork,finishV4JobWork,v4JobRetryDelayMs,clearV4JobWork} from '../functions/_lib/v4-job-work-queue.js';
const sql=readFileSync(new URL('../d1/20261126_v4_job_work_queue.sql',import.meta.url),'utf8');
const taskKey='a'.repeat(64);
const url='https://careers.employer.cn/jobs/123';
const source=()=>({company:'测试企业',title:'区域运营',location:'北京',employer_proof_url:url,requirements:'真实岗位'});
const scored=()=>({official_url:url,company:'测试企业',title:'区域运营',location:'北京',
 source_type:'站外官方招聘',curated_suitable:true,match_score:86,
 jd_source_status:'VERIFIED_JD',evidence_status:'VERIFIED_FULL_JD',score_evidence_status:'GROUNDED_JD_RESUME_QUOTES',evidence_excerpt:'真实岗位要求'});
function fixture(){
 const local=new DatabaseSync(':memory:');local.exec(sql);
 const db={prepare(q){return {bind(...args){return {
  async all(){return {results:local.prepare(q).all(...args)}},
  async run(){const r=local.prepare(q).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}
 }}}},
 async batch(statements){return Promise.all(statements.map(s=>s.run()))}};
 return {local,db};
}
test('encrypted-checkpoint-derived work contains no plaintext employer or job URLs',async()=>{
 const checkpoint={phase:'reporting',globalRankState:{done:true},globalOrder:[url],rows:[[url,source()]],processedEarlier:[],processedEvidence:[],matches:[scored()]};
 const tasks=await desiredV4JobWork(taskKey,0,checkpoint);
 assert.equal(tasks.length,2);
 assert.deepEqual(tasks.map(x=>x.lane),['verification','reporting']);
 for(const row of tasks){assert.match(row.job_key,/^[a-f0-9]{64}$/);assert.match(row.revision,/^[a-f0-9]{64}$/);}
 assert.ok(!JSON.stringify(tasks).includes(url));
 assert.ok(!JSON.stringify(tasks).includes('测试企业'));
});
test('D1 job claims are atomic, generation fenced and expire for safe automatic pickup',async()=>{
 const {db,local}=fixture(),checkpoint={phase:'reporting',globalRankState:{done:true},globalOrder:[url],rows:[[url,source()]],processedEarlier:[],processedEvidence:[],matches:[scored()]};
 assert.deepEqual(await reconcileV4JobWork(db,taskKey,0,checkpoint,{now:1000}),{available:true,work:2,createdOrUpdated:2,invalidated:0,remaining:0});
 const claim=await claimV4JobWork(db,taskKey,0,'verification',{now:1100,owner:'owner-A',leaseMs:15000});
 assert.ok(claim);assert.equal(claim.attempts,1);
 assert.equal(await claimV4JobWork(db,taskKey,0,'verification',{now:1200,owner:'owner-B'}),null);
 assert.equal(await renewV4JobWork(db,{...claim,owner:'other'},{now:1300}),false);
 assert.equal(await finishV4JobWork(db,{...claim,owner:'other'},{now:1300}),false);
 assert.equal(await renewV4JobWork(db,claim,{now:1400,leaseMs:15000}),true);
 assert.equal(await claimV4JobWork(db,taskKey,1,'verification',{now:1600}),null);
 assert.equal(await claimV4JobWork(db,taskKey,0,'verification',{now:16399,owner:'owner-C'}),null);
 const recovered=await claimV4JobWork(db,taskKey,0,'verification',{now:16401,owner:'owner-C'});
 assert.ok(recovered);assert.equal(recovered.attempts,2);
 assert.equal(await finishV4JobWork(db,claim,{now:16403}),false);
 assert.equal(await finishV4JobWork(db,recovered,{now:16404}),true);
 assert.equal(await claimV4JobWork(db,taskKey,0,'verification',{now:16500}),null);
 assert.equal(local.prepare("SELECT state FROM hhba_v4_job_work_queue WHERE lane='verification'").get().state,'COMPLETED');
});
test('Cloudflare resource safety: atomic job lease admission waits instead of overloading second research round',async()=>{
 const {db,local}=fixture();
 const urls=Array.from({length:5},(_,i)=>url+'/admission-'+i);
 const cp={phase:'research',rows:urls.map(u=>[u,{...source(),employer_proof_url:u}]),processedEarlier:[],processedEvidence:[],matches:[]};
 await reconcileV4JobWork(db,taskKey,0,cp,{now:1000});
 const one=await claimV4JobWork(db,taskKey,0,'verification',{now:1100,owner:'worker-1'});
 const two=await claimV4JobWork(db,taskKey,0,'verification',{now:1101,owner:'worker-2'});
 assert.ok(one&&two);
 assert.equal(await claimV4JobWork(db,taskKey,0,'verification',{now:1102,owner:'worker-3'}),null,
  'extra job request is cheap and deferred while two unrelated jobs run');
 assert.equal(local.prepare("SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue WHERE state='LEASED'").get().n,2);
 assert.equal(local.prepare("SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue WHERE state='PENDING'").get().n,3,
  'no research records are discarded because of temporary Cloudflare pressure');
 assert.equal(await finishV4JobWork(db,one,{now:1150,completed:true}),true);
 const three=await claimV4JobWork(db,taskKey,0,'verification',{now:1151,owner:'worker-3'});
 assert.ok(three,'a released slot admits the next waiting job without a new search');
 assert.equal(local.prepare("SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue WHERE state='LEASED'").get().n,2);
 // Expired leases no longer count against active concurrency.
 const afterExpiry=await claimV4JobWork(db,taskKey,0,'verification',{now:310000,owner:'worker-after-expiry'});
 assert.ok(afterExpiry,'expired jobs are eligible for safe recovery without an artificial task cap');
});

test('later source revisions invalidate an old lease without falsely carrying over a score',async()=>{
 const {db,local}=fixture(),original={phase:'verification',rows:[[url,source()]],processedEarlier:[],processedEvidence:[],matches:[]};
 await reconcileV4JobWork(db,taskKey,0,original,{now:1000});
 const leased=await claimV4JobWork(db,taskKey,0,'verification',{now:1001,owner:'old'});
 const changed={...original,rows:[[url,{...source(),requirements:'新的真实要求'}]]};
 const updated=await reconcileV4JobWork(db,taskKey,0,changed,{now:1002});
 assert.equal(updated.createdOrUpdated,1);
 assert.equal(await finishV4JobWork(db,leased,{now:1003}),false);
 const fresh=await claimV4JobWork(db,taskKey,0,'verification',{now:1004,owner:'new'});
 assert.ok(fresh);assert.notEqual(fresh.revision,leased.revision);
 assert.equal(fresh.attempts,1,'a revised JD invalidates the old failure history');
 await finishV4JobWork(db,fresh,{now:1005});
 const recheck={...changed,processedEarlier:[url],processedEvidence:[[url,candidateRevision(changed.rows[0][1])]]};
 await reconcileV4JobWork(db,taskKey,0,recheck,{now:1006});
 assert.equal(local.prepare("SELECT state FROM hhba_v4_job_work_queue WHERE lane='verification'").get().state,'COMPLETED');
 assert.equal(await clearV4JobWork(db,taskKey,0),true);
 assert.equal(local.prepare('SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue').get().n,0);
});
test('queue synchronization is revision-aware, incremental and does not re-run unchanged jobs',async()=>{
 const {db,local}=fixture(),cp={phase:'reporting',globalRankState:{done:true},globalOrder:[url],rows:[[url,source()]],processedEarlier:[],processedEvidence:[],matches:[scored()]};
 const first=await reconcileV4JobWork(db,taskKey,4,cp,{now:2000,maxChanges:1});
 assert.equal(first.remaining,1);
 const second=await reconcileV4JobWork(db,taskKey,4,cp,{now:2001,maxChanges:1});
 assert.equal(second.remaining,0);
 const unchanged=await reconcileV4JobWork(db,taskKey,4,cp,{now:2002});
 assert.equal(unchanged.createdOrUpdated,0);
 assert.equal(local.prepare('SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue').get().n,2);
});
test('queue remains disabled unless Cloudflare explicitly enables the migration-backed feature',async()=>{
 const {v4JobWorkQueueEnabled}=await import('../functions/_lib/v4-job-work-queue.js');
 assert.equal(v4JobWorkQueueEnabled({}),false);
 assert.equal(v4JobWorkQueueEnabled({HHBA_V4_JOB_QUEUE_ENABLED:'1',HHBA_PNVS_AUTH_DB:{prepare(){}}}),true);
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/await saveMatchTask\(env,input\.taskKey,\{checkpoint:result\.checkpoint/);
 assert.match(route,/if\(input\.background&&v4JobWorkQueueEnabled\(env\)\)/);
 assert.match(route,/await enqueueEarlyVerification\(result\.checkpoint,\{force:true\}\)/);
 assert.match(route,/await enqueueEarlyVerification\(state\.checkpoint\)/);
 assert.match(route,/await reconcileV4JobWork\(env\.HHBA_PNVS_AUTH_DB,input\.taskKey,input\.generation\|\|0,checkpoint\)/);
 assert.match(route,/const lane=checkpoint\.phase==='reporting'\?'reporting':'verification'/);
 assert.match(route,/stageWorkflowSignal\(env,input\.backgroundTicket,\{lane\}\)/);
});

test('report queue cannot launch 500 long reports before global AI ranking confirms the top fifty',async()=>{
 const {db}=fixture(),cp={phase:'verification',rows:[[url,source()]],processedEarlier:[],matches:[scored()]};
 const preliminary=await desiredV4JobWork(taskKey,0,cp);
 assert.deepEqual(preliminary.map(x=>x.lane),['verification']);
 const selected=await desiredV4JobWork(taskKey,0,{...cp,phase:'reporting',globalRankState:{done:true},globalOrder:[url]});
 assert.deepEqual(selected.map(x=>x.lane),['verification','reporting']);
 await reconcileV4JobWork(db,taskKey,0,cp);
 assert.equal(await claimV4JobWork(db,taskKey,0,'reporting'),null);
});

test('each batch eventually admits all 500 verified research candidates without losing earlier queue rows',async()=>{
 const {db,local}=fixture();
 const urls=Array.from({length:500},(_,i)=>url+'/complete-queue-'+String(i+1).padStart(4,'0'));
 const cp={phase:'verification',rows:urls.map(u=>[u,{...source(),employer_proof_url:u}]),processedEarlier:[],processedEvidence:[],matches:[]};
 let last=501,cycles=0;
 for(;cycles<20;cycles++){
  const state=await reconcileV4JobWork(db,taskKey,0,cp,{now:1000+cycles,maxChanges:40});
  assert.equal(state.work,500);
  assert.ok(state.remaining<last,'every idle pass drains another 40-item page');
  assert.ok(state.createdOrUpdated<=40);
  last=state.remaining;
  if(state.remaining===0)break;
 }
 assert.equal(cycles,12,'500 candidates take 13 bounded D1 batches of 40');
 assert.equal(local.prepare('SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue').get().n,500);
 assert.equal(local.prepare("SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue WHERE state='PENDING'").get().n,500);
 const unchanged=await reconcileV4JobWork(db,taskKey,0,cp,{now:2000});
 assert.equal(unchanged.createdOrUpdated,0,'fully reconciled jobs never repeat their insert');
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const entry=route.indexOf('const merged=await mergeIndependentV4Jobs(');
 const sync=route.indexOf('const queue=await reconcileV4JobWork(',entry);
 const pending=route.indexOf('researchEnv.__v4IndependentPending=await pendingIndependentV4Work(');
 assert.ok(entry>0&&sync>entry&&pending>sync,'queue is incrementally reconciled before any phase decides that independent work is done');
});
test('failed verification jobs cool down durably instead of permanently disappearing at three errors',async()=>{
 const {db,local}=fixture(),cp={phase:'verification',rows:[[url,source()]],processedEarlier:[],processedEvidence:[],matches:[]};
 await reconcileV4JobWork(db,taskKey,0,cp,{now:1000});
 for(let i=0;i<5;i++){
  const now=1000+i*100;
  const claim=await claimV4JobWork(db,taskKey,0,'verification',{now,owner:'continuation-'+i});
  assert.ok(claim,'productive model research remains schedulable');
  assert.equal(await finishV4JobWork(db,claim,{now:now+1,completed:false,continued:true}),true);
 }
 assert.equal(local.prepare("SELECT attempts FROM hhba_v4_job_work_queue WHERE lane='verification'").get().attempts,0);
 let eligibleAt=2000;
 for(let i=1;i<=4;i++){
  const claim=await claimV4JobWork(db,taskKey,0,'verification',{now:eligibleAt,owner:'failed-'+i});
  assert.ok(claim,'failed jobs remain recoverable after repeated independent errors');
  assert.equal(claim.attempts,i);
  const failedAt=eligibleAt+1;
  assert.equal(await finishV4JobWork(db,claim,{now:failedAt,completed:false}),true);
  const delay=v4JobRetryDelayMs(i);
  assert.equal(local.prepare("SELECT lease_until_ms FROM hhba_v4_job_work_queue WHERE lane='verification'").get().lease_until_ms,failedAt+delay);
  assert.equal(await claimV4JobWork(db,taskKey,0,'verification',{now:failedAt+delay-1}),null,'backoff blocks hot-looping and paid duplicate requests');
  eligibleAt=failedAt+delay;
 }
 assert.equal(v4JobRetryDelayMs(99),300000,'transient repeated failures recover within five minutes');
 assert.equal(v4JobRetryDelayMs(99,'AI_PROVIDER_RATE_LIMITED'),600000);
 assert.equal(v4JobRetryDelayMs(99,'AI_EDGE_DAILY_LIMIT'),3600000);
 assert.equal(local.prepare("SELECT state FROM hhba_v4_job_work_queue WHERE lane='verification'").get().state,'PENDING');
});


test('bounded reconciliation can enqueue 500 jobs then the ranked top 50 without full-pool rehashing on each pass',async()=>{
 const {db,local}=fixture();
 const urls=Array.from({length:500},(_,i)=>url+'/large-'+String(i+1).padStart(4,'0'));
 const rows=urls.map(u=>[u,{...source(),employer_proof_url:u}]);
 const ranked=urls.slice(440,490);
 const cp={phase:'reporting',rows,processedEarlier:[],processedEvidence:[],
  globalRankState:{done:true},globalOrder:ranked,
  matches:ranked.map(u=>({...scored(),official_url:u,research_candidate_url:u}))};
 let remaining=Infinity;
 for(let i=0;i<20;i++){
  const next=await reconcileV4JobWork(db,taskKey,0,cp,{now:1000+i,maxChanges:40});
  assert.ok(next.createdOrUpdated<=40,'CPU-heavy revision hashing and writes must stay page-bounded');
  assert.ok(next.remaining<=remaining);
  remaining=next.remaining;
  if(!remaining)break;
 }
 assert.equal(remaining,0,'all 500 verified candidates and 50 ranked reports become schedulable');
 assert.equal(local.prepare("SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue WHERE lane='verification'").get().n,500);
 assert.equal(local.prepare("SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue WHERE lane='reporting'").get().n,50);
});
test('completed large queue revisits older rows and invalidates changed source revision without duplicate work',async()=>{
 const {db,local}=fixture();
 const urls=Array.from({length:500},(_,i)=>url+'/rev-'+String(i+1).padStart(4,'0'));
 const cp={phase:'verification',rows:urls.map(u=>[u,{...source(),employer_proof_url:u}]),processedEarlier:[],processedEvidence:[],matches:[]};
 for(let i=0;i<13;i++)await reconcileV4JobWork(db,taskKey,0,cp,{now:1000+i,maxChanges:40});
 const before=local.prepare("SELECT revision FROM hhba_v4_job_work_queue WHERE lane='verification' ORDER BY created_at_ms DESC,job_key LIMIT 1").get()?.revision;
 const changed={...cp,rows:cp.rows.map(([u,j],i)=>i===480?[u,{...j,requirements:'新版真实招聘条件'}]:[u,j])};
 const check=await reconcileV4JobWork(db,taskKey,0,changed,{now:12*30000,maxChanges:40});
 assert.equal(check.createdOrUpdated,1,'a rotating page eventually sees revised evidence');
 assert.equal(check.remaining,0);
 assert.equal(local.prepare("SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue WHERE lane='verification'").get().n,500);
 assert.ok(before);
});


test('expired JD job resumes its saved revision before 500 fresh jobs; active lease remains fenced',async()=>{
 const {db,local}=fixture();
 const urls=Array.from({length:120},(_,i)=>url+'/resume-'+String(i+1).padStart(4,'0'));
 const cp={phase:'research',rows:urls.map(u=>[u,{...source(),employer_proof_url:u}]),processedEarlier:[],processedEvidence:[],matches:[]};
 for(let i=0;i<3;i++)await reconcileV4JobWork(db,taskKey,0,cp,{now:1000+i,maxChanges:40});
 const stalled=await claimV4JobWork(db,taskKey,0,'verification',{now:1100,leaseMs:15000,owner:'old-worker'});
 const active=await claimV4JobWork(db,taskKey,0,'verification',{now:1101,leaseMs:120000,owner:'live-worker'});
 assert.ok(stalled&&active&&stalled.job_key!==active.job_key);
 assert.equal(await claimV4JobWork(db,taskKey,0,'verification',{now:1300,owner:'not-allowed'}),null,
  'two active claims fence all duplicate model calls');
 const resumed=await claimV4JobWork(db,taskKey,0,'verification',{now:16101,owner:'new-worker',leaseMs:15000});
 assert.ok(resumed);
 assert.equal(resumed.job_key,stalled.job_key,'overdue JD resumes before 118 never-before-seen candidates');
 assert.equal(resumed.revision,stalled.revision,'research results use the same source revision and saved sidecar');
 assert.equal(resumed.attempts,2);
 assert.notEqual(resumed.job_key,active.job_key,'in-flight sibling must never be stolen');
 assert.equal(await finishV4JobWork(db,stalled,{now:16102}),false,'old owner cannot commit a stale result');
 assert.equal(await finishV4JobWork(db,resumed,{now:16103,completed:true}),true);
 assert.equal(local.prepare("SELECT COUNT(*) AS n FROM hhba_v4_job_work_queue WHERE state='PENDING'").get().n,118);
});
