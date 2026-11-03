import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync('src/'+path,'utf8');
const market=read('components/UnifiedJobMarket.tsx');
const recruitment=read('services/liveRecruitment.ts');
const major=read('services/majorJobMatching.ts');
const css=read('styles/unified-jobs.css');

assert(!market.includes('MajorEmployerRecommendations'),'No company-first professional recommendations');
assert(market.includes('与「{majorName(selectedMajor)}」匹配的招聘岗位'),'Selecting a major shows role results');
assert(market.includes('hhba-major-role-summary'),'Visible role heading should replace employer heading');
assert(market.includes('majorSlug={selectedMajor}'),'Each actual job card includes professional match status');
assert(market.includes("const detail='/candidate/jobs/'+encodeURIComponent(job.id)")&&
  market.includes('<Link to={detail}'),'Primary action leads directly to on-site job detail');

for(const term of [
 '!selectedMajor&&<V2EmployerSearchResults',
 '!selectedMajor&&!rebuilding&&!curatedHundred&&<DomesticAutumnMarket',
 '!selectedMajor&&!rebuilding&&!curatedHundred&&<DomesticCompanyResults',
 '!selectedMajor&&!showInlineDiscoveryEntry'
])assert(market.includes(term),'Company-first section still shown when major selected: '+term);

assert(recruitment.includes('visibleRoleForMajor(job,f.major_slug,f.include_unknown_majors===true)'),
 'Match actual roles and never auto-include major-undisclosed jobs');
assert(major.includes("return fields.length?'other':'unknown'"),
 'Missing/other declared requirements must not be treated as verified');
assert(recruitment.includes('priority={related:3,unrestricted:2,unknown:1,other:0,all:0}'),
 'Rank related, explicitly unrestricted and optional unknown in that order');
const domesticMarket=recruitment.slice(recruitment.indexOf('export async function listDomesticRebuildMarket'));
const filterPos=domesticMarket.indexOf('const allowed=combined.filter(');
const sortPos=domesticMarket.indexOf('allowed.sort((a,b)=>priority[');
const paginationPos=domesticMarket.indexOf('return {jobs:allowed.slice(offset,offset+30)');
assert(filterPos>=0&&sortPos>filterPos&&paginationPos>sortPos,'Rank before pagination after filtering');
assert(market.includes('当前没有符合该专业及其他筛选条件的已收录岗位'),'Zero verified roles must show a truthful empty state');
assert(css.includes('.hhba-major-role-summary'),'Retain existing HHBA color and card styling');
assert(css.includes('.hhba-role-major-status-unknown'),'Unknown requirements must be visibly flagged');
console.log('HHBA_MAJOR_TO_DIRECT_ROLE_CONTRACT_OK');
