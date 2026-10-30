import assert from 'node:assert/strict';
import {DEFAULT_TALENT_PROFILE,evaluateTalentPolicy,evaluateTalentPolicies} from '../src/data/talentMatchEngine.ts';
const policy=(id,city='北京',overrides={})=>({
 id,city,category:'生活补贴',title:id,summary:'参考',benefit:'以官方为准',
 eligibility:'以官方为准',application:'官方办理',department:'主管单位',sourceName:'公告',
 sourceUrl:'https://example.gov.cn',published:'2026-09-01',temporal:'policy',keywords:[],
 ...overrides
});
const sample=(id,city,changes={})=>evaluateTalentPolicy(policy(id,city),{...DEFAULT_TALENT_PROFILE,city,...changes},'2026-10-30');
let cases=0;
const check=(name,fn)=>{fn();cases++;console.log('✓ '+name)};
check('City-specific records never enter a different city result',()=>{
 const records=[policy('bj-jobseeker-grant','北京'),policy('tj-2027-jobseek-grant','天津')];
 const results=evaluateTalentPolicies(records,{...DEFAULT_TALENT_PROFILE,city:'上海'},'2026-10-30');
 assert.equal(results.length,0);
});
check('Incomplete information remains review—not verified eligible',()=>{
 const r=sample('bj-jobseeker-grant','北京');
 assert.equal(r.status,'review');assert.ok(r.toCheck.length>=2);
});
check('Beijing hardship exclusion when user states no hardship',()=>{
 const r=sample('bj-jobseeker-grant','北京',{grad:'2027',education:'bachelor',hardship:'no'});
 assert.equal(r.status,'excluded');assert.ok(r.reasons.some(x=>x.includes('困难')));
});
check('Beijing hardship applicant can only be prioritised for checking, not approved',()=>{
 const r=sample('bj-jobseeker-grant','北京',{grad:'2027',education:'bachelor',hardship:'yes'});
 assert.equal(r.status,'focus');assert.ok(r.toCheck.some(x=>x.includes('北京地区')));
});
check('Tianjin 2027 cohort explicitly excludes 2026 cohort',()=>{
 assert.equal(sample('tj-2027-jobseek-grant','天津',{grad:'2026',hardship:'yes'}).status,'excluded');
});
check('Tianjin 2027 cohort is only a candidate before its deadline',()=>{
 const r=sample('tj-2027-jobseek-grant','天津',{grad:'2027',hardship:'yes',education:'master'});
 assert.equal(r.status,'focus');
 const later=evaluateTalentPolicy(policy('tj-2027-jobseek-grant','天津',{deadline:'2026-10-31'}),{...DEFAULT_TALENT_PROFILE,city:'天津',grad:'2027',hardship:'yes'},'2026-11-01');
 assert.equal(later.status,'archive');
 assert.ok(later.notes.some(x=>x.includes('2026-10-31')));
});
check('Shanghai first-startup subsidy excludes non-Shanghai hukou',()=>{
 assert.equal(sample('sh-2026-first-startup','上海',{grad:'2026',work:'founder',localHukou:'no'}).status,'excluded');
});
check('Shanghai startup with Shanghai hukou still requires operating proof',()=>{
 const r=sample('sh-2026-first-startup','上海',{grad:'2026',work:'founder',localHukou:'yes'});
 assert.equal(r.status,'focus');assert.ok(r.toCheck.join(' ').includes('经营满1年'));
});
check('Chongqing shortage job age and social-insurance limits are not ignored',()=>{
 assert.equal(sample('cq-2026-shortage-job','重庆',{age:'over35',work:'employed',social:'one-year-plus'}).status,'excluded');
 assert.equal(sample('cq-2026-shortage-job','重庆',{age:'under35',work:'employed',social:'less-year'}).status,'excluded');
});
check('Chongqing special zone is not silently treated as citywide',()=>{
 const p=sample('cq-xinfeng-2026','重庆',{district:'other',education:'master',housingNone:'yes'});
 assert.equal(p.status,'excluded');assert.ok(p.reasons.some(x=>x.includes('重庆高新区')));
});
check('Past Chongqing county application window is historical before ordinary matching',()=>{
 const record=policy('cq-2025-twelve-counties','重庆',{temporal:'historical',deadline:'2025-12-31'});
 const result=evaluateTalentPolicy(record,{...DEFAULT_TALENT_PROFILE,city:'重庆',district:'cq-12counties'},'2026-10-30');
 assert.equal(result.status,'archive');
});
check('Government overview policy is for review, not an award',()=>{
 const r=sample('tj-talent-2025','天津',{education:'master',work:'employed'});
 assert.equal(r.status,'review');
});
check('Matching is stable and always returns only known policies',()=>{
 const records=[policy('bj-flex-insurance','北京'),policy('bj-jobseeker-grant','北京'),policy('tj-grad-business-loan','天津')];
 const result=evaluateTalentPolicies(records,{...DEFAULT_TALENT_PROFILE,city:'北京'},'2026-10-30');
 assert.equal(result.length,2);
 assert.deepEqual(result.map(r=>r.record.id).sort(),['bj-flex-insurance','bj-jobseeker-grant'].sort());
});
console.log(JSON.stringify({testCases:cases,passed:cases,notes:'Offline deterministic tests. No real personal information transmitted.'},null,2));
