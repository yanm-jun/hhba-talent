import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve('public/curated/v1');
const read=n=>JSON.parse(readFileSync(resolve(root,n),'utf8'));
test('local curated archive is self-contained, source-audited, and finite',()=>{
 const manifest=read('manifest.json'),jobs=read('jobs.json'),companies=read('companies.json');
 assert.equal(manifest.kind,'HHBA_CURATED_OFFLINE_V1');
 assert.equal(jobs.kind,'HHBA_CURATED_JOBS_V1');
 assert.equal(companies.kind,'HHBA_CURATED_COMPANIES_V1');
 assert.equal(manifest.numberOfCompanies,10);
 assert.equal(manifest.numberOfJobs,150);
 assert.equal(jobs.jobs.length,150);
 assert.equal(companies.companies.length,10);
 assert.equal(new Set(jobs.jobs.map(j=>j.id)).size,150);
 assert.equal(manifest.externalApiAtRuntime,false);
 assert.equal(manifest.automaticSync,false);
 assert.equal(manifest.fullReprintedJobDescriptions,0);
 for(const j of jobs.jobs){
  assert.equal(j.currentApplicationVerified,false);
  assert.equal(j.status,'historical_public_posting');
  assert.equal(j.responsibilitiesZh,null);
  assert.equal(j.requirementsFullZh,null);
  assert.equal(j.originalDescriptionStored,false);
  assert.equal(j.fullJdReprintPermissionVerified,false);
  assert.equal(j.officialDescriptionPreviouslyObserved,true);
  assert.ok(j.titleZh&&j.titleEn&&j.company&&j.locationEn);
  const u=new URL(j.originalUrl);
  assert.equal(u.protocol,'https:');
  assert.ok(['greenhouse','ashby','lever'].includes(j.originalPlatform));
  assert.ok(Number.isFinite(Date.parse(j.snapshotObservedAt)));
 }
 for(const c of companies.companies)assert.equal(jobs.jobs.filter(j=>j.company===c.name).length,15);
 console.log('HHBA_CURATED_OFFLINE_CONTRACT_OK',JSON.stringify({companies:companies.companies.length,jobs:jobs.jobs.length,platforms:[...new Set(jobs.jobs.map(j=>j.originalPlatform))],thirdPartyFullJDs:0}));
});
test('offline mode uses same-origin JSON, not overseas ATS, Railway, or live JD fetches',()=>{
 const client=readFileSync('src/components/CuratedJobMarket.tsx','utf8');
 const root=readFileSync('src/pages/HomePage.tsx','utf8');
 const router=readFileSync('src/main.tsx','utf8');
 assert.match(client,/import\.meta\.env\.BASE_URL\+'curated\/v1\/'/);
 assert.doesNotMatch(client,/ashbyhq\.com|greenhouse\.io|api\.lever\.co|railway\.app|\/api\/jobs/);
 assert.match(root,/VITE_HHBA_CURATED_STATIC==='1'/);
 assert.match(router,/CuratedJobDetail/);
 assert.match(client,/历史公开岗位/);
 assert.match(client,/机器翻译，待人工审校/);
 assert.match(client,/岗位职责原文未收录/);
});