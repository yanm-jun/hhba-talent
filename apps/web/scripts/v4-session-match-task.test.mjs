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
