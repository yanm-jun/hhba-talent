// HHBA domestic static preview acceptance. No production network calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const data=JSON.parse(readFileSync(join('apps','web','public','data','domestic-jobs.json'),'utf8'));
const jobs=data.jobs;
test('snapshot has real recorded historical jobs with a stable schema',()=>{
 assert.equal(data.kind,'HHBA_DOMESTIC_SNAPSHOT_V1');
 assert.equal(data.total,297);
 assert.equal(jobs.length,data.total);
 assert.ok(Date.parse(data.updated));
 assert.ok(jobs.every(j=>j.recordKind==='DOMESTIC_ARCHIVE_SNAPSHOT'));
 assert.ok(jobs.every(j=>j.domestic===true&&j.currentApplicationVerified===false));
});
test('every public link points to exact Xiaomi official listing',()=>{
 const idSet=new Set(),urls=new Set();
 for(const job of jobs){
  assert.match(job.id,/^domestic-xiaomi-\d{12,22}$/);
  assert.match(job.url,/^https:\/\/xiaomi\.jobs\.f\.mioffice\.cn\/(?:index|campus|internship)\/position\/\d{12,22}\/detail$/);
  assert.equal(idSet.has(job.id),false,'duplicate public job ID');
  assert.equal(urls.has(job.url),false,'duplicate URL');
  idSet.add(job.id);urls.add(job.url);
  assert.equal(job.company,'小米集团');assert.ok(job.title.length>1);
  assert.ok(['SOCIAL','CAMPUS','INTERNSHIP'].includes(job.recruitmentType));
  assert.ok(Date.parse(job.observedAt));
 }
});
test('no private JD or fake real-time status is distributed',()=>{
 for(const j of jobs){
  assert.equal(j.responsibilitiesSummary,undefined);
  assert.equal(j.requirementsSummary,undefined);
  assert.equal(j.currentApplicationVerified,false);
  assert.equal(j.platform,'xiaomi-official');
 }
 const json=JSON.stringify(data);
 assert.doesNotMatch(json,/"(?:cookie|authorization|apiKey|accessToken|password)"\s*:/i);
});
test('cached records have enough fields for unified search',()=>{
 const search=(q,kind)=>jobs.filter(j=>(!kind||j.recruitmentType===kind)&&
  [j.title,j.company,j.location,j.educationLabel,j.experienceLabel].some(v=>String(v??'').toLowerCase().includes(q.toLowerCase())));
 assert.ok(search('小米').length>0);
 assert.ok(search('北京','SOCIAL').length>0);
 assert.ok(search('北京','INTERNSHIP').length>=0);
 assert.equal(search('北京','CAMPUS').length,0);
});
