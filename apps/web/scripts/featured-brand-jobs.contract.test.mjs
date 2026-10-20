import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const market=read('../src/components/UnifiedJobMarket.tsx');
const brands=read('../src/components/EmployerBrandLogo.tsx');
const selections=read('../src/services/featuredOfficialJobs.ts');
const provenance=read('../public/brands/SOURCES.md');

test('only genuine employer source identities may receive one of three logos',()=>{
 for(const expected of [
   "job.company==='OpenAI' && job.source==='openai' && job.platform==='ashby'",
   "job.company==='Anthropic' && job.source==='anthropic' && job.platform==='greenhouse'",
   "job.company==='SpaceX' && job.source==='spacex' && job.platform==='greenhouse'"
 ])assert.ok(brands.includes(expected),expected);
 assert.ok(brands.includes("verifiedBrandAssetUrl(target)"));
 assert.ok(brands.includes("asset?.company==='Anthropic'?'Claude 品牌标识（Anthropic）'"));
 assert.ok(brands.includes('onError={()=>setBroken(true)}'));
 assert.ok(brands.includes('<Building2'));
});
test('brand files match original OpenAI and Claude sites and SpaceX attribution hashes',()=>{
 for(const [name,domain] of [
   ['openai.svg','cdn.openai.com/brand/OpenAI-Logos-2025.zip'],
   ['claude.svg','claude.com/favicon.svg'],
   ['spacex.svg','commons.wikimedia.org/wiki/Special:FilePath/SpaceX_logo_black.svg']
 ]){
   const raw=readFileSync(new URL('../public/brands/'+name,import.meta.url));
   assert.ok(raw.toString('utf8').includes('<svg'),name+' is not SVG');
   assert.ok(!/<script|<foreignObject|onload\s*=/i.test(raw.toString('utf8')));
   const hex=createHash('sha256').update(raw).digest('hex');
   assert.ok(provenance.includes(name+' — https://'+domain+' — SHA-256 '+hex),name+' missing verifiable source and SHA');
 }
});
test('six curated positions are exact source verified job IDs, no invented card jobs',()=>{
 const curated=selections.slice(selections.indexOf('export const CURATED_JOBS'),selections.indexOf('const empty:LiveFilters'));
 const ids=curated.match(/id:'(?:ashby-openai|greenhouse-anthropic|greenhouse-spacex)-[a-zA-Z0-9-]+'/g)||[];
 assert.equal(ids.length,6);
 assert.equal(new Set(ids).size,6);
 assert.equal((curated.match(/company:'OpenAI'/g)||[]).length,2);
 assert.equal((curated.match(/company:'Anthropic'/g)||[]).length,2);
 assert.equal((curated.match(/company:'SpaceX'/g)||[]).length,2);
 assert.ok(selections.includes("status==='OFFICIAL_JD_AND_REQUIREMENTS_FOUND'"));
 assert.ok(selections.includes("officialStatus(job,snapshot.updated)!=='recent'"));
 assert.ok(selections.includes("job.title===entry.title"));
 assert.ok(selections.includes('!!safeOfficialJobUrl(job)'));
});
test('default market showcases six, filtered search and pagination keep the full job index',()=>{
 assert.ok(market.includes('loadVerifiedFeaturedJobs(controller.signal)'));
 assert.ok(market.includes('const defaultView=isDefaultMarketFilters(filters,page)'));
 assert.ok(market.includes('compact?featured:'));
 assert.ok(market.includes("compact?eligible.slice(0,8):eligible"));
 assert.ok(market.includes("onChange={e=>setDraft(e.target.value)}"));
 assert.ok(market.includes('listJobs(filters,page*30,controller.signal)'));
 assert.ok(market.includes("to={'/candidate/jobs/'+encodeURIComponent(job.id)}"));
 assert.ok(market.includes('<EmployerBrandLogo job={job}/>'));
 assert.ok(market.includes('featuredTitle(job,lang)'));
});
test('real selected official details and application stay independent of logo source',()=>{
 assert.ok(market.includes('fetchOfficialJd(job,controller.signal)'));
 assert.ok(market.includes('safeOfficialJobUrl(job)'));
 assert.ok(market.includes("'立即申请'"));
 assert.ok(!brands.includes('imagegen'));
 assert.ok(!selections.includes('example.com'));
});
