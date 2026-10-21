import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPhase2Overview} from '../phase2-metrics.mjs';
const time='2026-10-21T02:00:00.000Z';
const make=()=>({
 feed:{updated:time,total:3,failures:0,jobs:[{id:'a',company:'Acme'},{id:'b',company:'Acme'},{id:'c',company:'Beta'}]},
 audit:{summary:{kind:'HHBA_OFFICIAL_FULL_JOB_JD_AUDIT_V1',indexed_as_of:time,total_indexed_jobs:3,checked_at:time,official_ats_boards_checked:2,official_ats_board_failures:0},
 jobs:[{job_id:'a',status:'OFFICIAL_JD_AND_REQUIREMENTS_FOUND',full_original_jd_verified:true,requirements_evidence:true},
 {job_id:'b',status:'OFFICIAL_SOURCE_READ_FAILED'},
 {job_id:'c',status:'OFFICIAL_JD_REQUIREMENTS_UNCLASSIFIED'}]}
});
test('same-batch counts and distinct company names only; failures are excluded from displayable',()=>{
 const {feed,audit}=make(),result=buildPhase2Overview(feed,audit,new Date('2026-10-21T03:00:00Z'));
 assert.equal(result.counts.indexedJobs,3);
 assert.equal(result.counts.displayableJobs,2);
 assert.equal(result.counts.auditedJobRequirements,1);
 assert.equal(result.counts.distinctIndexedCompanies,2);
 assert.equal(result.quality,'current');
 assert.equal(result.future.totalRegisteredUsers,null);
});
test('stale feed never presents investor headline numbers',()=>{
 const {feed,audit}=make(),r=buildPhase2Overview(feed,audit,new Date('2026-10-23T03:00:00Z'));
 assert.equal(r.quality,'stale');assert.equal(r.counts.displayableJobs,null);
});
test('mismatched audit fails closed',()=>{
 const {feed,audit}=make();audit.summary.indexed_as_of='2026-10-20T01:00:00Z';
 assert.throws(()=>buildPhase2Overview(feed,audit,new Date(time)),/MISMATCH/);
});
test('duplicates and missing audits rejected',()=>{
 const {feed,audit}=make();audit.jobs[2].job_id='a';
 assert.throws(()=>buildPhase2Overview(feed,audit,new Date(time)),/INVALID_AUDIT_RECORD/);
});
test('partial audit disclosed rather than passed off as verified',()=>{
 const {feed,audit}=make();audit.summary.official_ats_board_failures=1;
 assert.equal(buildPhase2Overview(feed,audit,new Date(time)).quality,'partial');
});
