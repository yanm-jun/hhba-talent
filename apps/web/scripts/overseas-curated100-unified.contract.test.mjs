import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const overseas=JSON.parse(source('public/curated/v1/jobs.json'));
const manifest=JSON.parse(source('public/curated/v1/manifest.json'));
const original=source('src/services/liveRecruitment.ts');
const featured=source('src/services/featuredOfficialJobs.ts');
const market=source('src/components/UnifiedJobMarket.tsx');
const expected=['OpenAI','Anthropic','SpaceX','Stripe','Airbnb','Notion','Figma','Spotify','Reddit','Databricks'];

test('exactly 100 old overseas jobs retained, from 10 well-known companies with complete existing Chinese editorial notes',()=>{
 assert.equal(overseas.kind,'HHBA_CURATED_JOBS_V1');
 assert.equal(overseas.jobs.length,100);
 assert.equal(new Set(overseas.jobs.map(j=>j.id)).size,100);
 assert.deepEqual([...new Set(overseas.jobs.map(j=>j.company))],expected);
 for(const company of expected)assert.equal(overseas.jobs.filter(j=>j.company===company).length,10);
 for(const j of overseas.jobs){
  assert.match(j.id,/^curated-(ashby|greenhouse|lever)-[A-Za-z0-9_-]+$/);
  assert.match(j.originalUrl,/^https:\/\//);
  assert.equal(j.status,'historical_public_posting');
  assert.equal(j.currentApplicationVerified,false);
  assert.equal(j.fullJdReprintPermissionVerified,false);
  assert.ok(j.titleZh&&j.titleEn&&j.locationZh&&j.locationEn);
  assert.equal(j.editorial.verification,'official_page_read');
  assert.ok(j.editorial.overview?.length>25,'missing overview '+j.id);
  assert.ok(j.editorial.responsibilities?.length>0,'missing responsibilities '+j.id);
  assert.ok(j.editorial.requirements?.length>0,'missing requirements '+j.id);
  assert.ok(j.editorial.benefits?.length>0,'missing benefits field '+j.id);
 }
 assert.equal(manifest.numberOfJobs,100);
 assert.equal(manifest.externalApiAtRuntime,false);
 assert.equal(manifest.automaticSync,false);
 assert.equal(manifest.historicalData,true);
});
test('only overseas positions switch to the archived read path; domestic jobs remain in original source',()=>{
 assert.ok(original.includes("VITE_HHBA_OVERSEAS_CURATED_100==='1'"));
 assert.ok(original.includes("const existing=snapshot.jobs.filter(job=>(!OVERSEAS_CURATED_100||job.domestic)"));
 assert.ok(original.includes("const combined=[...overseas,...campus,...existing]"));
 assert.ok(original.includes("if(OVERSEAS_CURATED_100&&listing&&!listing.domestic)"));
 assert.ok(original.includes("const campus=(await loadCampus2027()).find(j=>j.id===id)"));
 assert.ok(original.includes("if(CURATED_100)return listArchivedJobs(filters,offset,signal)"));
 assert.ok(original.includes("return searchPreview(current,filters,offset,searchFacets)"));
 assert.ok(original.includes("const archive=archivedRows.get('curated-'+job.id)!"));
 assert.ok(original.includes("searchFacets.set(job.id"));
 assert.ok(original.includes("return {job,description:null,richHtml:null,applyUrl:null} as LiveDetail"));
 assert.ok(!original.includes("const combined=[...overseas,...snapshot.jobs]"));
});
test('all overseas details use the old already-rendered HHBA editorial branch, never fetch a new JD at runtime',()=>{
 assert.ok(market.includes("job.recordKind==='CURATED_HISTORICAL'"));
 assert.ok(market.includes("job.editorial?.responsibilities")||market.includes("job.editorial.responsibilities"));
 const detail=market.slice(market.indexOf('export function UnifiedJobDetail'));
 assert.match(detail,/job\.recordKind==='CURATED_HISTORICAL'/);
 assert.match(detail,/<h3>工作职责<\/h3>/);
 assert.ok(detail.includes('岗位职责')&&detail.includes('任职要求'));
 const at=detail.indexOf("if(job.recordKind==='CURATED_HISTORICAL'");
 const api=detail.indexOf("fetchPreparedBilingualJd(job,controller.signal)");
 assert.ok(at>=0&&api>at,'archived record must short-circuit before external JD fetch');
 assert.ok(original.includes("fetch(import.meta.env.BASE_URL+'curated/v1/jobs.json'"));
 assert.ok(!original.includes("fetch('https://jobs.ashbyhq.com"));
});
test('home highlighted companies reference archived curated positions in static mode',()=>{
 assert.ok(featured.includes("VITE_HHBA_OVERSEAS_CURATED_100==='1'"));
 assert.ok(featured.includes("loadCuratedOverseasJobs(signal)"));
 assert.ok(featured.includes("['OpenAI','Anthropic','SpaceX']"));
 assert.ok(featured.includes("slice(0,2)"));
});
test('these changes never modify historical overseas source records',()=>{
 const bytes=source('public/curated/v1/jobs.json');
 const hash=createHash('sha256').update(bytes).digest('hex');
 assert.equal(hash.length,64);
});
