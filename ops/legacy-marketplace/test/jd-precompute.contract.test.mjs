import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeFeaturedATS} from '../featured-jd-catalog.mjs';

const ids=[
 'ashby-openai-18e64608-5881-4b8f-b5cf-abd09a8ff086',
 'ashby-openai-7ba0b390-b198-4101-80bb-b49a6dd62607',
 'greenhouse-anthropic-5426627008',
 'greenhouse-anthropic-5391293008',
 'greenhouse-spacex-8885762002',
 'greenhouse-spacex-8621995002'
];
const job=(id)=>({id,platform:id.split('-')[0],url:'https://jobs.example.org/'+id});
const catalog={rows:[job('greenhouse-airbnb-valid')],boards:10,failures:0,updated:'2026-10-20'};

test('all six truly source-verified featured jobs are queued with the existing ATS jobs',()=>{
 const result=mergeFeaturedATS(catalog,ids.map(job),ids);
 assert.equal(result.rows.length,7);
 assert.equal(result.featuredReady,6);
 assert.equal(result.failures,0);
 assert.deepEqual(ids,result.rows.filter(j=>ids.includes(j.id)).map(j=>j.id));
 assert.equal(catalog.rows.length,1,'original in-memory catalog should not be mutated');
});
test('missing or corrupted native evidence fails the safe incomplete-sync guard',()=>{
 const entries=ids.map(job);entries[3]=null;
 const partial=mergeFeaturedATS(catalog,entries,ids);
 assert.equal(partial.featuredReady,5);
 assert.equal(partial.failures,1);
 assert.ok(!partial.rows.some(j=>j.id===ids[3]));
 const spoof=ids.map(job);spoof[0]={...spoof[0],id:ids[4]};
 assert.equal(mergeFeaturedATS(catalog,spoof,ids).featuredReady,5);
});
test('the white frontend never starts automatic English ATS reads or client-side translations',()=>{
 const component=readFileSync(new URL('../../../apps/web/src/components/UnifiedJobMarket.tsx',import.meta.url),'utf8');
 const loader=component.slice(component.indexOf('useEffect(()=>{\n   if(!job)return;\n   const controller=new AbortController();\n   setJd(null)'));
 assert.ok(loader.includes('fetchPreparedBilingualJd(job,controller.signal)'));
 assert.ok(loader.includes('if(!allowLiveEnglish)'));
 assert.ok(loader.indexOf('if(!allowLiveEnglish)')<loader.indexOf('fetchOfficialJd(job,controller.signal)'));
 assert.ok(!loader.includes('translateGreenJd('));
});
test('production background queue prioritizes missing native ATS roles and never foreground translates',()=>{
 const code=readFileSync(new URL('../railway-function-20261018.ts',import.meta.url),'utf8');
 assert.ok(code.includes('mergeFeaturedATS(catalog,featured,BILINGUAL_FEATURED_IDS)'));
 assert.ok(code.includes('maxPartsPerTick:20'));
 assert.ok(code.includes('setTimeout(()=>void prewarmFeaturedEnglish(),4_000)'));
 assert.ok(code.includes('setTimeout(()=>void fullJdWorker?.tick(),35_000)'));
 assert.ok(code.includes('if(readyMatch)'));
 const endpoint=code.slice(code.indexOf('if(readyMatch)'),code.indexOf('if(u.pathname==="/api/jd-ready/status")'));
 assert.ok(endpoint.includes('durableJobStore.readyDocument('));
 assert.ok(!endpoint.includes('machineTranslations('));
 assert.ok(!endpoint.includes('officialDetail('));
});
