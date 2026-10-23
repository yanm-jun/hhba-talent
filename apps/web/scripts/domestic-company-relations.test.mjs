import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const path='public/data/domestic-company-relations.json';
const {relations}=JSON.parse(readFileSync(path,'utf8'));
test('at least 80 evidenced group relationships with unique stable ids',()=>{
 assert(relations.length>=80,'Expected verified multiple group relations');
 assert.equal(new Set(relations.map(r=>r.id)).size,relations.length);
 for(const r of relations){
  assert(r.child&&r.parent&&r.relation&&r.industry&&r.reviewedAt);
  assert(['company','branch','business'].includes(r.kind));
  assert(new URL(r.sourceUrl).protocol==='https:','Never invent or link insecure evidence');
  assert(Array.isArray(r.tags)&&r.tags.length>0);
  if(r.careersUrl)assert.equal(new URL(r.careersUrl).protocol,'https:');
 }
});
test('SAIC and Huayu vision source identity and intermediate parent',()=>{
 const saic=relations.find(r=>r.parent==='上汽集团'&&r.child==='华域汽车');
 const visual=relations.find(r=>r.parent==='华域汽车'&&r.child==='华域视觉科技（上海）有限公司');
 const branch=relations.find(r=>r.parent==='上汽集团'&&r.child==='上汽集团乘用车分公司');
 assert(saic);assert(visual);assert(branch);
 assert.equal(branch.kind,'branch');
 assert(visual.aliases.includes('华域视觉'));
 assert(visual.tags.includes('电气自动化'));
 assert(!relations.some(r=>r.parent===r.child));
});
test('distinguish operating company from business division',()=>{
 assert(relations.some(r=>r.parent==='美的集团'&&r.kind==='business'));
 assert(relations.some(r=>r.parent==='美的集团'&&r.kind==='company'));
 assert(relations.filter(r=>r.parent==='中国中车').length>=40);
});
const src=readFileSync('src/pages/DomesticCompanyPage.tsx','utf8');
test('child cards remain within HHBA before external careers links',()=>{
 assert(src.includes('findRelatedCompanies'));
 assert(src.includes('to={item.route}'));
 assert(src.includes('matchingMajors'));
 assert(src.includes('key={"relations-"+company.id}'),'Group relations must start collapsed for each company route');
 assert(src.includes('/majors/'),'Related majors should be navigable');
 assert(src.includes('getDomesticRecruitment(company.name)'),'Recruitment must be backed by explicit entity registry');
 const reviewed=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
 const hv=reviewed['华域视觉科技（上海）有限公司'];
 assert.equal(hv.careersUrl,'https://hascovision.zhiye.com/social');
 assert(hv.description.length>=3);
 assert(hv.majorSlugs.includes('electrical-engineering'));
 const majorPage=readFileSync('src/pages/MajorCompaniesPage.tsx','utf8');
 assert(majorPage.includes('companiesForMajor'));
 assert(majorPage.includes('company.route'));
 const market=readFileSync('src/components/UnifiedJobMarket.tsx','utf8');
 assert(market.includes('<DomesticCompanyResults query={draft} majorSlug={selectedMajor}'));
});

test('one Chinese character gives enterprise name suggestions, not broad tags',()=>{
 const src=readFileSync('src/services/domesticCompanySearch.ts','utf8');
 const component=readFileSync('src/components/DomesticCompanyResults.tsx','utf8');
 assert(src.includes('const oneCharacter=Array.from(query).length===1'));
 assert(src.includes('if(oneCharacter&&!named)score=0'));
 assert(!component.includes('word.length<2'),'Chinese one-character input must display results');
});
test('no inherited group recruiting portals and verified offices',()=>{
 const src=readFileSync('src/services/domesticCompanySearch.ts','utf8');
 assert(!src.includes('c.careers=r.careersUrl'),'Never assign a parent recruitment URL to a child');
 assert(src.includes('item.careers=record?.url'));
 const data=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
 const hv=data['华域视觉科技（上海）有限公司'];
 const auto=data['华域汽车'];
 const saic=data['上汽集团'];
 assert.equal(hv.careersUrl,'https://hascovision.zhiye.com/social');
 assert.equal(auto.careersUrl,'https://www.hasco-group.com/join/');
 assert.notEqual(hv.careersUrl,auto.careersUrl);
 assert.notEqual(hv.careersUrl,saic.careersUrl);
 assert.equal(hv.officeLocations[0].address,'上海市嘉定区叶城路767号');
 for(const company of [hv,auto,saic]){
  assert(company.description.length>=3);
  assert(company.description.join('').length>=180);
  assert(company.officeLocations.length>=1);
  assert(new URL(company.officialSource).protocol==='https:');
  assert(new URL(company.careersUrl).protocol==='https:');
 }
 const page=readFileSync('src/pages/DomesticCompanyPage.tsx','utf8');
 assert(page.includes('domestic-editorial-photo-grid'));
 assert(page.includes('domestic-office-list'));
});

test('searchable major filter covers broad subjects and connects with company listing',()=>{
 const majors=readFileSync('src/services/domesticMajors.ts','utf8');
 const picker=readFileSync('src/components/MajorFilter.tsx','utf8');
 const market=readFileSync('src/components/UnifiedJobMarket.tsx','utf8');
 const companies=readFileSync('src/components/DomesticCompanyResults.tsx','utf8');
 assert(majors.includes('MAJORS.push(...EXTRA_MAJORS)'));
 assert(majors.includes("'dance'")&&majors.includes("'electrical-engineering'"));
 assert(picker.includes('role="combobox"')&&picker.includes('role="listbox"'));
 assert(picker.includes('onKeyDown={onKey}'));
 assert(market.includes('<MajorFilter value={selectedMajor} onChange={selectMajor} lang={lang}/>'));
 assert(market.includes('majorSlug={selectedMajor}'));
 assert(companies.includes('companyMatchesSelectedMajor(company,chosen.slug)'));
 assert(companies.includes('if(!word&&!chosen)return null'));
});
test('expanded career profiles have authentic image provenance and no asserted live roles',()=>{
 const p=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
 for(const name of ['华域视觉科技（上海）有限公司','华域汽车','上汽集团','汇川技术','中国中车','美的集团','雷赛智能','正泰电器','英威腾','思源电气']){
  assert(p[name],name+' missing');
  assert(p[name].description.length>=3,name+' needs a sourced narrative');
  assert(p[name].description.join('').length>=170,name+' narrative too short');
  assert(p[name].brandImage&&p[name].brandImage.startsWith('https://'),name+' missing verifiable brand image URL');
  assert(p[name].brandImageSource||p[name].imageSource,name+' missing image provenance');
 }
 assert.equal(p['雷赛智能'].careersUrl,'https://www.leisai.com/recruitment/index.html','Employer official social/campus recruiting page independently checked');
 assert.equal(p['英威腾'].careersUrl,'https://www.invt.com.cn/careers','Employer official recruiting page independently checked');
 assert.equal(p['思源电气'].careersUrl,'https://www.sieyuan.com/join');
 assert.equal(p['正泰电器'].careersUrl,'');
});

test('catalog contains sourced 2026 new majors with separate study levels',()=>{
 const u=JSON.parse(readFileSync('src/data/officialAcademicMajors.json','utf8'));
 const v=JSON.parse(readFileSync('src/data/officialVocationalMajors.json','utf8'));
 assert.equal(u.records.filter(x=>x.level==='undergraduate').length,882);
 assert.equal(u.records.filter(x=>x.level==='postgraduate').length,181);
 assert(v.records.length>=80);
 const records=[...u.records,...v.records];
 assert.equal(records.length,new Set(records.map(x=>x.id)).size,'no duplicate id');
 for(const x of records){assert(x.code&&x.name&&x.level&&x.sourceYear);}
 const has=(code,level,name)=>records.some(x=>x.code===code&&x.level===level&&x.name===name);
 assert(has('140012TK','undergraduate','具身智能'));
 assert(has('130205','undergraduate','舞蹈学'));
 assert(has('460306','vocational','电气自动化技术'));
 assert(has('460301','vocational','机电一体化技术'));
 assert(has('0808','postgraduate','电气工程'));
});
test('all selectable majors preserve metadata without pretending employer vacancies exist',()=>{
 const service=readFileSync('src/services/domesticMajors.ts','utf8');
 const picker=readFileSync('src/components/MajorFilter.tsx','utf8');
 assert(service.includes('MAJOR_OPTIONS'));
 assert(service.includes('companyMatchesSelectedMajor'));
 assert(service.includes('if(!canonical)return false'));
 assert(picker.includes('自填专业'));
 assert(picker.includes('role="combobox"'));
 assert(picker.includes('高职专科'));
 assert(picker.includes('专业代码'));
});

test('2026-10 employer batch contains 30 distinctive, source-backed company profiles',()=>{
 const p=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
 const latest=['许继电气','平高电气','国电南瑞','中控技术','拓斯达','埃斯顿','德赛西威','京东方Ａ','歌尔股份','中兴通讯','科大讯飞','潍柴动力','兆易创新','浪潮信息','隆基绿能','晶科能源','亿纬锂能','欣旺达','福耀玻璃','紫光股份','海尔智家','阳光电源','海康机器人','阳光电动力','亿纬氢能','立讯精密','宁德时代','三一重工','海康威视','北方华创'];
 assert.equal(new Set(latest).size,30);
 for(const name of latest){
  const record=p[name];
  assert(record,'No company profile for '+name);
  assert(record.description.length>=3,'Three tailored paragraphs required for '+name);
  assert(record.description.join('').length>=180,'Not enough business background for '+name);
  assert(record.business.length>=3,'Specific products and business lines required for '+name);
  assert(record.majorSlugs.length>=4,'Must have major-to-business tags for '+name);
  assert(record.officialSource.startsWith('https://'),'Public official evidence missing for '+name);
  assert(record.brandImageSource.startsWith('https://'),'Official logo or favicon provenance missing for '+name);
  if(record.careersUrl){
   assert(new URL(record.careersUrl).protocol==='https:');
   assert(!record.careersUrl.includes('saic-recruit'),'Never auto-inherit a group portal');
  }
  for(const office of record.officeLocations){assert(office.address&&office.source.startsWith('https://'))}
 }
 assert.equal(p['海康机器人'].parentName,'海康威视');
 assert.equal(p['阳光电动力'].parentName,'阳光电源');
 assert.equal(p['亿纬氢能'].parentName,'亿纬锂能');
 assert.equal(p['德赛西威'].careersUrl,'https://www.desaysv.com/jobList.html');
 assert.equal(p['宁德时代'].careersUrl,'https://talent.catl.com/social-recruitment/catlhr/96144/');
 assert.equal(p['海康威视'].careersUrl,'https://talent.hikvision.com/');
});
test('new employer profiles seed missing entities and override weak stock-roster summaries',()=>{
 const service=readFileSync('src/services/domesticCompanySearch.ts','utf8');
 const matching=readFileSync('src/services/domesticMajors.ts','utf8');
 const main=readFileSync('src/main.tsx','utf8');
 const result=readFileSync('src/components/DomesticCompanyResults.tsx','utf8');
 assert(service.includes("const id='profile-'"));
 assert(service.includes('if(exact.summary){item.overview=exact.summary;'));
 assert(service.includes("value.normalize('NFKC')"));
 assert(matching.includes('prof?.majorSlugs?.length'));
 assert(main.includes('profile-[a-z0-9-]{8,150}'));
 assert(result.includes('BrandMark'));
 assert(result.includes('有来源的深度介绍'));
 assert(!result.includes("'完整企业介绍'"),'Do not call incomplete photo profiles complete');
});

test('official plant and product assets are tied to correct employer records',()=>{
 const p=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
 const checks={
  '亿纬锂能':{source:'evebattery.com',kinds:['headquarters','office','factory'],min:5},
  '宁德时代':{source:'catl.com',kinds:['headquarters'],min:1},
  '阳光电源':{source:'sungrowpower.com',kinds:['product'],min:1}
 };
 for(const [name,expected] of Object.entries(checks)){
  const x=p[name];assert(x.photos.length>=expected.min,name);
  for(const photo of x.photos){assert(new URL(photo.source).hostname.includes(expected.source));
   assert(expected.kinds.includes(photo.kind));}
 }
 assert.equal(p['宁德时代'].officeLocations[0].source,'https://www.catl.com/contactus/');
 assert.equal(p['阳光电源'].officeLocations[0].source,'https://www.sungrowpower.com/demo/zh/about-us/contact-us');
 for(const x of Object.values(p))assert(x.photoSourcePage?.startsWith('https://'),'Missing source link for company with no ready photo');
 const page=readFileSync('src/pages/DomesticCompanyPage.tsx','utf8');
 assert(page.includes('article?.photoSourcePage&&!hasReadyPhoto?'),'No downloadable image must show verified source link');
});

test('official-logo verified status is limited to evidence-backed brand identity',()=>{
 const p=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
 const verified=Object.entries(p).filter(([,v])=>v.brandAssetStatus==='official_logo_visually_verified');
 for(const [name,v] of verified){
  assert(v.brandIdentityEvidence&&v.brandImageSource&&v.brandVerifiedAt,'Missing logo evidence: '+name);
 }
 assert.equal(p['汇川技术'].brandImageSource,'https://inovance.zhiye.com/Campus');
 const workflow=readFileSync('../../.github/workflows/hhba-ai-enterprise-pages-preview.yml','utf8');
 assert(workflow.includes('node scripts/discover-official-company-media.mjs'));
 const prepare=readFileSync('scripts/prepare-domestic-company-media.mjs','utf8');
 assert(prepare.includes('official_publisher_caption_not_independently_visual_verified'));
});

test('official-site brand candidate discovery never marks a logo human-verified',()=>{
 const file=readFileSync('scripts/discover-official-brand-candidates.mjs','utf8');
 assert(file.includes("p.brandAssetStatus='official_website_logo_candidate'"));
 assert(file.includes("human visual identity review pending"));
 const prep=readFileSync('scripts/prepare-domestic-company-media.mjs','utf8');
 assert(prep.includes('official_site_brand_candidate_not_visually_verified'));
});

test('previously verified local media survives transient official-site outages',()=>{
 const source=readFileSync('scripts/prepare-domestic-company-media.mjs','utf8');
 const workflow=readFileSync('../../.github/workflows/hhba-ai-enterprise-pages-preview.yml','utf8');
 assert(source.includes("function previousMedia(name,kind,idx,url)"));
 assert(source.includes("item.source!==url"),'Cached files must be bound to their original company source URL');
 assert(source.includes("existsSync('public/'+item.path)"));
 assert(source.includes("stats.cacheReused++"));
 assert(workflow.includes("actions/cache/restore@v4"));
 assert(workflow.includes("actions/cache/save@v4"));
});

test('company cards distinguish substantive articles, partial writeups and raw stock identities',()=>{
 const cards=readFileSync('src/components/DomesticCompanyResults.tsx','utf8');
 const page=readFileSync('src/pages/DomesticCompanyPage.tsx','utf8');
 const script=readFileSync('scripts/audit-all-company-content.mjs','utf8');
 assert(cards.includes('有来源的深度介绍'));
 assert(cards.includes('已整理业务内容 · 仍需完善'));
 assert(cards.includes('仅名录信息 · 不冒充深度介绍'));
 assert(page.includes('企业资料（继续完善中）'));
 assert(script.includes("'PARTIAL_PROFILE'"));
 assert(script.includes('partialProfiles:'));
});

test('100-company pilot has no new company identity and source-backed evidence for completed dossiers',()=>{
 const batch=JSON.parse(readFileSync('src/data/domesticCompanyBatch001.json','utf8'));
 const roster=JSON.parse(readFileSync('src/data/domesticListedCompanies.json','utf8'));
 const profiles=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
 assert.equal(batch.rows.length,100);
 const list=new Map(roster.companies.map(c=>[c.name,c.code]));
 for(const row of batch.rows)assert.equal(list.get(row.name),row.stockCode,'Batch must only upgrade existing names');
 const approved=batch.rows.filter(x=>x.isNewProfileThisBatch);
 assert.equal(approved.length,15);
 for(const row of approved){
  const p=profiles[row.name];
  assert(p.officialSource.startsWith('https://'));
  assert(p.description.join('').length>=280);
  assert(p.description.length>=3&&p.business.length>=3&&p.majorSlugs.length>=4);
  const verified=JSON.parse(readFileSync('src/data/domesticRecruitmentRegistry.json','utf8')).entries;
  assert.equal(Boolean(p.careersUrl),Boolean(verified[row.name]),'No unverified recruiting URLs: '+row.name);
 }
});

test('fifty-company dossier target does not conflate industry, majors, recruitment, and real photos',()=>{
 const target=JSON.parse(readFileSync('src/data/domesticComplete50Target.json','utf8'));
 const profile=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
 const careers=JSON.parse(readFileSync('src/data/domesticRecruitmentRegistry.json','utf8')).entries;
 assert.equal(target.companyNames.length,50);
 assert.equal(new Set(target.companyNames).size,50);
 for(const n of target.companyNames){
  assert(profile[n].primaryIndustry&&profile[n].subIndustry, 'Unclassified sector: '+n);
  assert(profile[n].majorMappingBasis.includes('非招聘专业承诺'), 'Major labels must be business-linked not fictitious recruitment');
 }
 for(const name of ['雷赛智能','英威腾','兆易创新','埃斯顿','海康机器人']){
  assert.equal(profile[name].careersUrl,careers[name].url);
  assert(careers[name].evidenceUrl.startsWith('https://'));
 }
 const page=readFileSync('src/pages/DomesticCompanyPage.tsx','utf8');
 assert(page.includes('行业分类：{article.primaryIndustry}'),'Company detail should show validated sector');
});
