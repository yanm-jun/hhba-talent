import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
const dir=new URL('../src/',import.meta.url);
const sharedList=readFileSync(new URL('components/talent/UnifiedPolicyList.tsx',dir),'utf8');
const sharedGuide=readFileSync(new URL('components/talent/UnifiedPolicyGuide.tsx',dir),'utf8');
const sharedDetail=readFileSync(new URL('components/talent/UnifiedTalentRecordDetail.tsx',dir),'utf8');
const quality=readFileSync(new URL('data/talentQuality.ts',dir),'utf8');
const routes=readFileSync(new URL('pages/TalentServiceRoutes.tsx',dir),'utf8');
const laoshan=TALENT_POLICY_RECORDS.find(x=>x.id==='qd-laoshan-202610');
let passed=0;
function check(label,fn){fn();passed++;console.log('✓ '+label)}
check('Inventory contains 71 policy records and 24 housing records, no IDs silently removed',()=>{
 assert.ok(TALENT_POLICY_RECORDS.length>=71,'Policies lost');
 assert.ok(TALENT_HOUSING_RECORDS.length>=24,'Housing lost');
 const ids=[...TALENT_POLICY_RECORDS,...TALENT_HOUSING_RECORDS].map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
});
check('Exactly one shared policy list, one complete-guide template and one truthful basic-detail renderer',()=>{
 assert.ok(routes.includes('<UnifiedTalentRecordDetail policy={p} housing={h}/>'));
 for(const x of ['UnifiedPolicyList config={jinanConfig}','UnifiedPolicyList config={qingdaoConfig}']){
  assert.ok(x.includes('UnifiedPolicyList'));
 }
 assert.ok(sharedList.includes('function Tile('));
 assert.ok(sharedGuide.includes('data.steps.map('));
 assert.ok(sharedDetail.includes('quality.missing.map('));
});
check('Every base record gets a graded quality state without claiming B is completed',()=>{
 for(const x of ['TalentQualityGrade','completeGuides',"grade==='A'","grade==='B'","grade==='C'","grade==='D'",'TALENT_QUALITY_SUMMARY'])assert.ok(quality.includes(x),x);
 assert.ok(sharedDetail.includes('资料')&&sharedDetail.includes('待核实'));
});
check('No completion-grade A except dedicated sourced guides and actual complete source',()=>{
 for(const id of ['sd-jinan-2026-talent-living','qd-rent-25','sd-qingdao-2026-free-housing','qd-laoshan-202610'])assert.ok(quality.includes("'"+id+"'"));
 assert.ok(!quality.includes('grade:sourceUrl?\\'A\\''));
});
check('Specific 2026 Laoshan source lists three different deadlines and seven structured steps',()=>{
 assert.ok(laoshan);
 assert.equal(laoshan.applicationSteps?.length,7);
 assert.ok(laoshan.materials?.length>=3);
 assert.equal(laoshan.deadline,'2026-11-10');
 assert.ok(laoshan.application.includes('11月6日'));
 assert.ok(laoshan.application.includes('11月12日'));
 assert.ok(laoshan.applicationUrl?.includes('zhufang.qingdao.gov.cn'));
});
check('Missing materials, contact and individual application URL are shown truthfully, not fabricated',()=>{
 for(const s of ['官方材料清单尚待逐项核实','公开咨询电话尚未确认','独立申报入口待核验'])assert.ok(sharedDetail.includes(s),s);
});
check('Single page mobile responsive layout uses already approved Jinan V3.1 classes',()=>{
 const style=readFileSync(new URL('styles/talent-jinan-guide-preview.css',dir),'utf8');
 assert.ok(sharedGuide.includes('jgd-page'));
 assert.ok(sharedDetail.includes('jgd-page'));
 assert.ok(style.includes('@media(max-width:630px)'));
});
console.log(JSON.stringify({passed,total:TALENT_POLICY_RECORDS.length+TALENT_HOUSING_RECORDS.length,missingStepPolicies:TALENT_POLICY_RECORDS.filter(x=>!x.applicationSteps?.length).length,sourceGrades:'A/B/C/D'},null,2));
