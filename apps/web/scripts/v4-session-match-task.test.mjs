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
 assert.match(client,/data\.failure\?\.retryable\?15000:4000/);
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
