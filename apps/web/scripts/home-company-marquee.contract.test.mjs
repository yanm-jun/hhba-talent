import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(join(root,p),'utf8');
const code=read('src/components/HomeCompanyMarquee.tsx');
const css=read('src/styles/home-company-marquee.css');
const home=read('src/pages/HomePage.tsx');
const selected=JSON.parse(read('src/data/domesticComplete200Target.json')).companyNames;
const oldMedia=JSON.parse(read('src/data/domesticMediaBundle.json')).companies;
const newMedia=JSON.parse(read('src/data/domesticMedia200Bundle.json')).companies;
const media={...oldMedia,...newMedia};
const allowed=['logo_identity_checked','user_submitted_logo_pending_identity'];
const ready=selected.flatMap(name=>{
 const logo=media[name]?.brand;
 if(logo?.state!=='ready'||!logo.path||!allowed.includes(logo.classification))return [];
 return [{name,logo}];
});

test('replace ALL fifty ATS-era overseas marquee entries with HHBA domestic company records',()=>{
 assert.equal(selected.length,200,'canonical domestic company list changed');
 assert.ok(ready.length>=17,'there must be source-backed ready local logos');
 assert.equal(new Set(ready.map(x=>x.name)).size,ready.length);
 assert.ok(code.includes("import curated200 from '../data/domesticComplete200Target.json'"));
 assert.ok(code.includes("import originalMedia from '../data/domesticMediaBundle.json'"));
 assert.ok(code.includes("import expandedMedia from '../data/domesticMedia200Bundle.json'"));
 assert.ok(code.includes("import {getDomesticCompanies} from '../services/domesticCompanySearch'"));
 assert.ok(code.includes('const targetNames=curated200.companyNames as string[]'));
 assert.ok(code.includes("company.route.startsWith('/companies/domestic/')"));
 assert.ok(code.includes('logo?.state!==\'ready\''));
 assert.ok(code.includes('brands.length} 家已收录品牌图片的国内企业'));
 assert.ok(code.includes("to=\"/companies/discover\""));
 for(const banned of ['verifiedBrandRecords','encodeEmployerIdentity','verifiedBrandKey',
   'OpenAI','Anthropic','SpaceX','Airtable','Airbnb','https://','fetch(','Math.random','clearbit'])
   assert.ok(!code.includes(banned),'overseas API-era brand code survived: '+banned);
});

test('all ready domestic images are already bundled and mapped to a real member of the domestic roster',()=>{
 const ids=new Set(selected);
 for(const {name,logo} of ready){
  assert.ok(ids.has(name),'brand missing curated roster '+name);
  assert.match(logo.path,/^domestic-media\/[a-z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/i);
  assert.ok(existsSync(join(root,'public',logo.path)),name+' logo file missing '+logo.path);
  assert.ok(!logo.path.startsWith('http'),'no remote image assets');
 }
 const checked=ready.filter(x=>x.logo.classification==='logo_identity_checked');
 const pending=ready.filter(x=>x.logo.classification==='user_submitted_logo_pending_identity');
 assert.ok(checked.length>=15,'logo identity verified list unexpectedly reduced');
 if(pending.length)assert.ok(code.includes('身份仍待核对'));
 assert.ok(code.includes("brand.verified?' 已核对品牌标识':' 已登记品牌图片（待复核）'"));
});

test('clicking each carousel tile opens the matching domestic profile INSIDE HHBA',()=>{
 assert.ok(code.includes('indexedCompanies=new Map(getDomesticCompanies().map(company=>[company.name,company]))'));
 assert.ok(code.includes('name,route:company.route,file:logo.path'));
 assert.ok(code.includes('<Link className="home-company-marquee-link" to={brand.route}'));
 assert.ok(code.includes("title={'查看 HHBA 内的 '+brand.name+' 企业档案'}"));
 assert.ok(code.includes("src={import.meta.env.BASE_URL+brand.file}"));
 assert.ok(code.includes('onError={()=>setBroken(true)}'));
 assert.ok(!code.includes('target="_blank"'));
 assert.ok(!code.includes('<a href='));
 assert.ok(home.includes('<HomeCompanyMarquee/>'));
 assert.ok(home.includes('<UnifiedJobMarket compact/>'));
});

test('preserve exact original marquee size, motion, accessibility, pause, mobile and reduced-motion behavior',()=>{
 assert.ok(code.includes('<BrandRun/>')&&code.includes('<BrandRun clone/>'));
 assert.ok(code.includes("aria-hidden={clone?'true':undefined}"));
 assert.ok(code.includes('tabIndex={clone?-1:0}'));
 for(const s of [
   'animation:hhba-company-marquee-left 115s linear infinite',
   'transform:translateX(-50%)',
   '.home-company-marquee-window:hover .home-company-marquee-track',
   '.home-company-marquee-window:focus-within .home-company-marquee-track',
   'animation-play-state:paused',
   'mask-image:linear-gradient(',
   'max-width:1096px',
   'width:calc(100% - 24px)',
   'width:168px',
   '@media(max-width:720px)',
   '@media(prefers-reduced-motion:reduce)',
   '.home-company-marquee-track{animation:none;will-change:auto}',
   '.home-company-marquee-run.is-copy{display:none}',
   '.home-company-marquee-link:focus-visible'
 ])assert.ok(css.includes(s),'original styling/animation missing: '+s);
 assert.ok(code.includes('不代表正在招聘，也不代表与 HHBA 存在合作'));
});
