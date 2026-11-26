import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {getSessionTask,updateSessionTask,assertSessionTaskActive,researchTaskKey} from '../functions/_lib/v4-session-match-task.js';
import {saveMatchTask,readMatchTask} from '../functions/_lib/v4-match-checkpoint-storage.js';

function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE hhba_ai_checkpoint_claims(token_hash TEXT PRIMARY KEY,expires_at TEXT); CREATE TABLE hhba_auth_sessions(token_hash TEXT PRIMARY KEY,phone TEXT,expires_at TEXT,revoked INTEGER);');
 const db={prepare(query){return {bind(...args){return {async run(){const r=sql.prepare(query).run(...args);return {success:true,meta:{changes:Number(r.changes)}};},async first(){return sql.prepare(query).get(...args)||null;}};}};}};
 const objects=new Map(),bucket={async put(k,v){objects.set(k,v.slice())},async get(k){const v=objects.get(k);return v?{arrayBuffer:async()=>v.buffer}:null}};
 const env={HHBA_PNVS_AUTH_DB:db,HHBA_V4_MATCH_CHECKPOINT_STORAGE:'1',HHBA_MATCH_V4_CHECKPOINT_SECRET:'synthetic-only-secret-do-not-use-in-production',HHBA_PRIVATE_RESUMES:bucket};
 const session=(phone,token_hash)=>{const s={phone,token_hash,expires_at:new Date(Date.now()+3600000).toISOString(),revoked:0};sql.prepare('INSERT INTO hhba_auth_sessions VALUES(?,?,?,?)').run(token_hash,phone,s.expires_at,0);return s};
 const input=()=>({id:crypto.randomUUID(),text:'synthetic private resume text to test encryption',role:'运营',excludeUrls:[],resume_id:null});
 return {env,objects,sql,session,input};
}
test('same-session start is idempotent, tabs share exact input, different sessions cannot read it',async()=>{
 const {env,objects,session,input}=fixture(),a=session('13800000000','a'),b=session('13800000000','b'),c=session('13900000000','c'),original=input();
 const task=await updateSessionTask(env,a,'start',original);
 assert.equal(task.id,original.id);
 assert.deepEqual(await updateSessionTask(env,a,'start',{...input(),text:'different CV'}),task);
 assert.deepEqual(await getSessionTask(env,a),task);
 assert.equal(await getSessionTask(env,b),null);assert.equal(await getSessionTask(env,c),null);
 for(const raw of objects.values())assert.ok(!new TextDecoder().decode(raw).includes(original.text));
 assert.deepEqual(await assertSessionTaskActive(env,a,task.id,0),task);
 await assert.rejects(assertSessionTaskActive(env,b,task.id,0),{code:'AI_AGENT_CANCELLED'});
});
test('refresh reuses exact checkpoint; only explicit continue advances generation',async()=>{
 const {env,session,input}=fixture(),a=session('13800000000','a'),task=await updateSessionTask(env,a,'start',input()),key=await researchTaskKey(env,a,task);
 await saveMatchTask(env,key,{checkpoint:{phase:'research'},generation:0});
 const restored=await getSessionTask(env,a);
 assert.equal(await researchTaskKey(env,a,restored),key);
 assert.deepEqual(await readMatchTask(env,key),{checkpoint:{phase:'research'},generation:0});
 await assert.rejects(updateSessionTask(env,a,'continue',task),{code:'AI_CHECKPOINT_INVALID'});
 await saveMatchTask(env,key,{checkpoint:{phase:'research'},generation:0,result:{status:'COMPLETE',can_continue:true}});
 const next=await updateSessionTask(env,a,'continue',task);assert.equal(next.generation,1);
 assert.equal(await researchTaskKey(env,a,next),key);
 await updateSessionTask(env,a,'close',task);assert.equal((await getSessionTask(env,a)).generation,1);
 await updateSessionTask(env,a,'cancel',task);assert.equal(await getSessionTask(env,a),null);
});
test('explicit cancellation fences a delayed start and cannot close a different task',async()=>{
 const {env,session,input}=fixture(),a=session('13800000000','a'),pending=input();
 await updateSessionTask(env,a,'cancel',{id:pending.id,generation:0});
 await assert.rejects(updateSessionTask(env,a,'start',pending),{code:'AI_AGENT_CANCELLED'});
 const task=await updateSessionTask(env,a,'start',input());
 await updateSessionTask(env,a,'cancel',{id:pending.id,generation:0});
 assert.equal((await getSessionTask(env,a)).id,task.id);
 await updateSessionTask(env,a,'cancel',task);
 await assert.rejects(assertSessionTaskActive(env,a,task.id,0),{code:'AI_AGENT_CANCELLED'});
});
test('server detects revoked sessions without a browser cancel request',async()=>{
 const {env,session,input,sql}=fixture(),a=session('13800000000','a'),task=await updateSessionTask(env,a,'start',input());
 sql.prepare('UPDATE hhba_auth_sessions SET revoked=1 WHERE token_hash=?').run(a.token_hash);
 await assert.rejects(assertSessionTaskActive(env,a,task.id,0),{code:'AI_AGENT_CANCELLED'});
});
test('client uses opaque cross-tab signals, scoped session storage and explicit close; Pages transport is not a cancellation signal',()=>{
 const client=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 const page=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(client,/localStorage.setItem\(MATCH_TASK_SIGNAL,crypto.randomUUID\(\)\)/);
 assert.match(page,/void restoreTask\(found\)/);
 assert.match(page,/window.addEventListener\('online',online\)/);
 assert.match(page,/await closeSessionMatchTask\(task,working\|\|!!pendingStart.current\)/);
 assert.match(route,/input.managed\?leaseAbort.signal:input.lease\?AbortSignal.any/);
 assert.match(route,/waitUntil\(execution\)/);
 assert.match(route,/await guard\(\);/);
});

test('phase heartbeat serializes progress writes and drains before terminal checkpoint persistence',async()=>{
 const {startMatchPhaseHeartbeat}=await import('../functions/_lib/v4-match-checkpoint-storage.js');
 let state={phase:'verification',scored:1},renewals=0,release,started;
 const entered=new Promise(r=>{started=r;}),gate=new Promise(r=>{release=r;}),writes=[];
 const hb=startMatchPhaseHeartbeat({renew:async()=>{renewals++;},getCheckpoint:()=>state,persist:async snapshot=>{started();await gate;writes.push(snapshot);},interval:3600000});
 const tick=hb.tick();await entered;state.scored=2;
 const same=hb.tick();let stopped=false;const stop=hb.stop().then(()=>{stopped=true;});
 await Promise.resolve();assert.equal(stopped,false);assert.equal(renewals,1);
 release();await Promise.all([tick,same,stop]);
 assert.deepEqual(writes,[{phase:'verification',scored:1}]);await hb.tick();assert.equal(renewals,1);
});
test('phase heartbeat never saves after losing the exclusive research lease',async()=>{
 const {startMatchPhaseHeartbeat}=await import('../functions/_lib/v4-match-checkpoint-storage.js');
 let writes=0,errors=0;const hb=startMatchPhaseHeartbeat({renew:async()=>{throw Error('lease lost')},getCheckpoint:()=>({phase:'research'}),persist:async()=>{writes++},onError:()=>{errors++},interval:3600000});
 await hb.tick();await hb.tick();await hb.stop();assert.equal(writes,0);assert.equal(errors,1);
});

test('authorized long-running background phases renew only the opaque watchdog instance; revoked sessions do not renew',async()=>{
 const {scheduleBackgroundMatch,loadBackgroundMatch}=await import('../functions/_lib/v4-background-match.js');
 const {env,session,input,sql}=fixture(),s=session('13800000000','a'),task=await updateSessionTask(env,s,'start',input());
 let ticket,instance,renewals=0;
 env.HHBA_MATCH_BACKGROUND={async fetch(url,opt){
  const data=JSON.parse(opt.body);
  if(url.endsWith('/start')){ticket=data.ticket;instance=data.instance;}
  else{assert.ok(url.endsWith('/renew-watchdog'));assert.deepEqual(data,{instance});renewals++;}
  return Response.json({ok:true});
 }};
 await scheduleBackgroundMatch(env,s,task);
 const record=await readMatchTask(env,ticket);await saveMatchTask(env,ticket,{...record,renewed_at:Date.now()-3600001});
 assert.equal((await loadBackgroundMatch(env,ticket)).task.id,task.id);assert.equal(renewals,1);
 await loadBackgroundMatch(env,ticket);assert.equal(renewals,1);
 const refreshed=await readMatchTask(env,ticket);await saveMatchTask(env,ticket,{...refreshed,renewed_at:Date.now()-3600001});
 sql.prepare('UPDATE hhba_auth_sessions SET revoked=1 WHERE token_hash=?').run(s.token_hash);
 await assert.rejects(loadBackgroundMatch(env,ticket),{code:'AI_AGENT_CANCELLED'});assert.equal(renewals,1);
});


test('invocation admission reserves final checkpoint and lease operations without limiting the overall task',async()=>{
 const {phaseResourceBudget,PHASE_YIELD}=await import('../functions/_lib/v4-phase-budget.js');
 let calls=0;const budget=phaseResourceBudget({initial:8,soft:24,hard:34});const fetcher=budget.fetch(async()=>{calls++;return new Response('ok');});
 for(let i=0;i<26;i++)await fetcher('https://example.com');
 assert.equal(calls,26);assert.equal(budget.canStart(),false);assert.throws(()=>fetcher('https://example.com'),{code:PHASE_YIELD});
 assert.equal(budget.denied,true);assert.equal(budget.used,34);budget.observe('checkpoint',3);assert.equal(budget.used,37);
 const next=phaseResourceBudget();await next.fetch(async()=>{calls++;return new Response('ok');})('https://example.com');assert.equal(calls,27);assert.equal(next.denied,false);
});
test('D1 prepared statements, batches and R2 operations share the same budget',async()=>{
 const {phaseResourceBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const budget=phaseResourceBudget({initial:0,soft:8,hard:10});let calls=0;
 const prepared={bind(){return this;},async run(){calls++;return {success:true};}};
 const env=budget.env({HHBA_JOB_JD_DB:{prepare(){return prepared;},async batch(list){assert.ok(list.every(s=>s===prepared));calls+=list.length;return [];}},HHBA_PRIVATE_RESUMES:{async get(){calls++;return null;}}});
 await env.HHBA_JOB_JD_DB.prepare('SELECT 1').bind().run();await env.HHBA_JOB_JD_DB.batch([env.HHBA_JOB_JD_DB.prepare('SELECT 1'),env.HHBA_JOB_JD_DB.prepare('SELECT 2')]);await env.HHBA_PRIVATE_RESUMES.get('key');
 assert.equal(calls,4);assert.deepEqual(budget.snapshot().counts,{d1:3,r2:1});
});
test('completed calls are replayed once only across a resource interruption, without reasoning output',async()=>{
 const {phaseModelReplay}=await import('../functions/_lib/v4-phase-budget.js');const first=phaseModelReplay();
 first.remember('hash',{status:'completed',output:[{type:'reasoning',summary:['private']},{type:'message',content:[{type:'output_text',text:'completed evidence'}]}]});
 assert.equal(first.take('hash'),null);const resumed=phaseModelReplay(first.snapshot());assert.equal(resumed.take('hash').output.length,1);assert.equal(resumed.take('hash'),null);assert.equal(resumed.take('different'),null);
});
test('compact progress is separately encrypted and cannot replace the authoritative checkpoint',async()=>{
 const {saveMatchProgress,readMatchProgress}=await import('../functions/_lib/v4-match-checkpoint-storage.js');const {env,objects}=fixture();const key='a'.repeat(64);
 await saveMatchTask(env,key,{generation:0,checkpoint:{evidence:'large private evidence'}});await saveMatchProgress(env,key,{generation:0,status:'PENDING',progress:{stage:'searching'}});
 assert.deepEqual((await readMatchTask(env,key)).checkpoint,{evidence:'large private evidence'});assert.equal((await readMatchProgress(env,key)).progress.stage,'searching');assert.equal(await readMatchProgress(env,'b'.repeat(64)),null);
 assert.equal(objects.size,2);for(const bytes of objects.values())assert.ok(!new TextDecoder().decode(bytes).includes('private evidence'));
});

test('background recovery preserves the original task, generation and private checkpoint',async()=>{
 const {scheduleBackgroundMatch,loadBackgroundMatch,isV4RetryableTaskFailure}=await import('../functions/_lib/v4-background-match.js');
 const {env,session,input}=fixture(),s=session('13800000000','a'),task=await updateSessionTask(env,s,'start',input());
 const key=await researchTaskKey(env,s,task);await saveMatchTask(env,key,{generation:0,checkpoint:{phase:'research',round:3}});
 let first=null,calls=0;env.HHBA_MATCH_BACKGROUND={async fetch(url,opt){
  assert.ok(url.endsWith('/start'));const body=JSON.parse(opt.body);if(first)assert.deepEqual(body,first);else first=body;calls++;
  return Response.json({ok:true,recovering:true,error:'AI_BACKGROUND_RECOVERING'});
 }};
 assert.deepEqual(await scheduleBackgroundMatch(env,s,task,{diagnostic:true}),{status:'RECOVERING',error:'AI_BACKGROUND_RECOVERING'});
 assert.equal(await scheduleBackgroundMatch(env,s,task),true);assert.equal(calls,2);
 const loaded=await loadBackgroundMatch(env,first.ticket);assert.equal(loaded.task.id,task.id);assert.equal(loaded.task.generation,0);assert.equal(loaded.taskKey,key);
 assert.deepEqual((await readMatchTask(env,key)).checkpoint,{phase:'research',round:3});
 await updateSessionTask(env,s,'cancel',task);await assert.rejects(loadBackgroundMatch(env,first.ticket),{code:'AI_AGENT_CANCELLED'});
 for(const code of ['AI_CHECKPOINT_DB_UNAVAILABLE','AI_CHECKPOINT_LEASE_LOST','AI_EDGE_DAILY_LIMIT'])assert.equal(isV4RetryableTaskFailure(code),true);
 for(const code of ['AI_AGENT_CANCELLED','AI_CHECKPOINT_INVALID','AI_CHECKPOINT_EXPIRED','AI_PROVIDER_KEY_REJECTED'])assert.equal(isV4RetryableTaskFailure(code),false);
});
test('recovery diagnostics cannot be mistaken for terminal failures in the route or poller',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const client=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 assert.match(route,/scheduled\?\.status==='RECOVERING'/);
 assert.match(route,/error:scheduled\.error,retryable:true/);
 assert.match(route,/isV4RetryableTaskFailure\(code\)/);
 assert.match(route,/if\(committedResult\)/);
 assert.match(client,/data\.failure\?\.retryable\?15000:addedCandidates>0\?2000:3000/);
});

test('profile reuse key isolates session, account, exact resume revision, intent and model; expires without renewal',async()=>{
 const {matchProfileCacheKey,readMatchProfileCache,saveMatchProfileCache}=await import('../functions/_lib/v4-match-checkpoint-storage.js');
 const {env,objects}=fixture(),input={resume_id:'r1',text:'private resume A',role:'运营',model:'test',base:'https://provider.invalid',effort:'medium'};
 const id=await matchProfileCacheKey(env,'13800000000','session-a',input);
 for(const [account,session,revision] of [['13900000000','session-a',input],['13800000000','session-b',input],['13800000000','session-a',{...input,text:'new revision'}],['13800000000','session-a',{...input,role:'销售'}],['13800000000','session-a',{...input,model:'different'}]]){
  assert.notEqual(id,await matchProfileCacheKey(env,account,session,revision));
 }
 assert.equal(await matchProfileCacheKey(env,'13800000000','session-a',{...input,resume_id:null}),null);
 const p={summary:'private derived profile',target_roles:['运营']};
 await saveMatchProfileCache(env,id,p,1000);
 assert.deepEqual(await readMatchProfileCache(env,id,2000),p);
 assert.equal(await readMatchProfileCache(env,id,3601001),null);
 for(const raw of objects.values()){const text=new TextDecoder().decode(raw);assert.ok(!text.includes(input.text));assert.ok(!text.includes(p.summary));}
});

test('optional gzip encrypts large checkpoint records, preserves exact data, and reads legacy JSON',async()=>{
 const {env,objects}=fixture(),id='c'.repeat(64);
 const value={generation:0,checkpoint:{phase:'research',evidence:Array.from({length:500},(_,i)=>({url:'https://employer.cn/job/'+i,text:'公开岗位职责、任职条件和完整原文。'.repeat(25)}))}};
 await saveMatchTask(env,id,value,1000);const original=[...objects.values()][0].byteLength;
 const gzipEnv={...env,HHBA_V4_CHECKPOINT_GZIP:'1'};
 assert.deepEqual(await readMatchTask(gzipEnv,id,2000),value);
 await saveMatchTask(gzipEnv,id,value,1000);const packed=[...objects.values()][0];
 assert.ok(packed.byteLength<original/4);
 assert.deepEqual(await readMatchTask(env,id,2000),value);
 assert.ok(!new TextDecoder().decode(packed).includes('公开岗位职责'));
 const bad=packed.slice();bad[bad.length-1]^=1;objects.set([...objects.keys()][0],bad);
 await assert.rejects(readMatchTask(gzipEnv,id,2000));
});


// Deterministic fake clock: no wall-clock waits or actual Cloudflare requests.
function progressClock(){
 let t=100000,id=0;const timers=new Map();
 return {now:()=>t,schedule:(fn,delay)=>{const key=++id;timers.set(key,{fn,at:t+delay});return key;},
  cancel:key=>timers.delete(key),
  async advance(ms){
   const end=t+ms;
   for(;;){
    const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];
    if(!next||next[1].at>end)break;
    t=next[1].at;timers.delete(next[0]);next[1].fn();
    for(let i=0;i<12;i++)await Promise.resolve();
   }
   t=end;for(let i=0;i<12;i++)await Promise.resolve();
  }};
}

test('background progress prioritizes actual new candidates and complete reports over routine activity',async()=>{
 const {createV4ProgressPublisher}=await import('../functions/_lib/v4-progress-publisher.js');
 const clock=progressClock(),writes=[];let jobs=0;
 const publisher=createV4ProgressPublisher({...clock,publish:kind=>{writes.push({kind,jobs,time:clock.now()});}});
 publisher.queue();await clock.advance(100);
 jobs=1;publisher.queue('candidate');await clock.advance(0);
 assert.deepEqual(writes.map(w=>[w.kind,w.jobs]),[['candidate',1]]);
 jobs=2;publisher.queue('candidate');jobs=3;publisher.queue('candidate');publisher.queue();
 await clock.advance(2999);assert.equal(writes.length,1);
 await clock.advance(1);assert.deepEqual(writes.map(w=>[w.kind,w.jobs]),[['candidate',1],['candidate',3]]);
 jobs=4;publisher.queue('candidate');publisher.queue('report');await clock.advance(999);assert.equal(writes.length,2);
 await clock.advance(1);assert.deepEqual(writes.map(w=>[w.kind,w.jobs]),[['candidate',1],['candidate',3],['report',4]]);
 publisher.queue();await clock.advance(19999);assert.equal(writes.length,3);
 await clock.advance(1);assert.equal(writes[3].kind,'routine');
 await publisher.stop();
});

test('background progress serializes in-flight writes, rechecks resource headroom and drains before terminal save',async()=>{
 const {createV4ProgressPublisher}=await import('../functions/_lib/v4-progress-publisher.js');
 const clock=progressClock(),writes=[];let allowed=true,jobs=1,finishFirst;
 const publisher=createV4ProgressPublisher({...clock,canPublish:()=>allowed,publish:kind=>{
  writes.push({kind,jobs});
  if(writes.length===1)return new Promise(resolve=>{finishFirst=resolve;});
 }});
 publisher.queue('candidate');await clock.advance(0);assert.equal(writes.length,1);
 jobs=2;publisher.queue('candidate');jobs=3;publisher.queue('report');
 await clock.advance(10000);assert.equal(writes.length,1,'no overlapping writes');
 finishFirst();await clock.advance(0);
 await clock.advance(999);assert.equal(writes.length,1);
 await clock.advance(1);assert.deepEqual(writes,[{kind:'candidate',jobs:1},{kind:'report',jobs:3}]);
 jobs=4;publisher.queue('candidate');allowed=false;await clock.advance(3000);
 assert.equal(writes.length,2,'resource reserve must be checked at actual write time');
 allowed=true;publisher.queue('candidate');await clock.advance(0);
 assert.deepEqual(writes[2],{kind:'candidate',jobs:4});
 publisher.queue('report');await publisher.stop();await clock.advance(20000);
 assert.equal(writes.length,3,'stopped optional progress cannot overwrite terminal state');
});

test('progress publisher retains a later dirty snapshot after optional write failure',async()=>{
 const {createV4ProgressPublisher}=await import('../functions/_lib/v4-progress-publisher.js');
 const clock=progressClock(),writes=[];let jobs=1;
 const publisher=createV4ProgressPublisher({...clock,publish:kind=>{
  writes.push({kind,jobs});
  if(writes.length===1)throw Error('temporary R2 failure');
 }});
 publisher.queue('candidate');await clock.advance(0);
 jobs=2;publisher.queue('candidate');await clock.advance(3000);
 assert.deepEqual(writes,[{kind:'candidate',jobs:1},{kind:'candidate',jobs:2}]);
 await publisher.stop();
});


test('encrypted progress restores new discovery leads after a hard interruption without modifying authoritative evidence',async()=>{
 const {saveMatchProgress,readMatchProgress}=await import('../functions/_lib/v4-match-checkpoint-storage.js');
 const {discoveryRecoverySnapshot,restoreDiscoveryRecovery}=await import('../functions/_lib/v4-discovery-recovery.js');
 const {env,objects}=fixture(),id='d'.repeat(64);
 const job=n=>({url:'https://careers.employer.cn/jobs/'+n,company:'测试企业',title:'运营'+n,location:'上海'});
 const a=job(1),b=job(2),c=job(3);
 const existing={...a,requirements:'authoritative evidence'};
 const base={phase:'research',round:2,rows:[[a.url,existing]],sourceLeads:[a.url],
  toolUrls:[a.url],processedEarlier:[a.url],processedEvidence:[[a.url,'original revision']],
  priorState:{matches:[{official_url:a.url,match_score:88,research_detail:{score_explanation:'complete report'}}]}};
 const current={...base,round:3,rows:[[a.url,{...a,requirements:'untrusted update'}],[b.url,{...b,score:98,fit_summary:'unverified score'}],[c.url,c]],
  rejectedBoards:[c.url]};
 const saved={generation:4,checkpoint:base,phaseReplay:[['existing',{status:'completed'}]]};
 await saveMatchTask(env,id,saved);
 const supplement=discoveryRecoverySnapshot(base,current);
 assert.equal(supplement.round,3);assert.deepEqual(supplement.rows.map(([u])=>u),[b.url]);
 assert.equal(supplement.rows[0][1].preliminary_score,undefined);
 await saveMatchProgress(env,id,{generation:4,status:'PENDING',progress:{stage:'searching',jobs:[a,b]},discovery_recovery:supplement});
 const view=await readMatchProgress(env,id);
 const recovered=restoreDiscoveryRecovery(await readMatchTask(env,id),view,4);
 assert.equal(recovered.restored,1);
 const next=recovered.saved.checkpoint;
 assert.equal(next.round,2,'unfinished round is not marked complete');
 assert.deepEqual(next.rows.map(([u])=>u),[a.url,b.url]);
 assert.deepEqual(next.rows[0][1],existing);
 assert.deepEqual(next.toolUrls,base.toolUrls,'stream output is not verified source evidence');
 assert.deepEqual(next.processedEvidence,base.processedEvidence);
 assert.deepEqual(next.priorState,base.priorState);
 assert.deepEqual(recovered.saved.phaseReplay,saved.phaseReplay);
 assert.ok(next.sourceLeads.includes(b.url));
 assert.equal(next.diagnostics.LIVE_DISCOVERY_RECOVERED,1);
 // Persist the recovered base before a subsequent invocation overwrites
 // its supplement; a second interruption must not lose the restored row.
 await saveMatchTask(env,id,recovered.saved);
 await saveMatchProgress(env,id,{generation:4,status:'PENDING',progress:{stage:'searching'}});
 assert.deepEqual((await readMatchTask(env,id)).checkpoint.rows,next.rows);
 for(const raw of objects.values())assert.ok(!new TextDecoder().decode(raw).includes('测试企业'));
});

test('discovery recovery rejects stale generation, terminal phases, excluded jobs and duplicate canonical URLs',async()=>{
 const {restoreDiscoveryRecovery,discoveryRecoverySnapshot}=await import('../functions/_lib/v4-discovery-recovery.js');
 const a={url:'https://careers.employer.cn/jobs/1',company:'企业',title:'运营',location:'上海'};
 const b={...a,url:'https://careers.employer.cn/jobs/2'};
 const saved={generation:1,checkpoint:{phase:'research',round:4,rows:[[a.url,a]],rejectedBoards:[]}};
 const view={generation:1,status:'PENDING',discovery_recovery:{round:5,rows:[[a.url+'?utm_source=dup',a],[b.url,b]]}};
 for(const bad of [{...view,generation:0},{...view,status:'COMPLETE'},{...view,discovery_recovery:{...view.discovery_recovery,round:2}},
  {...view,discovery_recovery:{...view.discovery_recovery,round:7}}])assert.equal(restoreDiscoveryRecovery(saved,bad,1).restored,0);
 assert.equal(restoreDiscoveryRecovery({...saved,result:{status:'COMPLETE'}},view,1).restored,0);
 assert.equal(restoreDiscoveryRecovery({...saved,failure:{retryable:false}},view,1).restored,0);
 assert.equal(restoreDiscoveryRecovery({...saved,checkpoint:{...saved.checkpoint,phase:'verification'}},view,1).restored,0);
 assert.equal(restoreDiscoveryRecovery(saved,view,1,[b.url+'?utm_source=history']).restored,0);
 assert.equal(discoveryRecoverySnapshot(saved.checkpoint,{...saved.checkpoint,phase:'reporting'}),undefined);
 assert.equal(restoreDiscoveryRecovery(saved,view,1).restored,1);
});

test('route restores discovery supplements under existing leases and persists before starting another invocation',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/discoveryRecoverySnapshot\(input\.checkpoint,input\.recoveryState\?\.\(\)\)/);
 assert.match(route,/await saveMatchTask\(env,input\.taskKey,recovered\.saved\)/);
 assert.match(route,/const saved=await recoverSavedDiscovery\(env,input,durable\)/);
 assert.match(route,/const saved=await recoverSavedDiscovery\(env,input,durable,view\)/);
 assert.match(route,/progress:view\.progress\|\|null/);
 assert.doesNotMatch(route,/return reply\(\{[^}]*discovery_recovery/);
});


test('candidate bursts reuse one progress timer and one coalesced write while reports retain priority',async()=>{
 const {createV4ProgressPublisher}=await import('../functions/_lib/v4-progress-publisher.js');
 const clock=progressClock(),writes=[];let timers=0,jobs=0;
 const publisher=createV4ProgressPublisher({...clock,schedule:(fn,delay)=>{timers++;return clock.schedule(fn,delay);},
  publish:kind=>writes.push({kind,jobs})});
 for(let i=0;i<100;i++){jobs++;publisher.queue('candidate');publisher.queue('routine');}
 assert.equal(timers,1);
 await clock.advance(0);
 assert.deepEqual(writes,[{kind:'candidate',jobs:100}]);
 for(let i=0;i<100;i++){jobs++;publisher.queue('candidate');}
 assert.equal(timers,2);
 publisher.queue('report');
 assert.equal(timers,3);
 await clock.advance(1000);
 assert.deepEqual(writes,[{kind:'candidate',jobs:100},{kind:'report',jobs:200}]);
 await publisher.stop();
});

test('background route consumes compact candidate events and preserves the existing report and resource gates',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 assert.match(route,/deferDiscoverySnapshots:!!input\.background,onDiscoveryCandidate:rememberDiscovery/);
 assert.match(route,/if\(!input\.background\)\{send\('discovery_candidate',event\);return;\}/);
 assert.match(route,/currentCandidateKeys\.has\(key\)/);
 assert.match(route,/lastJobs\.push\(/);
 assert.match(route,/queueProgress\('candidate'\)/);
 assert.match(route,/researchEvidence\(j\)\?structuredClone\(j\)/);
 assert.match(route,/budget\?\.canPublishProgress\(kind\)/);
 assert.match(route,/budget\?\.tryProgress\(kind\)/);
 assert.doesNotMatch(route,/kind!=='candidate'\|\|budget\.snapshot\(\)\.soft-budget\.used>=8/);
 assert.match(route,/jobs:\[\.\.\.lastJobs\]/);
 assert.match(route,/await saveMatchTask\(env,input\.taskKey,\{checkpoint:result\.checkpoint/);
});


test('citation-only progress survives interrupted research without becoming a verified job',async()=>{
 const {discoveryRecoverySnapshot,restoreDiscoveryRecovery}=await import('../functions/_lib/v4-discovery-recovery.js');
 const a='https://careers.employer.cn/jobs/1',b='https://careers.employer.cn/jobs/2',excluded='https://www.zhipin.com/job_detail/123';
 const base={phase:'research',round:1,rows:[],sourceLeads:[a],toolUrls:[]};
 const current={...base,round:2,sourceLeads:[a,b,b+'?utm_source=test',excluded,'https://localhost/secret']};
 const supplement=discoveryRecoverySnapshot(base,current);
 assert.deepEqual(supplement.rows,[]);assert.deepEqual(supplement.sources,[b]);
 const recovered=restoreDiscoveryRecovery({generation:2,checkpoint:base},{generation:2,status:'PENDING',discovery_recovery:supplement},2);
 assert.equal(recovered.restored,0);assert.equal(recovered.restoredSources,1);
 assert.deepEqual(recovered.saved.checkpoint.sourceLeads,[a,b]);
 assert.deepEqual(recovered.saved.checkpoint.rows,[]);assert.deepEqual(recovered.saved.checkpoint.toolUrls,[]);
 const replay=restoreDiscoveryRecovery(recovered.saved,{generation:2,status:'PENDING',discovery_recovery:supplement},2);
 assert.equal(replay.restoredSources,undefined);
});


test('urgent progress has reserved hosting allowance after normal research crosses its soft limit',async()=>{
 const {phaseResourceBudget,PHASE_YIELD}=await import('../functions/_lib/v4-phase-budget.js');
 const budget=phaseResourceBudget({initial:8,soft:24,hard:34,progressReserve:4});
 budget.take('fetch',16);
 assert.equal(budget.canStart(),false);
 assert.equal(budget.canPublish(),false);
 assert.equal(budget.tryProgress('routine'),false);
 for(let i=0;i<3;i++)assert.equal(budget.tryProgress('candidate'),true);
 assert.equal(budget.tryProgress('candidate'),false);
 assert.equal(budget.snapshot().progress_remaining,1);
 assert.equal(budget.tryProgress('report'),true);
 assert.equal(budget.snapshot().progress_remaining,0);
 assert.equal(budget.tryProgress('report'),false);
 assert.equal(budget.used,28);
 budget.take('fetch',6);
 assert.throws(()=>budget.take('fetch'),{code:PHASE_YIELD});
 assert.equal(budget.used,34);
 // A new invocation restores the host allowance; no task/model call cap.
 const next=phaseResourceBudget({progressReserve:4});
 assert.equal(next.canStart(),true);
 assert.equal(next.snapshot().progress_remaining,4);
});

test('research cannot spend a reserved report slot before actual progress publication',async()=>{
 const {phaseResourceBudget,PHASE_YIELD}=await import('../functions/_lib/v4-phase-budget.js');
 const budget=phaseResourceBudget({initial:8,soft:24,hard:34,progressReserve:4});
 budget.take('fetch',22);
 assert.throws(()=>budget.take('fetch'),{code:PHASE_YIELD});
 assert.equal(budget.denied,true);
 assert.equal(budget.tryProgress('report'),true,'already completed results may still be published after resource yield');
 assert.equal(budget.used,31);
 assert.equal(budget.snapshot().progress_remaining,3);
 budget.observe('checkpoint',3);
 assert.equal(budget.used,34);
 assert.equal(budget.tryProgress('report'),false);
});

test('coalesced live publisher delivers real candidates and reports at exhausted research soft budget',async()=>{
 const {phaseResourceBudget}=await import('../functions/_lib/v4-phase-budget.js');
 const {createV4ProgressPublisher}=await import('../functions/_lib/v4-progress-publisher.js');
 const budget=phaseResourceBudget({initial:24,progressReserve:4});
 const clock=progressClock(),writes=[];let jobs=1;
 const publisher=createV4ProgressPublisher({...clock,canPublish:kind=>budget.canPublishProgress(kind),
  publish:kind=>{if(!budget.tryProgress(kind))return false;writes.push({kind,jobs});return true;}});
 publisher.queue('routine');await clock.advance(20000);
 assert.equal(writes.length,0);
 publisher.queue('candidate');await clock.advance(0);
 assert.deepEqual(writes,[{kind:'candidate',jobs:1}]);
 jobs=2;publisher.queue('report');await clock.advance(1000);
 assert.deepEqual(writes,[{kind:'candidate',jobs:1},{kind:'report',jobs:2}]);
 assert.equal(budget.snapshot().progress_remaining,2);
 await publisher.stop();
});


test('production route and browser correlate numeric publication stamps without extra network requests',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const browser=readFileSync(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 assert.match(route,/provider\.deliveryTelemetry=delivery/);
 assert.match(route,/delivery_stamp:write\.stamp,delivery_summary:delivery\.snapshot\(\)/);
 assert.match(route,/await saveMatchProgress\([^\n]+write\.finish\(true\)/);
 assert.match(route,/write\.finish\(false\)/);
 assert.match(browser,/data\.progress\.delivery_stamp/);
 assert.match(browser,/HHBA_V4_DELIVERY_CLIENT_APPLIED/);
 assert.match(browser,/key!==lastDeliveryStamp/);
 assert.match(browser,/onPartial\?\.\(reports\)/);
});

 test('report checkpoint recovery is generation-bound and cannot overwrite newer or terminal main state',async()=>{
 const {reportRecoverySnapshot,restoreReportRecovery}=await import('../functions/_lib/v4-report-recovery.js');
 const saved={generation:2,checkpoint:{phase:'verification',matches:[]},checkpoint_captured_at:10};
 const recovery=reportRecoverySnapshot({phase:'verification',matches:[{id:'synthetic',report_status:'COMPLETE'}]},[],20);
 const view={generation:2,status:'PENDING',report_recovery:recovery,progress:{jobs:[]}};
 assert.equal(restoreReportRecovery(saved,view,2).checkpoint.matches[0].id,'synthetic');
 assert.equal(restoreReportRecovery({...saved,checkpoint_captured_at:21},view,2),null);
 assert.equal(restoreReportRecovery({...saved,result:{status:'COMPLETE'}},view,2),null);
 assert.equal(restoreReportRecovery(saved,{...view,generation:1},2),null);
 });

 test('a failed optional report write retries without a later model event',async()=>{
 const {createV4ProgressPublisher}=await import('../functions/_lib/v4-progress-publisher.js');
 const clock=progressClock();let attempts=0;
 const publisher=createV4ProgressPublisher({...clock,publish:()=>++attempts>1});
 publisher.queue('report');await clock.advance(0);assert.equal(attempts,1);
 await clock.advance(999);assert.equal(attempts,1);
 await clock.advance(1);assert.equal(attempts,2);
 await publisher.stop();
 });
