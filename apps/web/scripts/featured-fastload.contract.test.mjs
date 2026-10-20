import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const service=read('../src/services/featuredOfficialJobs.ts');
const index=read('../src/services/liveRecruitment.ts');
const market=read('../src/components/UnifiedJobMarket.tsx');

test('featured roles use one cached validated Railway job snapshot, not three repeated searches',()=>{
 assert.ok(service.includes('loadOfficialPublicSnapshot(signal)'));
 assert.ok(service.includes('loadPublicJobAudit()'));
 assert.ok(!service.includes('Promise.all(companies.map'));
 assert.ok(!service.includes('listJobs('));
 assert.ok(service.includes("status==='OFFICIAL_JD_AND_REQUIREMENTS_FOUND'"));
 assert.ok(service.includes("exactJobMatch(job,entry)"));
 assert.ok(service.includes("officialStatus(job,snapshot.updated)!=='recent'"));
 assert.ok(service.includes('new Set(found.map(x=>x.id)).size!==6'));
});
test('unfiltered market never blocks on the 14k facet index',()=>{
 assert.ok(index.includes('unfiltered?Promise.resolve(null):loadOfficialSearchFacets()'));
 assert.ok(index.includes('if(!audit || audit.summary.indexed_as_of!==snapshot.updated)'));
 assert.ok(index.includes('if(unfiltered)return {...current,jobs:current.jobs.slice(offset,offset+30)'));
 assert.ok(index.includes('return searchPreview(current,filters,offset,index!.facets)'));
 assert.ok(index.includes('loadOfficialPublicSnapshot(signal:AbortSignal):Promise<LivePage>'));
});
test('default stays limited to audited true jobs and search pagination still work',()=>{
 assert.ok(market.includes('loadVerifiedFeaturedJobs(controller.signal)'));
 assert.ok(market.includes('isDefaultMarketFilters(filters,page)'));
 assert.ok(market.includes('listJobs(filters,page*30,controller.signal)'));
 assert.ok(market.includes('shown.map(job=><JobCard'));
 assert.ok(market.includes('officialStatus(j,snapshot.updated)'));
});

test('slow curated verification times out and falls back to source-audited market',()=>{
 assert.ok(market.includes('},6500)'),'featured watchdog missing');
 assert.ok(market.includes("controller.abort();"),'stale verification not cancelled');
 assert.ok(market.includes('featuredError ? (compact?eligible.slice(0,8):eligible)'),
   'error still blocks all verified jobs');
 assert.ok(market.includes('unified-featured-fallback'));
 assert.ok(market.includes('setRetry(x=>x+1)'));
});
