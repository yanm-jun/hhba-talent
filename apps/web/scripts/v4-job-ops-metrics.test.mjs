import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {v4JobMetricSample,recordV4JobOps,readV4JobOps} from '../functions/_lib/v4-job-ops-metrics.js';
const schema=readFileSync(new URL('../d1/20261127_v4_job_ops_daily.sql',import.meta.url),'utf8');
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec(schema);
 const cloud={prepare(sql){return {bind(...params){return {
  async run(){const r=db.prepare(sql).run(...params);return {success:true,meta:{changes:Number(r.changes)}};},
  async all(){return {results:db.prepare(sql).all(...params)};}
 }}}}};
 return {db,cloud};
}
test('independent JD and report execution metrics contain no candidate or account data',async()=>{
 const {db,cloud}=fixture(),started=Date.parse('2026-11-27T04:00:00.000Z');
 const success=v4JobMetricSample({started,finished:started+45000,lane:'verification',status:'DONE',
  evidence:{verified_jd:true,scored:true,report:false},
  task_key:'private-task-key',url:'https://private-company.example/test',resume:'personal cv'});
 assert.equal(success.verified_jds,1);assert.equal(success.scored_jobs,1);assert.equal(success.completed_reports,0);
 assert.equal(success.elapsed_ms_total,45000);
 assert.ok(!JSON.stringify(success).includes('private-company'));
 assert.ok(!JSON.stringify(success).includes('personal cv'));
 assert.equal(await recordV4JobOps(cloud,success),true);
 assert.equal(await recordV4JobOps(cloud,success),true);
 const cached=v4JobMetricSample({started,finished:started+10,lane:'verification',status:'DONE',cached:true,evidence:{verified_jd:true,scored:true}});
 assert.equal(cached.outcome,'CACHED');assert.equal(cached.verified_jds,0);
 assert.equal(await recordV4JobOps(cloud,cached),true);
 const failure=v4JobMetricSample({started,finished:started+5000,lane:'verification',status:'RETRY',error:'AI_PROVIDER_UPSTREAM_ERROR'});
 assert.equal(await recordV4JobOps(cloud,failure),true);
 assert.equal(await recordV4JobOps(cloud,v4JobMetricSample({started,finished:started+1000,lane:'reporting',status:'DONE',evidence:{report:true}})),true);
 const results=await readV4JobOps(cloud,'2026-11-27','2026-11-27');
 assert.equal(results.quality,'collected');
 assert.equal(results.summary.attempts,5);
 assert.equal(results.summary.done,3);
 assert.equal(results.summary.cached,1);
 assert.equal(results.summary.retries,1);
 assert.equal(results.summary.verifiedJds,2);
 assert.equal(results.summary.scoredJobs,2);
 assert.equal(results.summary.completedReports,1);
 assert.equal(results.stages.find(x=>x.lane==='verification').done,2);
 assert.deepEqual(results.errors,[{lane:'verification',code:'AI_PROVIDER_UPSTREAM_ERROR',count:1}]);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM hhba_v4_job_ops_daily').get().n,4);
});
test('missing migration, empty scope and unsupported job statuses never create invented metrics',async()=>{
 const {cloud}=fixture();
 assert.equal((await readV4JobOps(cloud,'2026-11-27','2026-11-27')).quality,'no_records');
 assert.equal(v4JobMetricSample({lane:'verification',status:'EMPTY',started:1,finished:2}),null);
 assert.equal(v4JobMetricSample({lane:'unknown',status:'DONE',started:1,finished:2}),null);
 assert.equal(await recordV4JobOps(cloud,null),false);
 assert.equal(await recordV4JobOps({prepare(){throw Error('migration missing')}},v4JobMetricSample({lane:'verification',status:'DONE',started:1,finished:2})),false);
 assert.deepEqual(await readV4JobOps({},'2026-11-27','2026-11-27'),{quality:'unavailable'});
});
test('the authenticated administrator sees an independent job panel, separate from phase metrics',()=>{
 const route=readFileSync(new URL('../functions/api/match-v4/[[path]].js',import.meta.url),'utf8');
 const api=readFileSync(new URL('../functions/api/admin/metrics.js',import.meta.url),'utf8');
 const dash=readFileSync(new URL('../../admin-preview/dashboard.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../../admin-preview/index.html',import.meta.url),'utf8');
 assert.ok(route.includes('await recordV4JobOps(env.HHBA_METRICS_DB,observed)'));
 assert.ok(route.includes('const {evidence,cached,...publicStatus}=result'));
 assert.ok(api.includes('v4IndependentJobs:await readV4JobOps(db,since,until)'));
 assert.ok(api.includes('await verifyAdmin(request,env)'));
 assert.ok(dash.includes('renderV4JobOperations()'));
 assert.ok(dash.includes("growth?.v4IndependentJobs"));
 assert.ok(html.includes('id="v4-job-ops-details"'));
});
