import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {v4PhaseMetricSample,recordV4PhaseOps,readV4PhaseOps} from '../functions/_lib/v4-phase-ops-metrics.js';
const sql=readFileSync(new URL('../d1/20261126_v4_phase_ops_daily.sql',import.meta.url),'utf8')+readFileSync(new URL('../d1/20261126_v4_phase_ops_resources.sql',import.meta.url),'utf8');
function database(){
 const db=new DatabaseSync(':memory:');db.exec(sql);
 return {db,cloud:{prepare(query){return {bind(...args){return {async run(){const r=db.prepare(query).run(...args);return {success:true,meta:{changes:Number(r.changes)}}},async all(){return {results:db.prepare(query).all(...args)}}}}}}}};
}
test('phase operations are true aggregate observations, not synthetic users or job data',async()=>{
 const {db,cloud}=database(),start=Date.parse('2026-11-26T04:00:00.000Z'),finished=start+35000;
 const sample=v4PhaseMetricSample({started:start,finished,lane:'discovery',outcome:'CONTINUE',recovering:true,first:{result_candidate:1400,result_jd:5600},
  events:[{kind:'candidate',url:'https://company.invalid/secret'},{kind:'jd'},{kind:'score'}]});
 assert.deepEqual(Object.keys(sample).includes('url'),false);
 assert.equal(JSON.stringify(sample).includes('company.invalid'),false);
 assert.equal(sample.first_candidate_ms_total,1400);
 assert.equal(sample.recovered_successes,1);
 assert.equal(await recordV4PhaseOps(cloud,sample),true);
 assert.equal(await recordV4PhaseOps(cloud,sample),true);
 const stat=await readV4PhaseOps(cloud,'2026-11-26','2026-11-26');
 assert.equal(stat.summary.attempts,2);
 assert.equal(stat.summary.recoveryCompletionRate,100);
 assert.equal(stat.summary.averageElapsedMs,35000);
 assert.equal(stat.summary.firstCandidateMs,1400);
 assert.equal(stat.summary.firstReportMs,null);
 assert.equal(stat.summary.candidates,2);
 const first=db.prepare('SELECT * FROM hhba_v4_phase_ops_daily').all();
 assert.equal(first.length,1);
});
test('recoverable failures and permanent failures are counted separately',async()=>{
 const {cloud}=database(),start=Date.parse('2026-11-26T04:00:00.000Z');
 for(const [lane,outcome,error] of [['verification','RETRYABLE_FAILURE','AI_PROVIDER_RATE_LIMITED'],['verification','TERMINAL_FAILURE','AI_PROVIDER_KEY_REJECTED'],['reporting','COMPLETE',null]]){
  assert.equal(await recordV4PhaseOps(cloud,v4PhaseMetricSample({started:start,finished:start+10000,lane,outcome,error})),true);
 }
 const found=await readV4PhaseOps(cloud,'2026-11-26','2026-11-26');
 assert.equal(found.summary.attempts,3);
 assert.equal(found.summary.failureRate,66.67);
 assert.equal(found.summary.recoveredAttempts,0);
 assert.equal(found.summary.recoveryCompletionRate,null);
 assert.equal(found.stages.find(x=>x.lane==='verification').failureRate,100);
 assert.deepEqual(found.errors.map(x=>x.code).sort(),['AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_RATE_LIMITED']);
 const missing=await readV4PhaseOps(cloud,'2026-11-25','2026-11-25');
 assert.equal(missing.quality,'no_records');assert.equal(missing.summary,null);
 assert.deepEqual(await readV4PhaseOps({},'2026-11-26','2026-11-26'),{quality:'unavailable'});
});
test('metrics collector fails open when optional D1 table has not migrated',async()=>{
 const db={prepare(){throw Error('no migration')}};
 assert.equal(await recordV4PhaseOps(db,v4PhaseMetricSample({started:0,finished:1})),false);
 assert.deepEqual(await readV4PhaseOps(db,'2026-11-26','2026-11-26'),{quality:'unavailable'});
});
test('ops view reuses verified administrator API and does not expose applicant data',()=>{
 const dashboard=readFileSync(new URL('../../admin-preview/dashboard.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../../admin-preview/index.html',import.meta.url),'utf8');
 const metrics=readFileSync(new URL('../functions/api/admin/metrics.js',import.meta.url),'utf8');
 assert.match(html,/id="view-operations"/);
 assert.match(dashboard,/function renderV4Operations\(/);
 assert.match(dashboard,/renderAiUsage\(\);renderV4Operations\(\)/);
 assert.match(metrics,/await verifyAdmin\(request,env\)/);
 assert.match(metrics,/v4Operations:await readV4PhaseOps\(db,since,until\)/);
});

test('classified cloud binding calls aggregate separately and absent samples do not appear as zero usage',async()=>{
 const {cloud}=database(),start=Date.parse('2026-11-26T05:00:00.000Z');
 const resources={mode:'classified',classes:{network:3,database:8,storage:2,browser:1,maintenance:4},
  operations:{d1Statements:25},external_subrequests:{used:4,ceiling:46},service_subrequests:{used:14,ceiling:900}};
 const sample=v4PhaseMetricSample({started:start,finished:start+12500,lane:'verification',outcome:'CONTINUE',resources});
 assert.equal(sample.resource_samples,1);assert.equal(sample.external_calls,4);
 assert.equal(sample.d1_calls,8);assert.equal(sample.d1_statements,25);
 assert.ok(!JSON.stringify(sample).includes('ceiling'));
 await recordV4PhaseOps(cloud,sample);
 await recordV4PhaseOps(cloud,v4PhaseMetricSample({started:start,finished:start+20000,lane:'reporting',outcome:'COMPLETE'}));
 const stat=await readV4PhaseOps(cloud,'2026-11-26','2026-11-26');
 assert.equal(stat.summary.resourceSamples,1);
 assert.equal(stat.summary.externalCalls,4);
 assert.equal(stat.summary.serviceCalls,14);
 assert.equal(stat.summary.d1Calls,8);
 assert.equal(stat.summary.r2Calls,2);
 assert.equal(stat.summary.browserCalls,1);
 assert.equal(stat.summary.d1Statements,25);
 assert.equal(stat.stages.find(x=>x.lane==='verification').resourceSamples,1);
 assert.equal(stat.stages.find(x=>x.lane==='reporting').resourceSamples,0);
 const dashboard=readFileSync(new URL('../../admin-preview/dashboard.js',import.meta.url),'utf8');
 assert.match(dashboard,/if\(total\.resourceSamples>0\)/);
 assert.match(dashboard,/程序代理计数，非 Cloudflare 账单/);
});
