import test from 'node:test';import assert from 'node:assert/strict';
import {onRequestGet as publicMetric} from '../functions/api/metrics/public.js';
import {onRequestGet as privateMetric} from '../functions/api/admin/metrics.js';
import {onRequestPost as event} from '../functions/api/engagement/event.js';
import {onRequest as saved} from '../functions/api/saved/[[path]].js';
const origin='https://preview.hhba-talent.pages.dev',stamp=new Date().toISOString();
const jobs=[{id:'greenhouse-abc-123',company:'Acme',title:'Engineer'},{id:'greenhouse-abc-124',company:'Beta',title:'Outdated'}];
const audit={summary:{indexed_as_of:stamp,total_indexed_jobs:2,checked_at:stamp,official_ats_boards_checked:5,official_ats_board_failures:0},jobs:[{job_id:jobs[0].id,status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',full_original_jd_verified:true,requirements_evidence:true},{job_id:jobs[1].id,status:'MISSING_FROM_OFFICIAL_BOARD',full_original_jd_verified:false,requirements_evidence:false}]};
const ASSETS={fetch:async req=>{const path=new URL(req.url).pathname;return new Response(JSON.stringify(path.endsWith('job-sync-status.json')?audit:{jobs,total:2,updated:stamp}),{headers:{'content-type':'application/json'}})}};
const env={ASSETS,HHBA_METRICS_DB:{},HHBA_METRICS_SECRET:'contract-test-secret-at-least-thirtytwo-chars'};
test('public ATS metrics use exact same-origin audit and exclude missing jobs',async()=>{
 const r=await publicMetric({request:new Request(origin+'/api/metrics/public'),env});const x=await r.json();
 assert.equal(r.status,200);assert.equal(x.counts.displayableJobs,1);assert.equal(x.counts.indexedJobs,2);
 assert.equal(x.counts.auditedJobRequirements,1);assert.equal(x.counts.checkedAtsSources,5);
});
test('private metrics reject unauthenticated header even with a D1 binding',async()=>{
 const r=await privateMetric({request:new Request(origin+'/api/admin/metrics'),env});
 assert.equal(r.status,503);assert.equal((await r.json()).error,'ADMIN_ACCESS_NOT_CONFIGURED');
});
test('unlinked event count accepts same-origin calls without per-page consent and does not set a visitor cookie',async()=>{
 const writes=[];
 const db={prepare(){return {bind(...args){this.args=args;return this},async run(){writes.push(this.args);return {success:true}}}}};
 const metricsEnv={...env,HHBA_METRICS_DB:db};
 const request=(url,headers,body)=>new Request(url,{method:'POST',headers,body:JSON.stringify(body)});
 const good=await event({request:request(origin+'/api/engagement/event',{
  Origin:origin,'Content-Type':'application/json'
 },{type:'page_view'}),env:metricsEnv});
 assert.equal(good.status,202);
 assert.equal(good.headers.get('set-cookie'),null);
 assert.equal(writes.length,1);
 assert.equal(writes[0][1],'page_view');
 const offOrigin=await event({request:request(origin+'/api/engagement/event',{
  Origin:'https://attacker.invalid','Content-Type':'application/json'
 },{type:'page_view'}),env:metricsEnv});
 assert.equal(offOrigin.status,403);
 const sensitive=await event({request:request(origin+'/api/engagement/event',{
  Origin:origin,'Content-Type':'application/json'
 },{type:'page_view',path:'/candidate/account/private'}),env:metricsEnv});
 assert.equal(sensitive.status,400);
 assert.equal(writes.length,1);
});
test('saved jobs reject cross-site writes and arbitrary job IDs',async()=>{
 const r=await saved({request:new Request(origin+'/api/saved/greenhouse-abc-123',{method:'PUT',headers:{Origin:'https://attacker.invalid'}}),env});
 assert.equal(r.status,403);
});
test('legacy device bookmarks are read-only and cannot create new anonymous account data',async()=>{
 const r=await saved({request:new Request(origin+'/api/saved/greenhouse-abc-123',{
  method:'PUT',headers:{Origin:origin}}),env});
 assert.equal(r.status,410);
 assert.equal((await r.json()).error,'ACCOUNT_LOGIN_REQUIRED');
});
test('saved job reads without device cookie return no persisted records',async()=>{
 const r=await saved({request:new Request(origin+'/api/saved'),env});const a=await r.json();
 assert.equal(r.status,200);assert.equal(a.kind,'HHBA_DEVICE_SAVED_JOBS_V1');assert.deepEqual(a.items,[]);
});
