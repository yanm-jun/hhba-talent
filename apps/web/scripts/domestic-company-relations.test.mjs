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
 assert(src.includes('article?.careersUrl||company.careers'),'Verified independent portal should override historical inherited portal');
 const reviewed=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
 const hv=reviewed['华域视觉科技（上海）有限公司'];
 assert.equal(hv.careersUrl,'https://www.hascovision.com/join-us');
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
 assert(src.includes('item.careers=clean(exact.careersUrl)'));
 const data=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
 const hv=data['华域视觉科技（上海）有限公司'];
 const auto=data['华域汽车'];
 const saic=data['上汽集团'];
 assert.equal(hv.careersUrl,'https://www.hascovision.com/join-us');
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
 assert.equal(p['雷赛智能'].careersUrl,'https://www.leisai.com/recruitment/index.html');
 assert.equal(p['英威腾'].careersUrl,'https://www.invt.com.cn/careers');
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
