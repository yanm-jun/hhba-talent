import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchEmployersByIndividualRoles,isMajorSearch,matchesJobMajor} from '../src/services/employerJobSearch.mjs';
const ids=Array.from({length:19},(_,i)=>'cn-autumn-'+String(i+12).padStart(3,'0'));
const employers=ids.map(id=>JSON.parse(readFileSync('src/data/employerProfiles/'+id+'.json','utf8')));
const majors=JSON.parse(readFileSync('src/data/officialAcademicMajors.json','utf8')).records.map(r=>r.name);
const search=(q,selectedMajor='')=>searchEmployersByIndividualRoles(employers,q,{selectedMajor,knownMajors:majors});
assert(isMajorSearch('机械',majors),'Mechanical must be treated as professional intent');
assert(isMajorSearch('机械工程',majors),'Mechanical engineering must be treated as professional intent');
assert(isMajorSearch('市场营销',majors),'Other official academic majors must be treated as professional intent');
assert(!isMajorSearch('远景科技集团',majors),'Employer name must remain company intent');

const mechanical=search('机械');
assert(mechanical.length>0,'No mechanical job matches');
for(const {profile,jobs,matchedBy} of mechanical){
 assert.equal(matchedBy,'major');
 assert(jobs.length>0&&jobs.length<=profile.jobs.length);
 for(const job of jobs){
  assert(matchesJobMajor(job,'机械'),'Mechanical search returned unrelated '+profile.name+' / '+job.title);
  assert(profile.jobs.includes(job),'Result must be an existing audited job direction');
 }
}
const envis=employers.find(p=>p.name==='远景科技集团');
assert(envis&&envis.jobs.length===6,'Reference profile should include original six role directions');
const mechanicalEnvision=mechanical.find(r=>r.profile.id===envis.id);
assert(mechanicalEnvision,'Mechanical search must include Envision Group');
assert(mechanicalEnvision.jobs.length>0&&mechanicalEnvision.jobs.length<envis.jobs.length,
 'Mechanical query must NOT show all six Envision roles');
assert(!mechanicalEnvision.jobs.some(j=>/\bIT\b|IT开发/i.test(j.title)),
 'Mechanical query must not leak unrelated IT role');
const company=search('远景科技集团').find(x=>x.profile.id===envis.id);
assert(company&&company.jobs.length===6&&company.matchedBy==='company',
 'Searching full company name should still show all company role directions');
const majorSelection=search('远景科技集团','机械').find(x=>x.profile.id===envis.id);
assert(majorSelection&&majorSelection.jobs.length===mechanicalEnvision.jobs.length,
 'Selecting mechanical profession and searching a company should use the SAME job-level filter');
const postgraduate=search('机械工程');
assert(postgraduate.some(x=>x.profile.id===envis.id),'Postgraduate mechanical engineering missed actual mechanical roles');
const zero=search('机械','会计学');
assert(!zero.some(x=>x.profile.id===envis.id),'Incompatible manual major must not show unrelated company');
for(const [q,name,total] of [
 ['广之旅','广之旅',8],['南方传媒','南方传媒',6]
]){
 const p=search(q).find(x=>x.profile.name===name);
 assert(p&&p.jobs.length===total&&p.matchedBy==='company',
  'Company-name search regression: '+q);
}
const roadBridge=search('中建路桥').find(x=>x.profile.id==='cn-autumn-028');
assert(roadBridge&&roadBridge.jobs.length===12&&roadBridge.matchedBy==='company',
 'Zhongjian Road & Bridge company search must show twelve sourced role directions');
const selectedRoad=search('中建路桥','机械').find(x=>x.profile.id==='cn-autumn-028');
const majorRoad=search('机械').find(x=>x.profile.id==='cn-autumn-028');
assert(selectedRoad&&majorRoad&&selectedRoad.jobs.length===1&&majorRoad.jobs.length===1,
 'Road & Bridge mechanical search should show ONLY its mechanical-equipment position');
assert.equal(majorRoad.jobs[0].id,'mechanical-equipment');
assert(!majorRoad.jobs.some(j=>/财务|法务|行政|施工技术/.test(j.title)));
const power=search('中电建电力集团').find(x=>x.profile.id==='cn-autumn-029');
assert(power&&power.jobs.length===8,'Short power company name should surface 8 actual 2027 roles');
const control=search('自动化').find(x=>x.profile.id==='cn-autumn-029');
assert(control&&control.jobs.length===1&&control.jobs[0].id==='thermal-control',
  'Automation search must show thermal control role, not all 8 power positions');
const computer=search('计算机科学与技术').find(x=>x.profile.id==='cn-autumn-029');
assert(computer&&computer.jobs.length===1&&computer.jobs[0].id==='it-engineer',
 'Computer science should show only the IT engineer');
const electric=search('电气工程及其自动化').find(x=>x.profile.id==='cn-autumn-029');
assert(electric&&electric.jobs.length===1&&electric.jobs[0].id==='thermal-electrical',
 'Electrical engineering must show power electrical position only');
const noInventedMechanical=search('机械').find(x=>x.profile.id==='cn-autumn-029');
assert(!noInventedMechanical,'2027 eight-position list has no explicitly mechanical job; do not infer all power jobs match');
const manuallyFilter=search('中电建电力集团','自动化').find(x=>x.profile.id==='cn-autumn-029');
assert(manuallyFilter&&manuallyFilter.jobs.length===1&&manuallyFilter.jobs[0].id==='thermal-control');
const guoxin=search('江苏省国信集团').find(x=>x.profile.id==='cn-autumn-030');
assert(guoxin&&guoxin.jobs.length===4&&guoxin.matchedBy==='company',
 'JSGX four official recruitment categories must be searchable on main');
const guoxinAi=search('人工智能').find(x=>x.profile.id==='cn-autumn-030');
assert(guoxinAi&&guoxinAi.jobs.length===1&&guoxinAi.jobs[0].id==='trainee-ai',
 'AI major must show only AI trainee direction, not all Guoxin jobs');
assert(!search('机械').some(x=>x.profile.id==='cn-autumn-030'),
 'Group energy business must not fabricate a mechanical job');
assert(search('江苏国信','金融学').find(x=>x.profile.id==='cn-autumn-030')?.jobs[0]?.id==='trainee-finance',
 'Company alias + finance major must show only the finance trainee');
const it=search('IT').find(x=>x.profile.id===envis.id);
assert(it&&it.jobs.length>0&&it.jobs.length<envis.jobs.length,
 'Role-title search should also show only matching individual roles');
const component=readFileSync('src/components/V2EmployerSearchResults.tsx','utf8');
assert(component.includes('searchEmployersByIndividualRoles(employers,query'),'UI must use job-level search results');
assert(component.includes('jobs.map(job=>'),'UI must display filtered jobs, not profile.jobs');
assert(!component.includes('p.jobs.map(job=>'),'Never render all company roles after a major search');
console.log('HHBA_JOB_LEVEL_MAJOR_SEARCH_OK',mechanical.length,'companies',mechanicalEnvision.jobs.length,'of 6 Envision roles');
