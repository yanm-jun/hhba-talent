import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createUser,createSession} from '../functions/_lib/real-auth.js';
import {onRequest as accountRequest} from '../functions/api/account/[[path]].js';
import {onRequest as activityRequest} from '../functions/api/engagement/account.js';
import {onRequestGet as selfCheck} from '../functions/api/engagement/self-check.js';

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
    async first(){
     if(sql.startsWith('SELECT 1 AS present FROM hhba_account_activity WHERE account_hash=? LIMIT 1'))
      return [...activities.values()].some(a=>a.account_hash===args[0])?{present:1}:null;
     throw Error('Unexpected metrics .first SQL: '+sql);
    },
    async all(){
     if(sql.startsWith('SELECT area FROM hhba_account_activity WHERE account_hash=? AND day=? ORDER BY area')){
      return {results:[...activities.values()].filter(a=>a.account_hash===args[0]&&a.day===args[1])
       .map(a=>({area:a.area})).sort((a,b)=>a.area.localeCompare(b.area))};
     }
     throw Error('Unexpected self-check SQL: '+sql);
    },
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

test('real registration/saves persist, retired account writes are denied, historic records remain erasable',async()=>{
 const state=fixture(),now=Date.now();
 for(const [phone,username] of [['13900000001','testA'],['13900000002','testB']])
  await createUser(state.auth,{phone,username,passwordHash:'test-only-placeholder',nowMs:now});
 const tokenA=await createSession(state.auth,'13900000001',now);
 const tokenB=await createSession(state.auth,'13900000002',now);
 const env={HHBA_PNVS_AUTH_DB:state.auth,HHBA_METRICS_DB:state.metrics,
  HHBA_METRICS_SECRET:'only-for-isolated-flow-tests-not-production-123456789',
  HHBA_ACCOUNT_ANALYTICS_ENABLED:'1',ASSETS:state.ASSETS};
 assert.equal(state.users.size,2);
 assert.equal((await putSaved(env,tokenA)).status,200);
 assert.equal((await putSaved(env,tokenA)).status,200);
 assert.equal(state.saves.size,1);
 assert.equal((await (await getSaved(env,tokenB)).json()).items.length,0);
 assert.equal((await (await getSaved(env,tokenA)).json()).items[0].jobId,'JOB-TEST-001');
 assert.equal((await putSaved(env,tokenB,'NOT-IN-SOURCE')).status,404);

 // New account-linked event writes must be forbidden EVEN with a legacy consent header.
 for(const [token,extra] of [[tokenA,{}],[tokenB,{}],[null,{}],[tokenA,{'dnt':'1'}],[tokenA,{'sec-gpc':'1'}]])
  assert.equal((await post(env,token,'jobs',extra)).status,410);
 assert.equal(state.activities.size,0,'no new user-level tracks or DAU from ordinary behavior');
 assert.equal((await activityRequest({env,request:new Request(origin+'/api/engagement/account',{
  method:'POST',headers:{...headers(tokenA),origin:'https://evil.example'},body:JSON.stringify({area:'jobs'})
 })})).status,403,'cross-origin calls rejected');

 // Older accounts may still have previously consented history; deletion remains scoped and verifiable.
 const {hmac}=await import('../functions/_lib/metric-utils.js');
 const hashA=await hmac(env.HHBA_METRICS_SECRET,'account-activity-v1:13900000001');
 const hashB=await hmac(env.HHBA_METRICS_SECRET,'account-activity-v1:13900000002');
 state.activities.set(hashA+'|2026-01-01|jobs',{account_hash:hashA,day:'2026-01-01',area:'jobs'});
 state.activities.set(hashB+'|2026-01-01|tools',{account_hash:hashB,day:'2026-01-01',area:'tools'});
 const selfRequest=(token)=>new Request(origin+'/api/engagement/self-check',{headers:headers(token)});
 const oldA=await (await selfCheck({env,request:selfRequest(tokenA)})).json();
 assert.equal(oldA.recorded,false);
 assert.equal(oldA.historicalRecorded,true);
 assert.equal((await selfCheck({env,request:selfRequest(null)})).status,401);
 assert.equal((await wipe(env,tokenA)).status,200);
 assert.equal((await wipe(env,tokenA)).status,200,'history deletion remains idempotent');
 const after=await (await selfCheck({env,request:selfRequest(tokenA)})).json();
 assert.equal(after.recorded,false);assert.equal(after.historicalRecorded,false);
 assert.equal(state.activities.size,1,'second user history unaffected');
 assert.equal((await (await selfCheck({env,request:selfRequest(tokenB)})).json()).historicalRecorded,true);
 assert.equal(state.saves.size,1,'saved jobs not deleted along with historical activity');
 for(const session of state.sessions.values())if(session.phone==='13900000002')session.revoked=1;
 assert.equal((await wipe(env,tokenB)).status,401);
 assert.equal(state.activities.size,1);
});
test('retired POST remains disabled even when database and feature flag are unavailable',async()=>{
 const state=fixture(),env={HHBA_PNVS_AUTH_DB:state.auth,HHBA_METRICS_DB:state.metrics,HHBA_METRICS_SECRET:'test-secret-of-sufficient-length-123456'};
 assert.equal((await post(env,'invalid','jobs')).status,410);
 assert.equal((await selfCheck({env,request:new Request(origin+'/api/engagement/self-check')})).status,503);
 assert.equal(state.activities.size,0);
});
test('frontend never mounts analytics prompt or sends account bearer events',()=>{
 const market=readFileSync(new URL('../src/components/UnifiedJobMarket.tsx',import.meta.url),'utf8');
 assert.match(market,/trackEvent\('job_search','\/candidate\/jobs'\)/);
 assert.match(market,/hasEditedSearch\.current&&draft\.trim\(\)\.length>=2/);
 const root=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const tracker=readFileSync(new URL('../src/components/AnalyticsConsent.tsx',import.meta.url),'utf8');
 const metrics=readFileSync(new URL('../src/services/engagement.ts',import.meta.url),'utf8');
 const saved=readFileSync(new URL('../src/services/savedJobs.ts',import.meta.url),'utf8');
 const privacy=readFileSync(new URL('../src/pages/PersonalCenterPage.tsx',import.meta.url),'utf8');
 const resume=readFileSync(new URL('../src/components/PrivateResumeVault.tsx',import.meta.url),'utf8');
 const match=readFileSync(new URL('../src/pages/CandidateMatchPage.tsx',import.meta.url),'utf8');
 assert.match(root,/<AnonymousTrafficTracker\/>/);
 assert.match(tracker,/return null/);
 assert.doesNotMatch(tracker,/hhba-consent|同意使用情况统计|暂不同意|trackAccountActivity/);
 assert.doesNotMatch(metrics,/X-HHBA-Consent|Bearer '\+token.*POST/);
 assert.match(metrics,/credentials:'omit'/);
 assert.match(metrics,/referrerPolicy:'no-referrer'/);
 assert.doesNotMatch(saved,/trackAccountActivity/);
 assert.doesNotMatch(privacy,/hhba-personal-consent|setAnalyticsPreference|chooseAnalytics/);
 assert.match(privacy,/eraseAccountAnalytics/);
 assert.match(privacy,/historicalRecorded/);
 assert.match(privacy,/清除旧版活动记录/);
 assert.match(resume,/我已知悉并单独同意/);
 assert.match(match,/我同意 HHBA 提取简历文本/);
});
