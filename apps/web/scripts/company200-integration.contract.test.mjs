import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(p,'utf8');
const json=p=>JSON.parse(load(p));
const target=json('src/data/domesticComplete200Target.json');
const original=json('src/data/domesticComplete100Target.json');
const additions=json('src/data/domesticCompanyExpansion200Profiles.json');
const registry=json('src/data/domesticRecruitment200Registry.json').entries;
const joined=target.companyNames;
assert.equal(joined.length,200);
assert.deepEqual(joined.slice(0,100),original.companyNames,'The prior 100 must not be displaced');
assert.equal(Object.keys(additions).length,100);
const normalize=s=>s.normalize('NFKC').toLocaleLowerCase().replace(/[\\s·（）()—_-]/g,'');
assert.equal(new Set(joined.map(normalize)).size,200,'Employers must be unique in search');
for(const name of joined.slice(100)){
 const p=additions[name];
 assert(p,'Each target has profile: '+name);
 assert(p.primaryIndustry&&p.primaryIndustry!=='行业待细分','Industry must appear in search card: '+name);
 assert(p.summary.includes(name),'Short description must correspond to employer: '+name);
 assert(p.majorSlugs?.length>=4,'Each employer must link to at least four majors: '+name);
 if(registry[name])assert(registry[name].recruitmentEntity===name,'Recruiter legal/group identity needs disclosure: '+name);
}
const search=load('src/services/domesticCompanySearch.ts');
const majors=load('src/services/domesticMajors.ts');
const result=load('src/components/DomesticCompanyResults.tsx');
const page=load('src/pages/DomesticCompanyPage.tsx');
for(const [label,source,words] of [
 ['company search',search,['domesticCompanyExpansion200Profiles','domesticRecruitment200Registry','profile.primaryIndustry']],
 ['major search',majors,['domesticCompanyExpansion200Profiles','allReviewedProfiles','biology']],
 ['result list',result,['domesticComplete200Target','browse200','domesticCompanyExpansion200Profiles','domesticMedia200Bundle']],
 ['detail page',page,['domesticCompanyExpansion200Profiles','domesticMedia200Bundle','contentReview']]
])for(const w of words)assert(source.includes(w),label+' missing source connection: '+w);
console.log('HHBA_COMPANY200_INTEGRATION_OK',JSON.stringify({
  all:joined.length,added:100,majorsIncluded:joined.slice(100).filter(n=>additions[n].majorSlugs?.length>=4).length,
  recruitmentWithEvidence:Object.keys(registry).length,pathsVerified:4
}));
