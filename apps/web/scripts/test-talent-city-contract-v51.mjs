import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_HOUSING_RESEARCH_LEADS} from '../src/data/talentHousingResearch.ts';
import {LIAOCHENG_POLICY_RECORDS} from '../src/data/liaochengPolicyRecords.ts';
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
check('Housing pages must display real housing-related policies while separating programs from projects',()=>{
 const page=code('TalentServiceRoutes.tsx');
 assert.ok(page.includes("(!housingMode||isHousingPolicy(p))"),'Housing view wrongly excludes all policies');
 assert.ok(page.includes("p.category==='购房补贴'||p.category==='租房安居'"),'Housing categories absent');
 assert.ok(page.includes("housingPrograms=resultHomes.filter(p=>p.kind==='program')"),'Program separation missing');
 assert.ok(page.includes("housingProjects=resultHomes.filter(p=>p.kind==='project')"),'Real project separation missing');
 assert.ok(page.includes('住房政策与保障通道')&&page.includes('已核实独立项目'),'Housing counters mislabelled');
 const policies=TALENT_POLICY_RECORDS.filter(p=>p.city==='潍坊'&&['购房补贴','租房安居'].includes(p.category));
 const homes=TALENT_HOUSING_RECORDS.filter(h=>h.city==='潍坊');
 assert.ok(policies.some(p=>p.id==='wf-home-history'),'Existing Weifang historical purchase policy lost');
 assert.equal(assessPolicy(policies.find(p=>p.id==='wf-home-history'),'2026-10-30').grade,'C','Historical purchase policy must stay historical');
 assert.ok(homes.some(h=>h.id==='wf-citywide-talent-housing-2025'&&h.kind==='program'));
 assert.ok(homes.some(h=>h.id==='wf-municipal-talent-housing-2025'&&h.kind==='program'));
 assert.ok(policies.length+homes.filter(h=>h.kind==='program').length>=3,'Housing page should not show 0 policies / programs');
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
 // Future separately verified Rizhao projects may be added to the official dataset; leads must remain independent.
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
check('City hub prominently counts housing support and unverified apartment references separately',()=>{
 const hub=code('TalentServiceRoutes.tsx');
 const cityIndex=readFileSync(new URL('../src/data/talentCityRegistry.ts',import.meta.url),'utf8');
 assert.ok(hub.includes('const housingPolicies=policies.filter(isHousingPolicy)'), 'city hub must include housing-support policies');
 assert.ok(hub.includes('const housingLeads=housingResearchLeads(match.name)'), 'city hub must load apartment references');
 assert.ok(hub.includes('label="住房支持政策"'), 'main city counter must display housing policy count');
 assert.ok(hub.includes('label="人才公寓线索 · 待核验"') || (hub.includes("researchHousing>0?researchHousing+' 处人才公寓线索（待核验）'") && hub.includes('const housingLeads=housingResearchLeads(match.name)')), 'apartment references must be visibly counted in the city summary');
 assert.ok(hub.includes('人才公寓在哪里？'), 'city hub must show apartment preview with navigation');
 assert.ok(hub.includes("k.id==='policies'?(policies.length+researchPolicyCount)+' 条已收录（含分级资料）'") && hub.includes("researchHousing>0?researchHousing+' 处人才公寓线索（待核验）'"), 'housing card must count both verified and research-only city data');
 assert.ok(cityIndex.includes("name==='日照'"), 'Rizhao description should not incorrectly claim there is no housing information');
 assert.equal(TALENT_HOUSING_RESEARCH_LEADS.filter(x=>x.city==='日照').length,3);
});
check('Zaozhuang V5.1: two detailed policies, truthful pilot program, three housing leads and shared routes',()=>{
 const city='枣庄';
 const p=TALENT_POLICY_RECORDS.filter(x=>x.city===city);
 const employee=p.find(x=>x.id==='sd-zz-job-2026');
 const startup=p.find(x=>x.id==='sd-zaozhuang-2026-first-startup');
 assert.ok(employee&&startup,'Zaozhuang existing 2026 policies must remain');
 for(const item of [employee,startup]){
  assert.ok(item.materials?.length>=3,item.id+' missing material checklist');
  assert.ok(item.applicationSteps?.length>=4,item.id+' missing real-world process');
  assert.ok(item.reviewNote?.includes('办理入口待核实'),item.id+' may not invent online portal');
  assert.notEqual(assessPolicy(item,'2026-10-30').grade,'A','Do not self certify Zaozhuang policy');
 }
 assert.equal(employee.headlineAmount,'¥2,000–5,000');
 const housing=TALENT_HOUSING_RECORDS.filter(x=>x.city===city);
 assert.ok(housing.some(x=>x.id==='zz-talent-home-pilots-202605'&&x.kind==='program'), '2026 pilot home program not connected');
 const pilot=housing.find(x=>x.id==='zz-talent-home-pilots-202605');
 assert.equal(talentSourceKind(pilot.sourceUrl),'government');
 assert.ok(pilot.statusNote.includes('不是个人')||pilot.statusNote.includes('不等于个人'));
 assert.ok(pilot.statusNote.includes('申报入口未公布'));
 assert.ok(pilot.steps.length>=4&&pilot.units.includes('不是人才公寓可租套数'));
 assert.equal(assessHousing(pilot,'2026-10-30').grade,'B','Never promote pilot list to A');
 const leads=TALENT_HOUSING_RESEARCH_LEADS.filter(x=>x.city===city);
 assert.equal(leads.length,3,'Zaozhuang needs real housing leads in homepage');
 for(const lead of leads){
  assert.ok(lead.steps.length>=4&&lead.address&&lead.units&&lead.statusNote);
  assert.notEqual(talentSourceKind(lead.sourceUrl),'government','unverified reprints must not count as official projects');
  assert.ok(!housing.some(h=>h.id===lead.id),'research leads cannot be disguised as certified housing');
 }
 const cityCode=code('TalentServiceRoutes.tsx');
 assert.ok(cityCode.includes('housingResearchLeads(match.name)'), 'homepage must surface Zaozhuang leads');
 assert.ok(cityCode.includes('<UnifiedTalentHousingResearch city={city} query={query}/>'));
});
check('Liaocheng V5.1: 2026 employment subsidies, historical housing and source-labeled apartments',()=>{
 const city='聊城';
 const current=TALENT_POLICY_RECORDS.filter(x=>x.city===city);
 for(const id of ['sd-lc-insurance-2026','sd-liaocheng-2026-living']){
  const p=current.find(x=>x.id===id);
  assert.ok(p&&p.materials?.length>=3&&p.applicationSteps?.length>=4,id+' must be actionable');
  assert.ok(p.reviewNote.includes('办理入口待核实'),id+' must not claim verified application portal');
  assert.notEqual(assessPolicy(p,'2026-10-30').grade,'A');
 }
 for(const id of ['lc-housing-rental-2022-history','lc-purchase-housing-2022-history']){
  const p=LIAOCHENG_POLICY_RECORDS.find(x=>x.id===id);
  assert.ok(p&&p.temporal==='historical'&&p.materials?.length>=3&&p.applicationSteps?.length>=4);
  assert.equal(talentSourceKind(p.sourceUrl),'secondary');
  assert.equal(assessPolicy(p,'2026-10-30').grade,'C');
  assert.ok(!current.some(x=>x.id===id),'Secondary history must not bypass government-only policy contract');
 }
 const leads=TALENT_HOUSING_RESEARCH_LEADS.filter(x=>x.city===city);
 assert.equal(leads.length,3,'Three distinct public reporting leads required');
 for(const l of leads){
  assert.ok(l.address&&l.sourceUrl&&l.statusNote&&l.eligibility&&l.steps.length>=4);
  assert.notEqual(talentSourceKind(l.sourceUrl),'government');
  assert.ok(!TALENT_HOUSING_RECORDS.some(h=>h.id===l.id),'No unverified listing may appear as verified project');
 }
 assert.ok(leads.some(x=>x.id==='lc-jingkai-2026-batches-lead'));
 assert.ok(leads.some(x=>x.id==='lc-gaotang-biotech-2026-lead'));
 assert.ok(leads.some(x=>x.id==='lc-jingkai-140-2022-lead'));
 const cityCode=code('TalentServiceRoutes.tsx');
 assert.ok(cityCode.includes('housingResearchLeads(match.name)'));
 assert.ok(cityCode.includes('<UnifiedTalentHousingResearch city={city} query={query}/>'));
 assert.ok(shared('UnifiedTalentHousingResearch.tsx').includes('housingPolicyResearch'),'History research must remain visible');
 assert.equal(ACCEPTED_TALENT_CITIES.includes(city),false);
});
check('Qinhuangdao V5.1 government EDZ apartment policy and separately sourced named buildings',()=>{
 const city='秦皇岛';
 const policy=TALENT_POLICY_RECORDS.find(p=>p.id==='qhd-etdz-talent-apartment-2024');
 assert.ok(policy&&policy.city===city);
 assert.equal(talentSourceKind(policy.sourceUrl),'government');
 assert.equal(policy.category,'租房安居');
 assert.ok(policy.benefit.includes('4元/㎡')&&policy.benefit.includes('免租'));
 assert.ok(policy.eligibility.includes('2024年10月1日')&&policy.eligibility.includes('3年以上'));
 assert.ok(policy.materials?.length>=3&&policy.applicationSteps?.length>=4);
 assert.ok(policy.reviewNote?.includes('办理入口待核实'));
 assert.equal(assessPolicy(policy,'2026-10-31').grade,'B','Government original does not certify live applications');
 const housing=TALENT_HOUSING_RECORDS.find(h=>h.id==='qhd-etdz-official-talent-housing-2024');
 assert.ok(housing&&housing.city===city&&housing.kind==='program');
 assert.equal(talentSourceKind(housing.sourceUrl),'government');
 assert.equal(assessHousing(housing,'2026-10-31').grade,'B');
 assert.ok(housing.steps.length>=4&&housing.statusNote.includes('申报入口未公布'));
 const leads=TALENT_HOUSING_RESEARCH_LEADS.filter(h=>h.city===city);
 assert.equal(leads.length,2,'Need two documented actual Qinhuangdao apartment points');
 for(const lead of leads){
  assert.ok(lead.category==='人才公寓'&&lead.sourceUrl&&lead.address&&lead.steps.length>=4);
  assert.notEqual(talentSourceKind(lead.sourceUrl),'government');
  assert.ok(/2026|空房/.test(lead.statusNote));
  assert.ok(!TALENT_HOUSING_RECORDS.some(h=>h.id===lead.id),'2025 media counts are not verified 2026 apartments');
 }
 assert.ok(leads.some(h=>h.id==='qhd-jinxiujiacheng-2025'));
 assert.ok(leads.some(h=>h.id==='qhd-kejidasha-2025'));
 const page=code('TalentServiceRoutes.tsx');
 assert.ok(page.includes('housingResearchLeads(match.name)')&&page.includes('<UnifiedTalentHousingResearch city={city} query={query}/>'));
 assert.equal(ACCEPTED_TALENT_CITIES.includes(city),false);
});
check('Baoding V5.1: official 2026 four-community rental allocation and historical incentives stay distinct',()=>{
 const city='保定';
 const pol=TALENT_POLICY_RECORDS.filter(p=>p.city===city);
 const homes=TALENT_HOUSING_RECORDS.filter(h=>h.city===city);
 const ids=['bd-2026-guokong-rental','bd-2025-provident-rent','bd-2022-graduate-rent-history','bd-2022-graduate-purchase-history','bd-2022-graduate-settle-history'];
 assert.equal(pol.length,5);
 assert.equal(new Set(pol.map(p=>p.id)).size,5);
 for(const id of ids){
  const p=pol.find(x=>x.id===id);
  assert.ok(p,id);
  assert.equal(talentSourceKind(p.sourceUrl),'government',id);
  assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4,id+' must include detailed conditions');
  assert.ok(p.reviewNote.includes('办理入口待核实'),id+' must disclose online access limits');
  assert.notEqual(assessPolicy(p,'2026-10-31').grade,'A');
 }
 for(const id of ids.slice(2))assert.equal(assessPolicy(pol.find(p=>p.id===id),'2026-10-31').grade,'C','2022 is historical only');
 assert.ok(pol.find(p=>p.id==='bd-2025-provident-rent').benefit.includes('不是政府额外发款'));
 assert.ok(pol.find(p=>p.id==='bd-2022-graduate-purchase-history').benefit.includes('分两次'));
 assert.equal(homes.length,5);
 assert.equal(homes.filter(h=>h.kind==='project').length,4);
 assert.equal(homes.filter(h=>h.kind==='program').length,1);
 const named=['曹庄小区','新秀园','周正家园','中贤佳苑'];
 for(const name of named){
  const h=homes.find(x=>x.kind==='project'&&x.title.includes(name));
  assert.ok(h,'Missing named official housing site '+name);
  assert.equal(talentSourceKind(h.sourceUrl),'government');
  assert.ok(h.units.includes('284')&&h.units.includes('合计')&&h.units.includes('不能把284套全部算作本小区'));
  assert.ok(h.statusNote.includes('不代表现在仍有空房'));
  assert.ok(h.steps.length>=4&&h.contactPhone.includes('0312-6789109'));
  assert.notEqual(assessHousing(h,'2026-10-31').grade,'A');
 }
 const program=homes.find(h=>h.kind==='program');
 assert.ok(program.units.includes('不得与四个具体项目重复加总'));
 assert.ok(program.steps.length>=4&&program.statusNote.includes('不等于2026年10月实时空房'));
 const cityCode=code('TalentServiceRoutes.tsx');
 assert.ok(cityCode.includes("const housingPolicies=policies.filter(isHousingPolicy)"));
 assert.ok(cityCode.includes("k.id==='policies'?(policies.length+researchPolicyCount)+' 条已收录（含分级资料）'"),'Baoding should count graded government and research policies without pretending research is verified');
 assert.equal(ACCEPTED_TALENT_CITIES.includes(city),false);
});
console.log(JSON.stringify({passed,baseline:base.policyIds.length+base.housingIds.length,certified:Object.keys(CERTIFIED_TALENT_GUIDES).length,acceptedCities:ACCEPTED_TALENT_CITIES.length},null,2));
