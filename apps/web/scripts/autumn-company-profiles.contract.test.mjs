import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const companies=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const jobs=JSON.parse(read('src/data/domesticAutumnVerifiedJobs20261028.json')).jobs;
const evidence=JSON.parse(read('src/data/domesticAutumnOfficialEvidence20261028.json')).entries;
const brandRegistry=JSON.parse(read('src/data/domesticAutumnBrandMediaRegistry.json')).entries;
const aiSceneRegistry=JSON.parse(read('src/data/domesticAutumnAiScenes.json')).entries;
const mediaA=JSON.parse(read('src/data/domesticMediaBundle.json')).companies;
const mediaB=JSON.parse(read('src/data/domesticMedia200Bundle.json')).companies;
const market=read('src/components/DomesticAutumnMarket.tsx');
const brand=read('src/components/AutumnCompanyBrand.tsx');
const cover=read('src/components/AutumnCompanyCover.tsx');
const profile=read('src/pages/AutumnCompanyProfilePage.tsx');
const main=read('src/main.tsx'),router=read('src/router.tsx');

assert.equal(companies.length,156,'Preserve every distinct screenshot enterprise');
assert.equal(jobs.length,35,'Do not alter existing historical job data');
assert.equal(new Set(companies.map(x=>x.id)).size,156,'All employer routes must be unique');
assert(jobs.every(x=>companies.some(e=>e.name===x.company)),'Every listed job must have a profile');
assert(market.includes("to={'/companies/autumn/'+employer!.id}"),'Every job company name must link to a profile');
assert(market.includes("to={'/companies/autumn/'+e.id}"),'Every directory company must link to a profile');
assert(main.includes("if(/^\\/companies\\/autumn\\/cn-autumn-[0-9]{3}$/.test(route))return <AutumnCompanyProfilePage"));
assert(router.includes("autumn\\/cn-autumn-[0-9]{3}"));

assert.equal(Object.keys(brandRegistry).length,27,'27 provenance-tracked employer brand assets');
for(const [name,entry] of Object.entries(brandRegistry)){
 const match=companies.find(x=>x.name===name);
 assert(match,'Logo must map to exact screenshot enterprise '+name);
 assert(entry.id===match.id,'No mismatched company logo');
 assert(new RegExp('^images/autumn-real-logos/'+match.id+'\\.(svg|jpg|jpeg|png|webp)$').test(entry.path),'No unsafe or invented image paths');
 assert(entry.source?.startsWith('https://github.com/')||entry.source==='https://commons.wikimedia.org/wiki/File:KPMG_blue_logo.svg','Record public image provenance');
 if(entry.sourceType==='wikimedia_build_import'){
  assert(entry.id==='cn-autumn-001'&&entry.path==='images/autumn-real-logos/cn-autumn-001.svg','Only exact source-backed KPMG logo may be downloaded in Pages CI');
  continue;
 }
 const local='public/'+entry.path;
 assert(existsSync(local),'Brand file must be local: '+local);
 if(entry.path.endsWith('.svg')){
  const text=read(local);
  assert(text.includes('<svg')&&(text.includes('viewBox')||(/width=/.test(text)&&/height=/.test(text))),'Valid vector logo '+local);
  assert(!/<script|<foreignObject|onload\\s*=|onerror\\s*=/i.test(text),'No unsafe SVG '+local);
 }else if(entry.path.endsWith('.jpg')){
  const buf=readFileSync(local);
  assert(buf[0]===0xff&&buf[1]===0xd8,'Valid JPEG logo '+local);
 }
}
assert(brand.includes('domesticAutumnBrandMediaRegistry.json')&&brand.includes('images/autumn-real-logos/'));
assert(!brand.includes('images/autumn-brand/'),'Never show invented HHBA graphic as company logo');
assert(brand.includes('企业Logo待核验'),'Unconfirmed companies must have honest neutral placeholder');
assert(!brand.includes('http://')&&!brand.includes('https://'),'Brand is always locally hosted');
assert(cover.includes("photo.classification==='source_backed_named_enterprise_scene'"),'Hero photos require actual source-backed workplace identity');
assert(cover.includes('if(!real?.path&&!ai)return null'),'No banner unless a real photo or correctly labeled AI image exists');
assert(!cover.includes('images/autumn-cover/'),'Never use faux green illustrations in photo slots');
assert(market.includes('AutumnCompanyCover name={job.company}')&&market.includes('AutumnCompanyCover name={e.name}'));
assert(!market.includes('images/autumn-cover/'),'Job market must not reference generated faux art');
assert(!profile.includes('images/autumn-cover/'),'Profile must not display generated faux company art');
assert(profile.includes("photo.classification==='source_backed_named_enterprise_scene'"),'Real workplace gallery requires verifiable scene');
assert(profile.includes('websiteCaptures.length>0'),'Existing website screenshots preserved separately');
assert(profile.includes('aiPhotos.length>0')&&profile.includes('画面中的建筑'),'AI concept gallery must state that architecture may be invented');
assert(profile.includes('不是办公实景')&&profile.includes('非企业实景'),'Website captures must not pretend to be real office photos');
assert(profile.includes('data-hhba-recruitment-outbound="true"'),'Keep external recruiting login gate');
assert(profile.includes('getDomesticCompanies()')&&profile.includes('getDomesticRecruitment('),'Reuse existing business/recruitment information');
assert(profile.includes('招聘项目的城市不等于每个岗位的城市'),'Never confuse program-wide locations with job locations');
assert(profile.includes('尚未完成独立核实'),'No fabricated company biographies');
assert(Object.values(evidence).filter(x=>x.intro&&x.source).length===10,'Retain source-backed company introductions');
const media={...mediaA,...mediaB};
const scenes=companies.flatMap(e=>(media[e.name]?.photos||[]).filter(p=>p.state==='ready'&&p.classification==='source_backed_named_enterprise_scene'));
const captures=companies.flatMap(e=>(media[e.name]?.photos||[]).filter(p=>p.state==='ready'&&p.classification==='official_website_screenshot_unreviewed'));
assert.equal(captures.length,4,'Preserve four source-labeled website captures separately');
for(const e of companies){
 assert(/^cn-autumn-[0-9]{3}$/.test(e.id),'Every screenshot entry uses a valid profile path');
 assert(!existsSync('public/images/autumn-brand/'+e.id+'.svg'),'Remove false logo artwork from published assets');
 assert(!existsSync('public/images/autumn-cover/'+e.id+'.svg'),'Remove false building/cover art from published assets');
}
for(const [employerId,photos] of Object.entries(aiSceneRegistry)){
 assert(companies.some(e=>e.id===employerId),'Every AI scene must map to an exact company');
 for(const item of photos){
  assert(item.kind==='ai_generated_concept_scene'&&item.status==='published_preview');
  assert(item.path.startsWith('images/autumn-ai-scenes/'+employerId+'-'));
  assert(item.alt.includes('非真实')||item.alt.includes('非企业实景')||item.alt.includes('非真实青岛银行总部'));
  assert(item.sourceLabel.includes('AI')&&item.sourceLabel.includes('非'));
  const local='public/'+item.path;
  assert(existsSync(local),'AI scene file must be separate and actually uploaded: '+local);
  const bytes=readFileSync(local);
  const validWebp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  const validAvif=bytes.length>15000&&bytes.subarray(4,12).toString()==='ftypavif';
  assert(validWebp||validAvif,'AI asset must be a real independent WebP/AVIF image');
 }
}
console.log('AUTUMN_BRAND_EVIDENCE_CONTRACT_OK',JSON.stringify({companies:companies.length,logos:Object.keys(brandRegistry).length,aiSceneCompanies:Object.keys(aiSceneRegistry).length,websiteCaptures:captures.length,scenePhotos:scenes.length}));
