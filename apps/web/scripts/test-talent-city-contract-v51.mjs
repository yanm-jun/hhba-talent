import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_HOUSING_RESEARCH_LEADS} from '../src/data/talentHousingResearch.ts';
import {CERTIFIED_TALENT_GUIDES,CERTIFIED_TALENT_HOUSING_GUIDES,ACCEPTED_TALENT_CITIES,talentSourceKind,assessPolicy,assessHousing,assessTalentCity} from '../src/data/talentQuality.ts';

const base=JSON.parse(readFileSync(new URL('../src/data/talentBaselineIds.json',import.meta.url),'utf8'));
const pages=new URL('../src/pages/',import.meta.url);
const code=(file)=>readFileSync(new URL(file,pages),'utf8');
const shared=(name)=>readFileSync(new URL('../src/components/talent/'+name,import.meta.url),'utf8');
let passed=0;
function check(label,fn){fn();passed++;console.log('✓ '+label)}
function count(block,needle){return block.split(needle).length-1}
const recognized={
 'sd-jinan-2026-talent-living':{file:'TalentJinanGuidePreview.tsx',start:'const steps:Step[]=[',stop:'const checks=',branches:["senior:","doctor:","master:"],route:"fragments[2]==='jinan'",source:'OFFICIAL.process'},
 'qd-rent-25':{file:'TalentQingdaoGuidePreview.tsx',start:'const housing:Guide={',stop:'const stay:Guide={',branches:["bachelor:","master:","doctor:"],route:"fragments[3]==='stay'?'stay':'housing'",source:"officialUrl:'https://rc.qingdao.gov.cn/'"},
 'sd-qingdao-2026-free-housing':{file:'TalentQingdaoGuidePreview.tsx',start:'const stay:Guide={',stop:'function mappedGuide(',branches:["search:","employed:"],route:"fragments[3]==='stay'?'stay':'housing'",source:"青岛市免租金住宿保障平台"},
 'qd-laoshan-202610':{file:'TalentLaoshanGuide.tsx',start:'const data:CompleteGuide={',stop:'export function TalentLaoshanGuide(',branches:["fulltime:","graduates:","flexible:"],route:"fragments[3]==='laoshan'",source:'https://zhufang.qingdao.gov.cn/rczf/'}
};
const routes=code('TalentServiceRoutes.tsx');
check('The 95 known record IDs are never silently lost or duplicated',()=>{
 const p=new Set(TALENT_POLICY_RECORDS.map(r=>r.id)),h=new Set(TALENT_HOUSING_RECORDS.map(r=>r.id));
 assert.equal(p.size,TALENT_POLICY_RECORDS.length);assert.equal(h.size,TALENT_HOUSING_RECORDS.length);
 for(const id of base.policyIds)assert.ok(p.has(id),'Deleted policy ID: '+id);
 for(const id of base.housingIds)assert.ok(h.has(id),'Deleted housing ID: '+id);
 assert.equal(base.policyIds.length,71);assert.equal(base.housingIds.length,24);
});
check('Every certified A guide has actual detailed steps, branches and a live route',()=>{
 for(const [id,cert] of Object.entries(CERTIFIED_TALENT_GUIDES)){
  const r=TALENT_POLICY_RECORDS.find(x=>x.id===id),spec=recognized[id];
  assert.ok(r&&spec,'Missing certification source: '+id);
  assert.equal(r.city,cert.city);
  assert.equal(assessPolicy(r,'2026-10-30').grade,'A','Certified A not actually classified A: '+id);
  assert.ok(cert.evidenceUrls.length>0&&cert.evidenceUrls.every(url=>talentSourceKind(url)==='government'),id+' government evidence');
  assert.ok(routes.includes(spec.route),id+' URL route missing');
  const page=code(spec.file),start=page.indexOf(spec.start),end=page.indexOf(spec.stop,start);
  assert.ok(start>=0&&end>start,id+' guide data section missing');
  const body=page.slice(start,end);
  assert.equal(count(body,'why:'),cert.stepCount,id+' why steps');
  assert.equal(count(body,'action:'),cert.stepCount,id+' action steps');
  assert.equal(count(body,'done:'),cert.stepCount,id+' completion steps');
  assert.equal(spec.branches.length,cert.branchCount);
  for(const branch of spec.branches)assert.ok(page.includes(branch),id+' missing '+branch);
  assert.ok(page.includes(spec.source),id+' no official portal');
  const faqStart=page.indexOf(id==='sd-jinan-2026-talent-living'?'const questions=[':'faq:[',start);
  const faqStop=page.indexOf(id==='sd-jinan-2026-talent-living'?'const districts=':'sources:[',faqStart);
  assert.ok(faqStart>=start&&faqStop>faqStart,id+' missing FAQ section');
  const faqText=page.slice(faqStart,faqStop);
  assert.equal(count(faqText,"['"),cert.faqCount,id+' actual FAQ count mismatches certification');
  for(const evidence of cert.evidenceUrls)assert.ok(page.includes(evidence),id+' listed government evidence not present in actual guide');

 }
 assert.deepEqual(Object.keys(CERTIFIED_TALENT_HOUSING_GUIDES),[]);
});
check('A is not granted by adding four generic steps, a government URL or an arbitrary ID',()=>{
 const r=TALENT_POLICY_RECORDS.find(x=>x.id==='qd-home-25');
 assert.ok(r);
 const fake={...r,id:'new-city-no-independent-guide',city:'烟台',applicationSteps:['1','2','3','4'],materials:['1','2'],applicationUrl:'https://www.yantai.gov.cn/'};
 assert.equal(assessPolicy(fake,'2026-10-30').grade,'B');
 const old={...r,id:'new-expired-guide',temporal:'policy',deadline:'2026-01-01'};
 assert.equal(assessPolicy(old,'2026-10-30').grade,'C');
 assert.equal(assessPolicy({...fake,sourceUrl:'https://example.com/test'},'2026-10-30').grade,'D');
});
check('Primary government evidence must be distinguished from media and other reprints',()=>{
 assert.equal(talentSourceKind('https://hrss.qingdao.gov.cn/index.html'),'government');
 assert.equal(talentSourceKind('https://liaocheng.sdnews.com.cn/latest'),'secondary');
 assert.equal(talentSourceKind('https://example.com/report'),'unverified');
 assert.equal(talentSourceKind('http://www.qingdao.gov.cn/'),'unverified');
});
check('All cities use shared list/guide/details; city data may differ, JSX shell may not',()=>{
 for(const file of ['UnifiedPolicyList.tsx','UnifiedPolicyGuide.tsx','UnifiedTalentRecordDetail.tsx'])assert.ok(shared(file).includes('export function'));
 assert.ok(routes.includes('buildCityPolicyConfig(city)'));
 assert.ok(routes.includes('<UnifiedTalentRecordDetail policy={p} housing={h}/>'));
 const allowed=new Set(['TalentJinanPolicyPreview.tsx','TalentQingdaoPolicyPreview.tsx','TalentJinanGuidePreview.tsx','TalentQingdaoGuidePreview.tsx','TalentLaoshanGuide.tsx']);
 const candidates=readdirSync(pages).filter(name=>/^Talent[A-Z].*(PolicyPreview|GuidePreview|LaoshanGuide)\.tsx$/.test(name));
 for(const name of candidates){assert.ok(allowed.has(name),'New city-specific page forbidden; add only data to shared template: '+name);assert.ok(!code(name).includes('<main '),'Duplicate whole-page layout: '+name)}
});
check('New policy records must meet strict evidence and detailed application fields',()=>{
 const known=new Set(base.policyIds);
 for(const p of TALENT_POLICY_RECORDS.filter(x=>!known.has(x.id))){
  assert.equal(talentSourceKind(p.sourceUrl),'government',p.id+' needs direct government source');
  assert.ok(p.title&&p.summary&&p.benefit&&p.eligibility&&p.application,p.id+' incomplete overview');
  assert.ok(p.targetGroup&&p.reviewNote&&p.reviewedAt,p.id+' needs caveats and review metadata');
  assert.ok(p.materials?.length>=3,p.id+' lacks materials');
  assert.ok(p.applicationSteps?.length>=4,p.id+' lacks application steps');
  assert.ok(new Set(p.applicationSteps).size===p.applicationSteps.length,p.id+' repeated steps');
  assert.ok(p.applicationUrl||/办理入口(暂未公布|待核实|未核验|以.*为准)/.test(p.reviewNote),p.id+' real portal or explicit caveat needed');
 }
});
check('New housing records require independent qualification, steps and vacancy caveats',()=>{
 const known=new Set(base.housingIds);
 for(const h of TALENT_HOUSING_RECORDS.filter(x=>!known.has(x.id))){
  assert.equal(talentSourceKind(h.sourceUrl),'government',h.id+' direct source');
  assert.ok(h.eligibility&&h.units&&h.rent&&h.statusNote&&h.address,h.id+' housing details');
  assert.ok(h.steps?.length>=4,h.id+' missing procedure');
  assert.ok(/(不等于|非实时|具体|以.*为准|已截止|无实时|待核实)/.test(h.statusNote),h.id+' must not claim real-time inventory');
  assert.ok(h.applyUrl||/申报(入口|渠道).*?(未公开|待核|未公布)/.test(h.statusNote),h.id+' channel must be traceable');
 }
});
check('City acceptance cannot be claimed while any current policy remains incomplete',()=>{
 for(const city of ACCEPTED_TALENT_CITIES){
  const m=assessTalentCity(city,'2026-10-30');
  assert.ok(m.accepted,city+' marked complete without every nonhistoric record being A');
 }
 assert.equal(assessTalentCity('济南','2026-10-30').accepted,false);
 assert.equal(assessTalentCity('青岛','2026-10-30').accepted,false);
});
check('Historical policies are downgraded automatically, not stuck at a fixed 2026 date',()=>{
 const r=TALENT_POLICY_RECORDS.find(x=>x.id==='qd-laoshan-202610');assert.ok(r);
 assert.equal(assessPolicy(r,'2026-10-30').grade,'A');
 assert.equal(assessPolicy(r,'2026-11-11').grade,'C');
});
check('Weihai 2026 official housing evidence and historic youth batch obey V5.1',()=>{
 const rental=TALENT_POLICY_RECORDS.find(p=>p.id==='wh-rent-26');
 assert.ok(rental&&rental.city==='威海'&&rental.sourceUrl.includes('/2026/7/29/'));
 assert.ok(rental.materials?.length>=3&&rental.applicationSteps?.length>=4);
 assert.equal(assessPolicy(rental,'2026-10-30').grade,'B');
 const district=TALENT_POLICY_RECORDS.find(p=>p.id==='wh-jingqu-talent-apartment-2026');
 assert.ok(district&&district.city==='威海'&&district.scope==='特定区域'&&district.applicationSteps?.length>=4);
 const old=TALENT_POLICY_RECORDS.find(p=>p.id==='sd-weihai-youth-2025');
 assert.ok(old&&old.deadline==='2025-12-19');
 assert.equal(assessPolicy(old,'2026-10-30').grade,'C');
 for(const id of ['wh-zhonghan-youth-2026','wh-shanwei-xuefu-2026']){
  const home=TALENT_HOUSING_RECORDS.find(h=>h.id===id);
  assert.ok(home&&home.city==='威海'&&home.kind==='project'&&home.steps.length>=4&&home.contactPhone);
  assert.equal(assessHousing(home,'2026-10-30').grade,'B');
 }
});
check('Rizhao research housing remains separate from official verified inventory',()=>{
 const leads=TALENT_HOUSING_RESEARCH_LEADS.filter(x=>x.city==='日照');
 assert.ok(leads.length>=3,'missing Rizhao housing projects research');
 assert.equal(TALENT_HOUSING_RECORDS.filter(x=>x.city==='日照').length,0,'unverified leads must not be automatically promoted');
 for(const x of leads){
  assert.ok(x.title&&x.address&&x.statusNote&&x.eligibility);
  assert.ok(x.steps.length>=4);
  assert.notEqual(talentSourceKind(x.sourceUrl),'government','sources remain labeled as reprints');
  assert.ok(!TALENT_HOUSING_RECORDS.some(y=>y.id===x.id),'unverified lead must not be a verified housing record');
 }
 const policy=TALENT_POLICY_RECORDS.find(x=>x.id==='rz-rent-buy-26');
 const youth=TALENT_POLICY_RECORDS.find(x=>x.id==='sd-rizhao-youth-2026');
 assert.ok(policy?.applicationSteps?.length>=4&&policy?.materials?.length>=3);
 assert.ok(youth?.applicationSteps?.length>=4&&youth?.materials?.length>=3);
 assert.equal(policy.payoutTo,'住房折扣');
 assert.notEqual(assessPolicy(policy,'2026-10-30').grade,'A');
 assert.notEqual(assessPolicy(youth,'2026-10-30').grade,'A');
 assert.ok(routes.includes('<UnifiedTalentHousingResearch city={city} query={query}/>'));
});
console.log(JSON.stringify({passed,baseline:base.policyIds.length+base.housingIds.length,certified:Object.keys(CERTIFIED_TALENT_GUIDES).length,acceptedCities:ACCEPTED_TALENT_CITIES.length},null,2));
