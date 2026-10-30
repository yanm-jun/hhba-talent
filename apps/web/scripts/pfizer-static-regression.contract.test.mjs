import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=(path)=>JSON.parse(readFileSync(path,'utf8'));
const historical=load('src/data/domesticAutumnVerifiedJobs20261028.json');
const pfizer=load('src/data/domesticPfizerOfficialJobs20261029.json');
const employer=load('src/data/domesticAutumnScreenshot20261028.json').entries.find(x=>x.id==='cn-autumn-003');
assert.equal(historical.jobs.length,35,'Preserve all 35 historical records');
assert.equal(pfizer.jobs.length,4,'Four individually linked China roles');
assert.equal(new Set(pfizer.jobs.map(x=>x.id)).size,4,'No duplicates');
assert(employer?.officialUrl==='https://www.pfizer.com/about/careers/search-results');
for (const job of pfizer.jobs){
  assert.equal(job.company,'辉瑞');
  assert.equal(job.recordKind,'job');
  assert.equal(job.locationScope,'job');
  assert(job.cities.length===1&&job.cities[0]);
  assert(job.responsibilities?.length>20&&job.requirements?.length>10);
  assert(/^https:\/\/www\.pfizer\.com\/about\/careers\/job\/\d+\?langcode=en$/.test(job.sourceUrl));
}
for (const file of ['src/pages/AutumnCompanyProfilePage.tsx','src/components/DomesticAutumnMarket.tsx']){
 const source=readFileSync(file,'utf8');
 assert(source.includes('domesticPfizerOfficialJobs20261029.json'),'Both views must import official Pfizer entries');
 assert(source.includes('[...jobsJSON.jobs,...pfizerJobsJSON.jobs]'),'Both views must append Pfizer to historic jobs');
 assert(source.includes('data-hhba-recruitment-outbound="true"'),'Recruitment outbound gated');
}
console.log('PFIZER_PAGES_SOURCE_DATA_OK',historical.jobs.length,pfizer.jobs.length);
