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
 assert(src.includes('<details>'),'Group relations should be collapsed until requested');
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
 assert(market.includes('<DomesticCompanyResults query={draft}/>'));
});
