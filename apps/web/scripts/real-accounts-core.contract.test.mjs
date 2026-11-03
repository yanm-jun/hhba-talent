import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {onRequest} from '../functions/api/account/[[path]].js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const now=new Date().toISOString();
const token=(who)=>'test-account-token-'+who;
const hash=s=>createHash('sha256').update(s).digest('hex');
function dbFixture(){
 const profiles=new Map(),saved=new Map();
 const users=new Map([
  ['13800138000',{phone:'13800138000',username:'alpha',role:'candidate'}],
  ['13900139000',{phone:'13900139000',username:'beta',role:'candidate'}]
 ]);
 const sessions=new Map([...users.keys()].map(phone=>[hash(token(phone)),{
  phone,token_hash:hash(token(phone)),revoked:0,expires_at:new Date(Date.now()+3600000).toISOString()
 }]));
 const statements=[];
 const db={prepare(sql){
  statements.push(sql);
  return {bind(...args){
   return {
    async first(){
     if(sql.startsWith('SELECT * FROM hhba_auth_sessions'))return sessions.get(args[0])||null;
     if(sql.startsWith('SELECT * FROM hhba_auth_users WHERE phone='))return users.get(args[0])||null;
     if(sql.startsWith('SELECT * FROM hhba_candidate_profiles'))return profiles.get(args[0])||null;
     if(sql.startsWith('SELECT COUNT(*) AS n FROM hhba_candidate_saved_jobs'))return {n:saved.get(args[0])?.size||0};
     if(sql.startsWith('SELECT job_id FROM hhba_candidate_saved_jobs'))return saved.get(args[0])?.has(args[1])?{job_id:args[1]}:null;
     throw Error('Unexpected first SQL '+sql);
    },
    async all(){
     if(sql.startsWith('SELECT job_id AS jobId')){
      const entries=saved.get(args[0])||new Map();
      return {results:[...entries].map(([jobId,savedAt])=>({jobId,savedAt}))};
     }
     throw Error('Unexpected all SQL '+sql);
    },
    async run(){
     if(sql.startsWith('UPDATE hhba_auth_sessions SET last_seen_at='))return {success:true,meta:{changes:1}};
     if(sql.startsWith('INSERT INTO hhba_candidate_profiles')){
      const keys=sql.match(/\(phone,([^)]*),updated_at\)/)?.[1]?.split(',')||[];
      const current=profiles.get(args[0])||{};
      keys.forEach((key,i)=>{current[key]=args[i+1]});
      profiles.set(args[0],current);
      return {success:true,meta:{changes:1}};
     }
     if(sql.startsWith('INSERT OR IGNORE INTO hhba_candidate_saved_jobs')){
      if(!saved.has(args[0]))saved.set(args[0],new Map());
      saved.get(args[0]).set(args[1],args[2]);
      return {success:true,meta:{changes:1}};
     }
     if(sql.startsWith('DELETE FROM hhba_candidate_saved_jobs')){
      saved.get(args[0])?.delete(args[1]);return {success:true,meta:{changes:1}};
     }
     throw Error('Unexpected run SQL '+sql);
    }
   };
  }};
 }};
 return {db,profiles,saved,statements};
}
const assets={fetch:async()=>new Response(JSON.stringify({jobs:[{id:'greenhouse-testjob-12345'}]}),{
 headers:{'Content-Type':'application/json'}
})};
async function invoke(fixture,route,who,method='GET',body=null,origin=null){
 const headers={...(who?{Authorization:'Bearer '+token(who)}:{}),
  ...(body?{'Content-Type':'application/json'}:{}),...(origin?{Origin:origin}:{})};
 const request=new Request('https://hhba.work/api/account'+route,{
  method,headers,...(body?{body:JSON.stringify(body)}:{})
 });
 const response=await onRequest({request,env:{HHBA_PNVS_AUTH_DB:fixture.db,ASSETS:fixture.assets||assets}});
 return {status:response.status,headers:response.headers,body:await response.json()};
}
test('every private endpoint rejects anonymous and forged tokens without reading a profile',async()=>{
 const f=dbFixture();
 for(const route of ['/profile','/preferences','/saved']){
  const a=await invoke(f,route,null);
  assert.equal(a.status,401);
  const b=await invoke(f,route,'unknown-user');
  assert.equal(b.status,401);
  assert.match(a.headers.get('Cache-Control'),/no-store/);
 }
 assert.equal(f.profiles.size,0);
});
test('one candidate cannot write or read another account profile or saved jobs',async()=>{
 const f=dbFixture(),a='13800138000',b='13900139000';
 const first=await invoke(f,'/profile',a,'PUT',{display_name:'Alpha真实用户',headline:'销售管理',city:'济南',intro:'真实资料',skills:'运营'});
 assert.equal(first.status,200);
 const mine=await invoke(f,'/profile',a);
 const others=await invoke(f,'/profile',b);
 assert.equal(mine.body.data.display_name,'Alpha真实用户');
 assert.equal(others.body.data.display_name,'beta');
 assert.equal(others.body.data.headline,'');
 assert.equal(JSON.stringify(mine.body).includes(a),false,'never reveal the phone in workspace JSON');
 assert.equal(f.profiles.size,1);
 const saved=await invoke(f,'/saved/greenhouse-testjob-12345',a,'PUT');
 assert.equal(saved.status,200);
 assert.equal((await invoke(f,'/saved',a)).body.items.length,1);
 assert.equal((await invoke(f,'/saved',b)).body.items.length,0);
 assert.equal((await invoke(f,'/saved/greenhouse-testjob-12345',b,'DELETE')).status,200);
 assert.equal((await invoke(f,'/saved',a)).body.items.length,1);
});
test('field and job validation denies unsupported, stale, oversized or cross-site mutations',async()=>{
 const f=dbFixture(),a='13800138000';
 assert.equal((await invoke(f,'/profile',a,'PUT',{display_name:'A'})).status,400);
 assert.equal((await invoke(f,'/profile',a,'PUT',{display_name:'x'.repeat(33),headline:'',city:'',intro:'',skills:''})).status,400);
 assert.equal((await invoke(f,'/preferences',a,'PUT',{preferred_role:'销售',preferred_city:'上海',work_mode:'火星'})).status,400);
 assert.equal((await invoke(f,'/saved/unknown-id',a,'PUT')).status,404);
 assert.equal((await invoke(f,'/saved/greenhouse-testjob-12345',a,'PUT',null,'https://attacker.example')).status,403);
 assert.equal(f.profiles.size,0);
 assert.equal(f.saved.size,0);
});
test('preferences survive account reads and profile edits; personal data never uses simulated storage',async()=>{
 const f=dbFixture(),a='13800138000';
 assert.equal((await invoke(f,'/preferences',a,'PUT',{preferred_role:'工程师',preferred_city:'上海',work_mode:'远程'})).status,200);
 assert.equal((await invoke(f,'/profile',a,'PUT',{display_name:'真实昵称',headline:'',city:'',intro:'',skills:''})).status,200);
 const result=await invoke(f,'/preferences',a);
 assert.equal(result.body.data.preferred_role,'工程师');
 assert.equal(result.body.data.work_mode,'远程');
 assert.equal(result.body.data.display_name,'真实昵称');
});
test('frontend routes restore verified sessions and send users to the original workbench',()=>{
 const main=read('src/main.tsx'),login=read('src/pages/PhoneAuthPage.tsx');
 const workbench=read('src/pages/PersonalCenterPage.tsx');
 const shell=read('src/components/Shell.tsx'),saved=read('src/services/savedJobs.ts');
 assert.match(main,/realAuth\.me\(\)/);
 assert.match(main,/realAuthToUser\(me\)/);
 assert.match(main,/route==='\/candidate'\)return user\?\.account_types\?\.includes\('candidate'\)/);
 assert.match(main,/onLogout=\{logout\}/);
 assert.match(login,/candidate \? '\/candidate\/account'/);
 assert.doesNotMatch(workbench,/useDemoAccount|updateDemoAccount|模拟账户|演示账户/);
 assert.doesNotMatch(shell,/useDemoAccount|demoModeEnabled|退出演示/);
 assert.match(workbench,/getCandidateWorkspaceProfile\(\)/);
 assert.match(saved,/HHBA_ACCOUNT_SAVED_JOBS_V1/);
 assert.match(saved,/Authorization:'Bearer '\+token/);
});
test('additive D1 migration only adds account-owned tables and never drops real users',()=>{
 const sql=read('d1/0006_real_candidate_workspace.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS hhba_candidate_profiles/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS hhba_candidate_saved_jobs/);
 assert.match(sql,/REFERENCES hhba_auth_users\(phone\)/);
 assert.doesNotMatch(sql,/\bDROP\b|DELETE FROM hhba_auth_users|TRUNCATE/i);
});

test('verified V2 and curated role IDs can be saved by their own accounts',async()=>{
 const f=dbFixture(),a='13800138000',b='13900139000';
 const ids={
  domestic:'cn-v2-schneider-123456',
  curated:'greenhouse-sample-9876'
 };
 f.assets={fetch:async(request)=>{
  const path=new URL(request.url).pathname;
  const payload=path==='/data/jobs.json'?{jobs:[]}:
   path==='/data/saveable-domestic-job-ids.json'?
    {kind:'HHBA_SAVEABLE_DOMESTIC_JOBS_V1',count:1,ids:[ids.domestic]}:
   path==='/curated/v1/jobs.json'?
    {kind:'HHBA_CURATED_JOBS_V1',jobs:[{id:'curated-'+ids.curated}]}:{};
  return new Response(JSON.stringify(payload),{headers:{'Content-Type':'application/json'}});
 }};
 assert.equal((await invoke(f,'/saved/'+ids.domestic,a,'PUT')).status,200);
 assert.equal((await invoke(f,'/saved/'+ids.curated,a,'PUT')).status,200);
 assert.equal((await invoke(f,'/saved',a)).body.items.length,2);
 assert.equal((await invoke(f,'/saved',b)).body.items.length,0);
 assert.equal((await invoke(f,'/saved/cn-v2-fake-1234',a,'PUT')).status,404);
 assert.equal((await invoke(f,'/saved/'+ids.domestic,a,'DELETE')).status,200);
 assert.deepEqual((await invoke(f,'/saved',a)).body.items.map(row=>row.jobId),[ids.curated]);
});
