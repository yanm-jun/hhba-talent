import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nzPathways} from '../src/data/overseasNewZealand.ts';
import {auPathways} from '../src/data/overseasAustralia.ts';
import {nzCompleteGuidesV2} from '../src/data/overseasNzGuidesV2.ts';
import {auCompleteGuidesV2} from '../src/data/overseasAuGuidesV2.ts';
import {overseasTerms} from '../src/data/overseasGlossary.ts';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const both=[...nzPathways,...auPathways];
test('16/16 official overseas pathways have actionable 10-chapter guides',()=>{
 const guides={...nzCompleteGuidesV2,...auCompleteGuidesV2};
 assert.equal(Object.keys(nzCompleteGuidesV2).length,7);
 assert.equal(Object.keys(auCompleteGuidesV2).length,9);
 assert.equal(both.length,16);
 assert.equal(Object.keys(guides).length,16);
 for(const p of both){
  const g=guides[p.id];
  assert.ok(g,'missing detailed guide: '+p.id);
  assert.ok(g.plainAnswer.length>=65&&g.firstAction.length>=35,p.id+' insufficient plain-language introduction');
  assert.equal(g.sections.length,8,p.id+' must have eight detailed sections plus FAQ and risks');
  for(const [i,section] of g.sections.entries()){
   assert.ok(section.title.length>=6&&section.summary.length>=25,p.id+' weak section introduction '+i);
   assert.ok(section.points.length>=3,p.id+' overly short section '+i);
   for(const x of section.points)assert.ok(x.label.length>=3&&x.explain.length>=25&&x.action.length>=25,p.id+' lacks specific explanation/action '+i);
  }
  assert.ok(g.faq.length>=4&&g.faq.every(x=>x.question.length>8&&x.answer.length>=30),p.id+' weak FAQ');
  assert.ok(g.risks.length>=3&&g.risks.every(x=>x.length>=24),p.id+' risk omissions');
  assert.ok(g.terms.length>=4&&g.terms.every(x=>overseasTerms[x]),p.id+' undefined term');
  assert.ok(g.sources.length>=2&&g.sources.every(x=>x.url.startsWith('https://')),p.id+' official sources missing');
  const host=p.id.startsWith('nz-')?'immigration.govt.nz':'immi.homeaffairs.gov.au';
  assert.ok(g.sources.every(x=>new URL(x.url).host.endsWith(host)),p.id+' unverified official host');
 }
});
test('two country page detail routes use shared guide, not original 5-point shallow bullets',()=>{
 const nz=read('../src/pages/OverseasDevelopmentPage.tsx');
 const au=read('../src/pages/AustraliaDevelopmentPage.tsx');
 const component=read('../src/components/OverseasDetailedGuide.tsx');
 const css=read('../src/styles/overseas-guide-v2.css');
 assert.match(nz,/OverseasDetailedGuide key=\{chosen.id\}/);
 assert.match(au,/OverseasDetailedGuide key=\{detail.id\}/);
 assert.ok(component.includes('09')&&component.includes('10'));
 assert.ok(component.includes('details')&&component.includes('核对'));
 assert.ok(component.includes('type="checkbox"'));
 assert.ok(css.includes('@media(max-width:760px)'));
});
test('gov source interpretation is explicit: NZ Tier1 age and IQA, 189 65 not auto invitation, China 462 ballot ongoing',()=>{
 const nz=JSON.stringify(nzCompleteGuidesV2['nz-green-tier1']);
 const au189=JSON.stringify(auCompleteGuidesV2['au-189']);
 const au462=JSON.stringify(auCompleteGuidesV2['au-462-china']);
 const au500=JSON.stringify(auCompleteGuidesV2['au-500']);
 assert.match(nz,/55岁/);
 assert.match(nz,/IQA/);
 assert.match(au189,/65分/);
 assert.match(au189,/60个日历日/);
 assert.match(au462,/2027-04-30/);
 assert.match(au462,/Closed/);
 assert.match(au500,/CoE/);
 assert.match(au500,/GS/);
});
