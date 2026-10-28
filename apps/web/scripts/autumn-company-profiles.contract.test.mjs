import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const companies=JSON.parse(read('src/data/domesticAutumnScreenshot20261028.json')).entries;
const jobs=JSON.parse(read('src/data/domesticAutumnVerifiedJobs20261028.json')).jobs;
const market=read('src/components/DomesticAutumnMarket.tsx');
const brand=read('src/components/AutumnCompanyBrand.tsx');
const profile=read('src/pages/AutumnCompanyProfilePage.tsx');
const main=read('src/main.tsx');
const router=read('src/router.tsx');
const styles=read('src/styles/domestic-autumn-market.css');
assert.equal(companies.length,156,'All screenshot employers are preserved');
assert.equal(jobs.length,35,'Existing sourced jobs are untouched');
assert.equal(new Set(companies.map(c=>c.id)).size,156,'Employer paths must be unique');
assert(companies.every(c=>/^cn-autumn-[0-9]{3}$/.test(c.id)),'Company IDs must match the route');
assert(jobs.every(j=>companies.some(c=>c.name===j.company)),'Each job must have an onsite profile');
assert(market.includes("to={'/companies/autumn/'+employer!.id}"),'Job-card name+brand must link to profile');
assert(market.includes("to={'/companies/autumn/'+e.id}"),'Every screenshot employer must link to profile');
assert(brand.includes("logo?.state==='ready'")&&brand.includes('logo.path'),'Only existing ready local images can be used');
assert(brand.includes('非企业官方Logo'),'Never misrepresent a generated nameplate as an official trademark');
assert(!brand.includes('http://')&&!brand.includes('https://'),'No hotlinked photo/logo substitutions');
assert(profile.includes('getDomesticCompanies()')&&profile.includes('domesticProfiles'),'Reuse existing genuine employer files');
assert(profile.includes('getDomesticRecruitment('),'Reuse existing source-reviewed recruiting portals');
assert(profile.includes('data-hhba-recruitment-outbound="true"'),'Recruitment URL requires existing auth guard');
assert(profile.includes('data-hhba-non-recruitment-link="true"'),'Evidence is not confused with application entry');
assert(profile.includes('招聘项目的城市不等于每个岗位的城市'),'Prevent program-wide city conflation');
assert(profile.includes('尚未完成独立核实'),'No fabricated company biography');
assert(main.includes("if(/^\\/companies\\/autumn\\/cn-autumn-[0-9]{3}$/.test(route))return <AutumnCompanyProfilePage"),'SPA profile route must resolve');
assert(router.includes("autumn\\/cn-autumn-[0-9]{3}"),'Profile navigation must preserve safe return state');
assert(styles.includes('.hhba-autumn-profile-hero')&&styles.includes('.hhba-autumn-company-index-link'),'Profile and identity links styled');

const evidence=JSON.parse(read('src/data/domesticAutumnOfficialEvidence20261028.json')).entries;
assert.equal(Object.values(evidence).filter(e=>e.intro&&e.source).length,8,'Evidence backed employer introductions');
for(const [name,entry] of Object.entries(evidence)){
 assert(companies.some(c=>c.name===name),'Evidence cannot belong to an absent company: '+name);
 if(entry.intro)assert(entry.source?.startsWith('https://'),'No unattributed company introductions');
 if(entry.officialRecruitment)assert(entry.officialRecruitment.startsWith('https://'),'No insecure recruiting entry');
}
const allIds=new Set(companies.map(c=>c.id));
for(const c of companies){
 const path='/companies/autumn/'+c.id;
 assert(/^\\/companies\\/autumn\\/cn-autumn-[0-9]{3}$/.test(path),'Every employer must resolve in SPA: '+c.name);
 assert(allIds.has(c.id),'Every employer must retain a unique ID: '+c.name);
}
assert(market.includes("directoryStatus==='with_jobs'")&&market.includes('hhba-autumn-row-detail'),'All-company directory must provide explicit details and working status filters');
assert(market.includes('safeUrl(recruitmentLink(e))'),'All known official channels must work from the directory');
assert(profile.includes('officialArticle?.intro'),'Reviewed introductions must be rendered');
assert(profile.includes('localPhotos.map(')&&profile.includes('企业官网页面截图 · 非办公实景'),'Local company images only; never pretend website screenshot is an office photo');
assert(profile.includes('existing?.overview'),'Reuse existing entity-specific business summary rather than empty text');
assert(profile.includes('hhba-autumn-verified-facts'),'Show per-company evidence state');

console.log('AUTUMN_COMPANY_PROFILES_OK',companies.length,jobs.length);
