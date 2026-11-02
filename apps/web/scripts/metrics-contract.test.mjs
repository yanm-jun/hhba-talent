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
test('visitor event requires opt-in and same origin; never writes without consent',async()=>{
 const r=await event({request:new Request(origin+'/api/engagement/event',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({type:'page_view'})}),env});
 assert.equal(r.status,403);
});
test('saved jobs reject cross-site writes and arbitrary job IDs',async()=>{
 const r=await saved({request:new Request(origin+'/api/saved/greenhouse-abc-123',{method:'PUT',headers:{Origin:'https://attacker.invalid'}}),env});
 assert.equal(r.status,403);
});
test('saved job reads without device cookie return no persisted records',async()=>{
 const r=await saved({request:new Request(origin+'/api/saved'),env});const a=await r.json();
 assert.equal(r.status,200);assert.equal(a.kind,'HHBA_DEVICE_SAVED_JOBS_V1');assert.deepEqual(a.items,[]);
});
