import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync('src/'+p,'utf8');
const shared=read('components/CompanyMajorJobs.tsx');
const chips=read('components/CompanyMajorChips.tsx');
const market=read('components/UnifiedJobMarket.tsx');
const autumn=read('pages/AutumnCompanyProfilePage.tsx');
const domestic=read('pages/DomesticCompanyPage.tsx');
const overseas=read('pages/CompanyProfilePage.tsx');
const matcher=read('services/majorJobMatching.ts');
const idx=read('services/domesticRebuildJobs.ts');
const hypergryph=read('pages/HypergryphCompactProfilePage.tsx');
const pages=['Kpmg','Schneider','HuayuVision','HuaanSecurities','GuangfaSecurities','CiticsSecurities','Pfizer','Csair','SfExpress','NeteaseGames','Hypergryph','Anker'];
for(const p of pages){
 const s=read('pages/'+p+'CompactProfilePage.tsx');
 assert(s.includes('<CompanyMajorJobs companyRoute='),p+' did not use the universal major chips');
 assert(s.includes('hhba-kpmg-photo-grid'),p+' media layout unexpectedly changed');
}
for(const s of [shared,autumn,domestic,overseas]){
 assert(s.includes('CompanyMajorChips'), 'Company route missing the shared chip-only filter');
 assert(!s.includes('<MajorFilter'), 'Company route unexpectedly renders the employer major search field');
}
assert(!shared.includes('清除专业')&&!shared.includes('已继承所学专业')&&!shared.includes('hhba-major-view-tabs'),'Redundant search, reset button or inherited banner remains');
assert(!shared.includes('hhba-major-linked-controls'),'Legacy search-field container still rendered');
assert(chips.includes("onClick={()=>onChange(option.slug)}"),'Profession chip must react to click');
assert(chips.includes("onClick={()=>onChange('')}"),'All-major button must reset to full jobs');
assert(chips.includes('matchRoleToMajor(j,x.slug)'), 'Count must come from the same role matcher as market');
assert(chips.includes('companyMajorChoices(jobs,preferredNames,slug)'), 'Every route must generate company-specific choices');
assert(shared.includes('const current=!slug?allJobs:related'),'Changing major must change the visible job cards');
assert(autumn.includes('shownMatched.map(j=>'),'Historical autumn jobs must be filtered by selected major');
assert(overseas.includes('matchedJobs.slice(0,shown)'),'International official roles should only be filtered with source subject metadata');
assert(domestic.includes('该企业尚未进入已审核逐岗资料库'),'No invented jobs for unfinished company profiles');
assert(market.includes('<MajorFilter value={selectedMajor}'),'The main recruitment market MUST retain its professional search');
assert(matcher.includes("return fields.length?'other':'unknown'"),'No unsupported eligibility assumptions');
assert(idx.includes('domesticV2Records.length!==160'),'Preserve 120 existing reviewed Chinese job records');
assert(hypergryph.includes('hypergryph-logo.png')&&hypergryph.includes('hypergryph-reception.png')&&hypergryph.includes('hypergryph-recruitment-art.png'),'Keep 3 original Hypergryph PNG assets');
assert(existsSync('src/styles/major-company-flow.css'),'Shared chip styles missing');
console.log('ALL_COMPANY_CHIP_ONLY_MATCHING_OK',pages.length,'reviewed employers + generic 156, domestic and international templates');
