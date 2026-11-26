import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readV4SearchSpeed} from '../functions/_lib/v4-search-speed-read.js';

test('private admin summarizes real anonymous milestones without task identifiers',async()=>{
 const rows=[{status:'CONTINUE',observed_unique:50,milestone_1_ms:900,milestone_50_ms:13000,milestone_100_ms:null,milestone_300_ms:null,milestone_500_ms:null},
  {status:'COMPLETE',observed_unique:500,milestone_1_ms:700,milestone_50_ms:11000,milestone_100_ms:21000,milestone_300_ms:58000,milestone_500_ms:91000}];
 const db={prepare(sql){assert.match(sql,/SELECT status,observed_unique,milestone_1_ms/);assert.doesNotMatch(sql,/phone|resume|task_key/);return {bind(...params){assert.deepEqual(params,['2026-11-27','2026-11-27']);return {async all(){return {results:rows}}}}}}};
 const report=await readV4SearchSpeed(db,'2026-11-27','2026-11-27');
 assert.equal(report.quality,'collected');
 assert.equal(report.runs,2);
 assert.equal(report.completed,1);
 assert.equal(report.milestones[1].averageMs,12000);
 assert.equal(report.milestones.at(-1).samples,1);
 assert.equal(report.milestones.at(-1).reachRatePct,50);
 assert.equal(JSON.stringify(report).includes('task_key'),false);
});
test('empty and unavailable metrics stay unknown, not zero seconds',async()=>{
 const db={prepare(){return {bind(){return {async all(){return {results:[]}}}}}}};
 const report=await readV4SearchSpeed(db,'2026-11-27','2026-11-27');
 assert.equal(report.quality,'no_records');
 assert.equal(report.milestones[4].averageMs,null);
 assert.equal((await readV4SearchSpeed({},'2026-11-27','2026-11-27')).quality,'unavailable');
});
test('actual password-admin route is access-checked and the dashboard renders milestone sample coverage',()=>{
 const api=readFileSync(new URL('../functions/api/admin/metrics.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../../admin-preview/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../../admin-preview/dashboard.js',import.meta.url),'utf8');
 assert.match(api,/await verifyAdmin\(request,env\)/);
 assert.match(api,/v4SearchSpeed:await readV4SearchSpeed\(/);
 assert.match(html,/id="v4-search-speed-milestones"/);
 assert.match(js,/function renderV4SearchSpeed\(/);
 assert.match(js,/m\.samples/);
 assert.match(js,/renderV4SearchSpeed\(\);/);
});
