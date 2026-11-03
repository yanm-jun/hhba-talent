import test from 'node:test';
import assert from 'node:assert/strict';
import {queryAccountGrowth,rate} from '../functions/_lib/account-growth.js';
import {onRequest as record} from '../functions/api/engagement/account.js';

const series=['2026-11-01','2026-11-02','2026-11-03'].map(day=>({day}));
function table(choose){
 return {prepare(sql){return {
  bind(...args){this.args=args;return this},
  async first(){return choose(sql,this.args,'first')},
  async all(){return {results:choose(sql,this.args,'all')}}
 }}};
}

test('retention percentage excludes immature/empty cohort',()=>{
 assert.equal(rate(0,0),null);
 assert.equal(rate(3,4),75);
 assert.equal(rate(1,3),33.33);
});
test('unconnected activity and auth must return unknown, not fake zero',async()=>{
 const metrics=table(()=>{throw Error('no migration')});
 const v=await queryAccountGrowth({metricsDb:metrics,authDb:null,since:'2026-11-01',until:'2026-11-03',today:'2026-11-03',series});
 assert.equal(v.accounts.registeredUsers,null);
 assert.equal(v.activity.mau,null);
 assert.equal(v.activity.firstSeenRetention,null);
});
test('report uses real account totals, distinct usage areas and mature cohorts',async()=>{
 const auth=table((sql,args,mode)=>{
  if(sql.includes('COUNT(DISTINCT phone)'))return {n:11,users:3};
  if(sql.includes('GROUP BY day'))return [{day:'2026-11-02',n:2}];
  if(sql.includes('hhba_auth_users'))return {n:8};
  throw Error('unexpected auth SQL: '+sql);
 });
 const metrics=table((sql,args,mode)=>{
  if(sql.includes('COUNT(DISTINCT account_hash) AS n')&&sql.includes('SELECT day'))return [{day:'2026-11-02',n:4}];
  if(sql.includes('SELECT area'))return [{area:'jobs',n:3},{area:'policies',n:2}];
  if(sql.includes('AS period_active'))return {dau:1,wau:5,mau:6,period_active:5};
  if(sql.includes('account_activity_installed_at'))return {value:'2026-11-01T00:00:00Z'};
  if(sql.includes('WITH first_seen'))return {d1_eligible:4,d1_returned:2,d7_eligible:0,d7_returned:0};
  throw Error('unexpected metric SQL: '+sql);
 });
 const v=await queryAccountGrowth({metricsDb:metrics,authDb:auth,since:'2026-11-01',until:'2026-11-03',today:'2026-11-03',series,accountAnalyticsEnabled:true});
 assert.equal(v.accounts.registeredUsers,8);
 assert.equal(v.accounts.newRegistered,2);
 assert.equal(v.accounts.savedJobs,11);
 assert.equal(v.accounts.accountsWithSavedJobs,3);
 assert.equal(v.activity.mau,6);
 assert.equal(v.activity.areaUsers.jobs,3);
 assert.equal(v.activity.areaUsers.policies,2);
 assert.equal(v.activity.firstSeenRetention.d1.rate,50);
 assert.equal(v.activity.firstSeenRetention.d7.rate,null);
 assert.equal(v.activity.series[1].active,4);
 assert.equal('phone' in v.activity,false);
});
test('account collector rejects unsupported methods and cross-origin requests',async()=>{
 const env={};
 let response=await record({request:new Request('https://hhba.work/api/engagement/account',{method:'GET'}),env});
 assert.equal(response.status,405);
 response=await record({request:new Request('https://hhba.work/api/engagement/account',{method:'POST'}),env});
 assert.equal(response.status,403);
});
