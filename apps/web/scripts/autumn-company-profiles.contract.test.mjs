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
 assert(entry.source?.startsWith('https://github.com/')||['https://commons.wikimedia.org/wiki/File:KPMG_blue_logo.svg','https://commons.wikimedia.org/wiki/File:Schneider_Electric_2007.svg'].includes(entry.source),'Record public image provenance');
 if(entry.sourceType==='wikimedia_build_import'){
  assert((entry.id==='cn-autumn-001'&&entry.path==='images/autumn-real-logos/cn-autumn-001.svg')||(entry.id==='cn-autumn-002'&&entry.path==='images/autumn-real-logos/cn-autumn-002.svg'),'Only exact source-backed KPMG and Schneider wordmarks may be downloaded in Pages CI');
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
assert(!profile.includes('images/autumn-cover/'),'No placeholder company art');
assert(profile.includes('className="company-profile company-profile-autumn"'),'All 156 use the OpenAI design root');
assert(profile.includes('data-company-template="openai"'),'A shared template is used, not 156 separate page layouts');
assert(profile.includes('company-profile-header')&&profile.includes('company-profile-meta')&&profile.includes('company-profile-editorial'),'Preserve OpenAI identity layout');
assert(profile.includes('company-profile-focus-grid')&&profile.includes('company-profile-milestones'),'Reuse OpenAI business and milestones cards');
assert(profile.includes('company-profile-job-grid')&&profile.includes('company-profile-sources'),'Reuse OpenAI recruiting and sources sections');
assert(profile.includes('company-visual-workplace-grid'),'Use OpenAI two-column photo layout');
assert(profile.includes('aiPhotos.map')&&profile.includes('source_backed_named_enterprise_scene'),'Only exact-company photos are available');
assert(profile.includes('公司办公环境与建筑'),'Keep the approved workplace heading');
assert(!profile.includes('AutumnIndustryReferenceGallery'),'No industry stock gallery anywhere in rendered profile');
assert(!profile.includes('autumn-photo-research'),'No unreviewed reference photos attached to employers');
assert(!profile.includes('websiteCaptures'),'Do not pass off website screenshots as office photography');
assert(!profile.includes('创始人与核心创办团队'),'Never show founders section in domestic autumn profiles');
assert(!profile.includes('hhba-autumn-profile-panel'),'Remove the old nested-panel template');
assert(profile.includes('data-hhba-recruitment-outbound="true"'),'Keep login gate on official outbound recruitment');
assert(profile.includes('data-hhba-non-recruitment-link="true"'),'Public citations remain inspectable');
assert(profile.includes('getDomesticCompanies()')&&profile.includes('getDomesticRecruitment('),'Preserve the existing real data join');
assert(profile.includes('招聘项目的城市不等于每个岗位的城市'),'Never present program locations as exact job locations');
assert(profile.includes('尚不代表已经完成对具体经营主体的官方核验'),'Do not present draft business scope as independently verified');
assert(profile.includes('businessDraftA.entries')&&profile.includes('businessDraftB.entries'),'Load all 156 business drafts');
assert(profile.includes('documentedHistories')&&profile.includes('节点出处'),'Display individually sourced company milestones');
assert(profile.includes('className="company-profile-autumn-photo-pending"'),'Unfinished photos need only a quiet text note, not fake image tiles');
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
