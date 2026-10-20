import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const brands=file('../src/data/verifiedBrandAssets.json').records;
const one=file('../src/data/reviewedEmployers.json').profiles;
const added=['A','B','C','D'].flatMap(batch=>file('../src/data/companyEditorialAdditional'+batch+'.json').profiles);
const profiles=[...one,...added];
const curated=new Set(['OpenAI','Anthropic','SpaceX']);
const key=x=>JSON.stringify([x.platform,x.source,x.company]);
const bilingual=x=>typeof x?.zh==='string'&&typeof x?.en==='string'&&x.zh.trim().length>=2&&x.en.trim().length>=2;

test('all 50 marquee source identities have real independent editorials or a dedicated curated profile',()=>{
 assert.equal(brands.length,50);
 assert.equal(profiles.length,47);
 assert.equal(new Set(brands.map(key)).size,50);
 assert.equal(new Set(profiles.map(p=>key(p.identity))).size,47);
 const branded=new Set(brands.map(key));
 for(const p of profiles)assert.ok(branded.has(key(p.identity)),p.name+' not a known brand source');
 for(const brand of brands){
  if(curated.has(brand.company))continue;
  assert.ok(profiles.some(p=>key(p.identity)===key(brand)),brand.company+' has NO full editorial');
 }
});
test('each editorial is bilingual, source-attributed and never invents unknown founding years',()=>{
 for(const p of profiles){
  assert.equal(p.status,'VERIFIED',p.name);
  assert.equal(p.name,p.identity.company);
  assert.equal(p.id,Buffer.from(key(p.identity),'utf8').toString('base64url'),p.name);
  assert.ok(bilingual(p.tagline)&&bilingual(p.industry)&&bilingual(p.country),p.name);
  assert.match(p.founded,/^(?:[0-9]{4}|—)$/);
  assert.ok(p.overview.length>=2&&p.overview.every(bilingual),p.name);
  assert.ok(p.focus.length>=2&&p.focus.every(x=>bilingual(x.name)&&bilingual(x.description)),p.name);
  assert.ok(p.sources.length>=2&&p.sources.every(s=>{try{return new URL(s.url).protocol==='https:'}catch{return false}}),p.name);
  assert.ok(p.milestones.length>=1||p.founded==='—',p.name+' must not fabricate a history');
  assert.ok(p.overview.every(x=>x.zh.length>=25&&x.en.length>=35),p.name+' missing substantive bilingual paragraphs');
 }
});
test('Binance has actual profile content, official evidence and scoped Lever identity',()=>{
 const p=profiles.find(x=>x.name==='Binance');
 assert.ok(p);
 assert.deepEqual(p.identity,{platform:'lever',source:'binance',company:'Binance'});
 assert.equal(p.founded,'2017');
  assert.ok(p.overview.every(x=>x.zh.length>=25&&x.en.length>=35),p.name+' missing substantive bilingual paragraphs');
 assert.ok(p.focus.some(x=>x.name.en==='Binance Exchange'));
 assert.ok(p.sources.some(x=>x.url==='https://www.binance.com/en/about'));
});
test('recruiting-source aliases are explicitly distinguished from separate companies',()=>{
 const alpha=profiles.find(x=>x.name==='AlphaSights Campus Recruiting');
 const global=profiles.find(x=>x.name==='SpaceX Global');
 assert.ok(alpha.overview[0].zh.includes('并非')&&alpha.overview[0].en.includes('not a separate'));
 assert.ok(global.overview[1].zh.includes('不宣称')&&global.overview[1].en.includes('without claiming'));
 for(const name of ['Cognition','General Robotics','SpaceX Global']){
  assert.equal(profiles.find(x=>x.name===name).founded,'—',name);
 }
});
test('company profile remains available when current ATS jobs disappear',()=>{
 const detail=readFileSync(new URL('../src/pages/IndexedCompanyPage.tsx',import.meta.url),'utf8');
 assert.ok(detail.includes("status==='missing'&&!editorial"));
 assert.ok(detail.includes("editorial.founded!=='—'"));
 assert.ok(detail.includes('企业资料仍可独立阅读'));
});
