// Real SQLite and valid fake admin cookie: route tests without production credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from '../functions/_lib/console-password.js';
import {onRequestGet,onRequestPost}
 from '../functions/admin-preview/api/candidate-agent.js';

const ORIGIN='https://admin.hhba.work',EMAIL='test-owner@example.invalid';
const TOKEN='a'.repeat(43);
function database(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../d1/0031_candidate_agent_policy.sql',import.meta.url),'utf8'));
 const prepare=(sql,args=[])=>{
  const p=sqlite.prepare(sql);
  return {bind:(...v)=>prepare(sql,v),
   async first(){return p.get(...args)||null},
   async all(){return {results:p.all(...args),success:true}},
   async run(){const r=p.run(...args);return {success:true,meta:{changes:Number(r.changes)}}}
  };
 };
 const db={prepare:sql=>prepare(sql),async batch(stmts){
  sqlite.exec('BEGIN IMMEDIATE');
  try{const out=[];for(const s of stmts)out.push(await s.run());sqlite.exec('COMMIT');return out;}
  catch(e){sqlite.exec('ROLLBACK');throw e;}
 }};
 return {sqlite,db};
}
async function fixture(){
 const {db,sqlite}=database();
 const hash=await sha256(TOKEN);
 const owner={email:EMAIL,auth_version:'v1'};
 const session={expires_at:Math.floor(Date.now()/1000)+50000,owner_id:'owner',auth_version:'v1'};
 const kv={async get(key){if(key==='admin:owner')return owner;
    if(key==='session:'+hash)return session;return null},
   async put(){throw Error('unexpected write')}};
 return {db,sqlite,env:{
   HHBA_ADMIN_CONSOLE_ENABLED:'1',HHBA_METRICS_ADMIN_EMAIL:EMAIL,
   HHBA_ADMIN_AUTH_KV:kv,HHBA_PNVS_AUTH_DB:db
 }};
}
function request({method='GET',path='/admin-preview/api/candidate-agent',
 body=null,authenticated=true,origin=ORIGIN,header=true}={}){
 const headers={'Sec-Fetch-Site':'same-origin'};
 if(authenticated)headers.Cookie='__Host-hhba_admin='+TOKEN;
 if(method==='POST'){
  headers.Origin=origin;headers['Content-Type']='application/json';
  if(header)headers['X-HHBA-AGENT-ADMIN']='1';
 }
 return new Request(ORIGIN+path,{method,headers,
  ...(body!==null?{body:JSON.stringify(body)}:{})});
}
const parsed=async r=>({status:r.status,body:await r.json()});
const config=(revision=1)=>({
 enabled:true,expectedRevision:revision,
 skills:['resume_evidence','official_job_search','fit_scoring','targeted_resume_rewrite']
});
test('non-admin cannot read or change policy',async()=>{
 const {env,sqlite}=await fixture();
 const read=await parsed(await onRequestGet({request:request({authenticated:false}),env}));
 assert.equal(read.status,401);
 const write=await parsed(await onRequestPost({request:request({
   method:'POST',authenticated:false,body:config()
 }),env}));
 assert.equal(write.status,401);
 assert.equal(sqlite.prepare('SELECT enabled FROM hhba_candidate_agent_policy').get().enabled,0);
 sqlite.close();
});
test('admin API protects origin and requires a dedicated confirmation header',async()=>{
 const {env,sqlite}=await fixture();
 for(const settings of [{origin:'https://evil.example'},{header:false}]){
  const res=await parsed(await onRequestPost({
   request:request({method:'POST',body:config(),...settings}),env
  }));
  assert.equal(res.status,403);
 }
 const read=await parsed(await onRequestGet({request:request(),env}));
 assert.equal(read.status,200);
 assert.equal(read.body.policy.enabled,false);
 assert.equal(read.body.run_data_status,'not_requested');
 sqlite.close();
});
test('valid password owner can update, get revision; stale version is blocked',async()=>{
 const {env,sqlite}=await fixture();
 const set=await parsed(await onRequestPost({
  request:request({method:'POST',body:config()}),env
 }));
 assert.equal(set.status,200);
 assert.equal(set.body.policy.revision,2);
 const duplicate=await parsed(await onRequestPost({
  request:request({method:'POST',body:config()}),env
 }));
 assert.equal(duplicate.status,409);
 const disabled=await parsed(await onRequestPost({
  request:request({method:'POST',body:{...config(2),enabled:false}}),env
 }));
 assert.equal(disabled.status,200);
 assert.equal(disabled.body.policy.enabled,false);
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM hhba_candidate_agent_policy_audit').get().n,2);
 const withRuns=await parsed(await onRequestGet({
  request:request({path:'/admin-preview/api/candidate-agent?runs=1'}),env
 }));
 assert.equal(withRuns.status,200);
 assert.equal(withRuns.body.run_data_status,'collected');
 assert.equal(withRuns.body.runs.recent.length,0);
 assert.doesNotMatch(JSON.stringify(withRuns.body),/test-owner@example/);
 sqlite.close();
});
test('unknown skills and extra fields rejected without changing policy',async()=>{
 const {env,sqlite}=await fixture();
 const result=await parsed(await onRequestPost({
  request:request({method:'POST',body:{
   ...config(),skills:['resume_evidence','other_skill']
  }}),env
 }));
 assert.equal(result.status,400);
 assert.equal(sqlite.prepare('SELECT enabled FROM hhba_candidate_agent_policy').get().enabled,0);
 sqlite.close();
});
