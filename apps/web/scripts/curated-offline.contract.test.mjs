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
 assert.equal(manifest.numberOfJobs,100);
 assert.equal(jobs.jobs.length,100);
 assert.equal(companies.companies.length,10);
 assert.equal(new Set(jobs.jobs.map(j=>j.id)).size,100);
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
 for(const c of companies.companies){
  const list=jobs.jobs.filter(j=>j.company===c.name);
  assert.equal(list.length,10);
  assert.equal(list.filter(j=>j.editorial).length,10);
 }
 assert.equal(manifest.completeHumanReviewedChineseDescriptions,0);
 assert.equal(manifest.chineseEditorialSummaries,100);
 assert.equal(jobs.jobs.filter(j=>j.editorial).length,100);
 for(const job of jobs.jobs.filter(j=>j.editorial)){
  assert.equal(job.editorial.verification,'official_page_read');
  assert.ok(job.editorial.overview.length>30);
  assert.ok(job.editorial.responsibilities.length>=3);
  assert.ok(job.editorial.requirements.length>=3);
  assert.ok(job.editorial.source.startsWith('https://'));
  const source=new URL(job.editorial.source),origin=new URL(job.originalUrl);
  assert.equal(source.protocol,'https:');
  assert.equal(source.hostname.replace(/^www\./,'').replace(/^boards\.greenhouse\.io$/,'job-boards.greenhouse.io'),origin.hostname.replace(/^www\./,'').replace(/^boards\.greenhouse\.io$/,'job-boards.greenhouse.io'));
  assert.ok(job.editorial.benefits.length>0);
 }
 console.log('HHBA_CURATED_OFFLINE_CONTRACT_OK',JSON.stringify({companies:companies.companies.length,jobs:jobs.jobs.length,platforms:[...new Set(jobs.jobs.map(j=>j.originalPlatform))],thirdPartyFullJDs:0}));
});
test('offline mode uses same-origin JSON, not overseas ATS, Railway, or live JD fetches',()=>{
 const client=readFileSync('src/services/liveRecruitment.ts','utf8');
 const root=readFileSync('src/pages/HomePage.tsx','utf8');
 const router=readFileSync('src/main.tsx','utf8');
 assert.match(client,/BASE_URL\+'curated\/v1\/jobs\.json'/);
 assert.match(client,/if\(CURATED_100\)return listArchivedJobs\(filters,offset,signal\)/);
 assert.match(router,/VITE_HHBA_CURATED_STATIC==='1'/);
 assert.match(router,/if\(route==='\/'\)return <HomePage user=\{user\}\/>/);
 assert.doesNotMatch(router,/CuratedHomePage/);
 assert.match(client,/recordKind:'CURATED_HISTORICAL'/);
 assert.match(root,/UnifiedJobMarket compact/);
 assert.match(router,/if\(route==='\/candidate'\)return import\.meta\.env\.VITE_HHBA_CURATED_STATIC/);
 assert.match(router,/UnifiedJobDetail/);
 assert.match(readFileSync('src/components/UnifiedJobMarket.tsx','utf8'),/历史公开岗位/);
 assert.match(readFileSync('src/components/UnifiedJobMarket.tsx','utf8'),/job\.editorial\.responsibilities/);
 assert.match(readFileSync('src/components/UnifiedJobMarket.tsx','utf8'),/尚未取得可核实/);
});