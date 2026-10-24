import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(p,'utf8');
const json=p=>JSON.parse(load(p));
const target=json('src/data/domesticComplete200Target.json');
const original=json('src/data/domesticComplete100Target.json');
const additions=json('src/data/domesticCompanyExpansion200Profiles.json');
const sourceBacked=json('src/data/domesticCompany200VerifiedEditorial.json').entries;
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
const shared200=load('src/services/domesticCompany200Data.ts');
assert(shared200.includes('domesticCompany200VerifiedEditorial'),'Reviewed enterprise narrative not connected to runtime');
assert.equal(Object.keys(sourceBacked).length,8,'Eight individually source-backed company profiles');
const search=load('src/services/domesticCompanySearch.ts');
const majors=load('src/services/domesticMajors.ts');
const result=load('src/components/DomesticCompanyResults.tsx');
const page=load('src/pages/DomesticCompanyPage.tsx');
for(const [label,source,words] of [
 ['company search',search,['domesticCompany200Data','domesticRecruitment200Registry','profile.primaryIndustry']],
 ['major search',majors,['domesticCompany200Data','allReviewedProfiles','biology']],
 ['result list',result,['domesticComplete200Target','browse200','domesticCompany200Data','domesticMedia200Bundle']],
 ['detail page',page,['domesticCompany200Data','domesticMedia200Bundle','contentReview']]
])for(const w of words)assert(source.includes(w),label+' missing source connection: '+w);
const app=load('src/main.tsx');
const home=load('src/pages/HomePage.tsx');
const nav=load('src/components/Shell.tsx');
const market=load('src/components/UnifiedJobMarket.tsx');
const source=load('src/services/featuredOfficialJobs.ts');
const router=load('src/router.tsx');
const discovery=load('src/pages/Company200PreviewPage.tsx');
assert(app.includes("if(route==='/')return <HomePage user={user}/>"),'Original HHBA homepage must remain at root');
assert(app.includes("if(route==='/companies/discover')return <Company200PreviewPage"),'200-company page must be additive and separately routed');
assert(!app.includes("if(route==='/'&&import.meta.env.VITE_COMPANY200_STATIC_PREVIEW"),'Do not replace market homepage with company-only preview');
assert(home.includes('<UnifiedJobMarket compact/>')&&home.includes('<HomeCompanyMarquee/>'),'Restore official market and original verified brand carousel');
assert(nav.includes('to="/candidate/jobs"')&&nav.includes('to="/companies/discover"'),'Job and company discovery must both be navigable');
assert(market.includes('loadVerifiedFeaturedJobs')&&market.includes('DomesticCompanyResults'),'Official recruitment cards and matched company discovery must coexist');
assert(source.includes("company:'OpenAI'")&&source.includes("company:'Anthropic'")&&source.includes("company:'SpaceX'"),'Keep original three priority employers');
assert(router.includes('domesticDiscoveryRoute'),'New company page must preserve SPA safe return navigation');
assert(discovery.includes('browseDefault'),'200-company page must show all 200 on direct visit');
console.log('HHBA_COMPANY200_INTEGRATION_OK',JSON.stringify({
  all:joined.length,added:100,majorsIncluded:joined.slice(100).filter(n=>additions[n].majorSlugs?.length>=4).length,
  recruitmentWithEvidence:Object.keys(registry).length,sourceBackedEditorial:Object.keys(sourceBacked).length,pathsVerified:4
}));
