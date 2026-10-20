import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const code=read('../src/components/HomeCompanyMarquee.tsx');
const css=read('../src/styles/home-company-marquee.css');
const registry=JSON.parse(read('../src/data/verifiedBrandAssets.json'));
const origins=JSON.parse(read('../public/brands/PROVENANCE.json'));
const home=read('../src/pages/HomePage.tsx');
const service=read('../src/services/verifiedBrandRegistry.ts');
const companyPaths=read('../src/services/companyDirectory.ts');
const sources=new Set(origins.records.map(p=>p.file));

test('home logo marquee uses one authoritative collection of exactly 50 verified brands',()=>{
 assert.equal(registry.records.length,50);
 assert.equal(new Set(registry.records.map(x=>JSON.stringify([x.company,x.platform,x.source]))).size,50);
 assert.ok(code.includes('verifiedBrandRecords()'));
 assert.ok(service.includes('return [...registry.values()]'));
 assert.ok(code.includes('filter(item=>!!encodeEmployerIdentity(item))'));
 assert.ok(!code.includes('clearbit')&&!code.includes('simpleicons.org')&&!code.includes('Math.random'));
 for(const item of registry.records){
  assert.ok(sources.has(item.file),item.company+' missing source record');
  const entry=origins.records.find(p=>p.file===item.file);
  const bytes=readFileSync(new URL('../public/brands/'+item.file,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,item.file+' original bytes changed');
 }
});

test('clickable company identities preserve all three curated profiles and source-scoped dynamic routes',()=>{
 for(const marker of ['verifiedBrandKey(item)',"'/companies/'+known", "'/companies/id/'+encodeEmployerIdentity(item)"])
  assert.ok(code.includes(marker),'missing identity route: '+marker);
 assert.ok(companyPaths.includes('encodeEmployerIdentity(identity)'));
 assert.ok(code.includes('<Link className="home-company-marquee-link" to={brand.route}'));
 assert.ok(home.includes('<UnifiedJobMarket compact/><HomeCompanyMarquee/></Shell>'));
 assert.ok(home.includes('title="我要应聘"')&&home.includes('title="我要招人"'));
 assert.ok(home.includes('navigate("/candidate/match")'));
});

test('animated track is genuinely seamless, duplicates hidden from screen readers and links focusable',()=>{
 assert.ok(code.includes('<BrandRun/>')&&code.includes('<BrandRun clone/>'));
 assert.ok(code.includes('aria-hidden={clone?\'true\':undefined}'));
 assert.ok(code.includes('tabIndex={clone?-1:0}'));
 assert.ok(css.includes('animation:hhba-company-marquee-left 115s linear infinite'));
 assert.ok(css.includes('transform:translateX(-50%)'));
 assert.ok(css.includes('.home-company-marquee-window:hover .home-company-marquee-track'));
 assert.ok(css.includes('.home-company-marquee-window:focus-within .home-company-marquee-track'));
 assert.ok(css.includes('animation-play-state:paused'));
 assert.ok(css.includes('mask-image:linear-gradient('));
});

test('marquee is responsive and honors reduced-motion without hiding company access',()=>{
 assert.ok(css.includes('@media(max-width:720px)'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(css.includes('.home-company-marquee-track{animation:none;will-change:auto}'));
 assert.ok(css.includes('.home-company-marquee-run.is-copy{display:none}'));
 assert.ok(css.includes('overflow-x:auto'));
 assert.ok(css.includes('.home-company-marquee-link:focus-visible'));
 assert.ok(code.includes('onError={()=>setBroken(true)}'));
 assert.ok(code.includes('品牌信息来自公开招聘来源及品牌资料，不代表相关企业与 HHBA 存在招聘合作。'));
 assert.ok(!code.includes('合作企业'));
});

test('brand strip sits immediately after compact homepage market, aligned to same content edges',()=>{
 assert.ok(css.includes('max-width:1096px'));
 assert.ok(css.includes('width:calc(100% - 24px)'));
 assert.ok(css.includes('.home-match-promo ~ .unified-market{margin-bottom:29px}'));
 assert.ok(!read('../src/pages/CompanyDirectoryPage.tsx').includes('HomeCompanyMarquee'));
});
