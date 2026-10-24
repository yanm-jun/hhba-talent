import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchJobs,parseNaturalQuery} from '../src/services/jobSearchFacets.mjs';

const manifest=JSON.parse(readFileSync(new URL('../public/campus-2027.json',import.meta.url),'utf8'));
const jobs=manifest.jobs;
test('all wave-1 entries are official 2027 position pages, not portals',()=>{
 assert.equal(manifest.kind,'HHBA_CAMPUS_2027_WAVE1_VERIFIED_DETAILS_V1');
 assert.equal(jobs.length,5);
 assert.equal(new Set(jobs.map(j=>j.id)).size,jobs.length);
 assert.equal(new Set(jobs.map(j=>j.url)).size,jobs.length);
 for(const j of jobs){
  assert.equal(j.domestic,true);
  assert.equal(j.recruitmentType,'CAMPUS');
  assert.equal(j.graduationYear,2027);
  assert.equal(j.currentApplicationVerified,false);
  assert.equal(j.recordKind,'OFFICIAL_JOB_PAGE_OBSERVED');
  assert.ok(j.responsibilitiesSummary&&j.requirementsSummary);
  const url=new URL(j.url);
  assert.equal(url.protocol,'https:');
  assert.ok(url.host==='talent.baidu.com' || url.host==='zhaopin.meituan.com');
  assert.notEqual(url.pathname,'/');
 }
});
test('2027 秋招 searches the intended cohort only',()=>{
 const parsed=parseNaturalQuery('2027 秋招');
 assert.equal(parsed.jobType,'CAMPUS');
 assert.equal(parsed.graduationYear,2027);
 assert.equal(searchJobs(jobs,{q:'2027 秋招'}).counted,5);
 assert.equal(searchJobs(jobs,{q:'2026 校招'}).counted,0);
});
test('real companies and cities are searchable in Chinese',()=>{
 assert.equal(searchJobs(jobs,{q:'百度 2027 秋招'}).counted,4);
 assert.equal(searchJobs(jobs,{q:'美团 2027校招'}).counted,1);
 assert.equal(searchJobs(jobs,{q:'上海 2027秋招'}).counted,1);
 assert.equal(searchJobs(jobs,{q:'北京 后端开发'}).counted,1);
});
test('official metadata does not claim applicant availability',()=>{
 assert.ok(jobs.every(j=>j.currentApplicationVerified===false));
 assert.ok(jobs.every(j=>!('job_description_raw' in j)));
});
