import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createUser,createSession} from '../functions/_lib/real-auth.js';
import {onRequest as accountRequest} from '../functions/api/account/[[path]].js';
import {onRequest as activityRequest} from '../functions/api/engagement/account.js';

const origin='https://hhba.work';
const today=()=>new Date().toISOString().slice(0,10);
function fixture(){
 const users=new Map(),sessions=new Map(),saves=new Map(),activities=new Map();
 const auth={
  prepare(sql){
   let args=[];
   return {
    bind(...items){args=items;return this},
    async first(){
     if(sql.includes('SELECT * FROM hhba_auth_sessions WHERE token_hash=?'))return sessions.get(args[0])||null;
     if(sql.includes('SELECT * FROM hhba_auth_users WHERE phone=?'))return users.get(args[0])||null;
     if(sql.includes('COUNT(*) AS n FROM hhba_candidate_saved_jobs WHERE phone=?'))
      return {n:[...saves.values()].filter(x=>x.phone===args[0]).length};
     if(sql.includes('SELECT job_id FROM hhba_candidate_saved_jobs WHERE phone=? AND job_id=?'))
      return saves.get(args[0]+'|'+args[1])||null;
     if(sql.includes("COUNT(*) AS n FROM hhba_auth_users WHERE role='candidate'"))
      return {n:[...users.values()].filter(u=>u.role==='candidate').length};
     throw Error('Unexpected auth .first SQL: '+sql);
    },
    async all(){
     if(sql.includes('SELECT job_id AS jobId,saved_at AS savedAt FROM hhba_candidate_saved_jobs WHERE phone=?'))
      return {results:[...saves.values()].filter(x=>x.phone===args[0]).map(x=>({jobId:x.job_id,savedAt:x.saved_at}))};
     throw Error('Unexpected auth .all SQL: '+sql);
    },
    async run(){
     if(sql.startsWith('INSERT INTO hhba_auth_users')){const [phone,username,,role,created_at]=args;users.set(phone,{phone,username,role,created_at});return {success:true}}
     if(sql.startsWith('INSERT INTO hhba_auth_sessions')){const [hash,phone,created_at,expires_at]=args;sessions.set(hash,{token_hash:hash,phone,created_at,expires_at,revoked:0});return {success:true}}
     if(sql.startsWith('UPDATE hhba_auth_sessions SET last_seen_at=')){const s=sessions.get(args[1]);if(s)s.last_seen_at=args[0];return {success:true}}
     if(sql.startsWith('INSERT OR IGNORE INTO hhba_candidate_saved_jobs')){const [phone,job_id,saved_at]=args;saves.set(phone+'|'+job_id,{phone,job_id,saved_at});return {success:true}}
     if(sql.startsWith('DELETE FROM hhba_candidate_saved_jobs')){saves.delete(args[0]+'|'+args[1]);return {success:true}}
     throw Error('Unexpected auth .run SQL: '+sql);
    }
   };
  }
 };
 const metrics={
  prepare(sql){
   let args=[];
   return {
    bind(...items){args=items;return this},
    async run(){
     if(sql.startsWith('INSERT OR IGNORE INTO hhba_account_activity')){
      const [account_hash,day,area,created_at]=args;
      activities.set(account_hash+'|'+day+'|'+area,{account_hash,day,area,created_at});
      return {success:true};
     }
     if(sql.startsWith('DELETE FROM hhba_account_activity WHERE account_hash=?')){
      for(const key of activities.keys())if(key.startsWith(args[0]+'|'))activities.delete(key);
      return {success:true};
     }
     throw Error('Unexpected metrics SQL: '+sql);
    }
   };
  }
 };
 const ASSETS={async fetch(request){
  const route=new URL(request.url).pathname;
  if(route==='/data/jobs.json')return Response.json({jobs:[{id:'JOB-TEST-001'}]});
  return new Response('not found',{status:404});
 }};
 return {auth,metrics,ASSETS,users,sessions,saves,activities};
}
const headers=(token,extra={})=>({
 origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...extra
});
const post=(env,token,area,extra={})=>activityRequest({env,request:new Request(origin+'/api/engagement/account',{
 method:'POST',headers:headers(token,{'x-hhba-consent':'yes',...extra}),body:JSON.stringify({area,phone:'untrusted-caller-field'})
})});
const getSaved=(env,token)=>accountRequest({env,request:new Request(origin+'/api/account/saved',{headers:headers(token)})});
const putSaved=(env,token,jobId='JOB-TEST-001')=>accountRequest({env,request:new Request(origin+'/api/account/saved/'+jobId,{
 method:'PUT',headers:headers(token)
})});
const wipe=(env,token)=>activityRequest({env,request:new Request(origin+'/api/engagement/account',{method:'DELETE',headers:headers(token)})});

test('registration, real saved-job writes, consented events, isolation, and erasure form one consistent flow',async()=>{
 const state=fixture(),now=Date.now();
 for(const [phone,username] of [['13900000001','testA'],['13900000002','testB']])
  await createUser(state.auth,{phone,username,passwordHash:'test-only-placeholder',nowMs:now});
 const tokenA=await createSession(state.auth,'13900000001',now);
 const tokenB=await createSession(state.auth,'13900000002',now);
 const env={HHBA_PNVS_AUTH_DB:state.auth,HHBA_METRICS_DB:state.metrics,
  HHBA_METRICS_SECRET:'only-for-isolated-flow-tests-not-production-123456789',
  HHBA_ACCOUNT_ANALYTICS_ENABLED:'1',ASSETS:state.ASSETS};
 assert.equal(state.users.size,2,'created registered candidates');

 // Real saved-jobs endpoint must update account storage, not a device visitor table.
 assert.equal((await putSaved(env,tokenA)).status,200);
 assert.equal((await putSaved(env,tokenA)).status,200,'duplicate save is idempotent');
 assert.equal(state.saves.size,1);
 assert.equal((await (await getSaved(env,tokenB)).json()).items.length,0,'accounts cannot read each other\'s saves');
 assert.equal((await (await getSaved(env,tokenA)).json()).items[0].jobId,'JOB-TEST-001');
 assert.equal((await putSaved(env,tokenB,'NOT-IN-SOURCE')).status,404,'invalid source job cannot be saved');

 // Neither unauthenticated traffic nor opt-outs are allowed into account activity.
 assert.equal((await post(env,null,'jobs')).status,401);
 assert.equal((await activityRequest({env,request:new Request(origin+'/api/engagement/account',{
  method:'POST',headers:headers(tokenA),body:JSON.stringify({area:'jobs'})
 })})).status,403,'explicit consent required');
 assert.equal((await post(env,tokenA,'jobs',{'dnt':'1'})).status,403,'DNT honored');
 assert.equal((await post(env,tokenA,'jobs',{'sec-gpc':'1'})).status,403,'GPC honored');
 assert.equal((await post(env,tokenA,'unknown')).status,400,'no arbitrary event labels');

 // Per-day account dedup prevents inflated DAU and user counts.
 for(const area of ['jobs','jobs','policies','companies','job_save'])
  assert.equal((await post(env,tokenA,area)).status,202);
 assert.equal(state.activities.size,4,'one row per account/day/function area');
 assert.equal(new Set([...state.activities.values()].map(x=>x.account_hash)).size,1);
 assert.ok([...state.activities.values()].every(x=>x.day===today()));
 assert.equal((await post(env,tokenB,'jobs')).status,202);
 assert.equal(new Set([...state.activities.values()].map(x=>x.account_hash)).size,2);
 assert.equal(state.activities.size,5);
 assert.ok([...state.activities.values()].every(x=>!JSON.stringify(x).includes('1390000000')),'metrics storage has no raw phone');

 // Origin and session security are mandatory even for a valid token.
 assert.equal((await activityRequest({env,request:new Request(origin+'/api/engagement/account',{
  method:'POST',headers:{...headers(tokenA,{'x-hhba-consent':'yes'}),origin:'https://evil.example'},body:JSON.stringify({area:'jobs'})
 })})).status,403);
 assert.equal((await wipe(env,tokenA)).status,200,'consent revocation deletes this account');
 assert.equal(state.activities.size,1,'another account remains untouched');
 assert.equal(state.saves.size,1,'withdrawal does not erase real job bookmarks');
 assert.equal((await wipe(env,tokenA)).status,200,'erasure is idempotent');
 assert.equal((await putSaved(env,tokenA)).status,200,'real saved jobs unaffected by analytics opt-out');

 // Deactivated/expired session must never write private metrics.
 for(const s of state.sessions.values())if(s.phone==='13900000002')s.revoked=1;
 assert.equal((await post(env,tokenB,'jobs')).status,401);
 assert.equal(state.activities.size,1);
});
test('disabled production feature is unknown, not faked user activity',async()=>{
 const state=fixture(),env={HHBA_PNVS_AUTH_DB:state.auth,HHBA_METRICS_DB:state.metrics,HHBA_METRICS_SECRET:'test-secret-of-sufficient-length-123456'};
 const r=await post(env,'not-a-real-session','jobs');
 assert.equal(r.status,503);
 assert.equal(state.activities.size,0);
});
test('frontend session changes and other-tab consent rechecks remain wired',()=>{
 const auth=readFileSync(new URL('../src/services/realAuth.ts',import.meta.url),'utf8');
 const consent=readFileSync(new URL('../src/components/AnalyticsConsent.tsx',import.meta.url),'utf8');
 assert.match(auth,/announceRealAuthChange\(\);/);
 assert.match(consent,/hhba:real-auth-changed/);
 assert.match(consent,/REAL_AUTH_TOKEN_KEY/);
 assert.match(consent,/hhba\.analytics\.consent\.v2/);
 assert.match(consent,/\[route,choice,authRevision\]/);
});
