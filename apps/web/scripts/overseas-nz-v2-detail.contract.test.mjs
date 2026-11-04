import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nzPathways} from '../src/data/overseasNewZealand.ts';
import {nzCompleteGuidesV2} from '../src/data/overseasNzGuidesV2.ts';
import {overseasTerms} from '../src/data/overseasGlossary.ts';
const page=readFileSync(new URL('../src/pages/OverseasDevelopmentPage.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles/overseas-guide-v2.css',import.meta.url),'utf8');
test('7/7 New Zealand paths have complete 10-chapter instructions, not tiny summary cards',()=>{
 assert.equal(Object.keys(nzCompleteGuidesV2).length,7);
 for(const pathway of nzPathways){
  const g=nzCompleteGuidesV2[pathway.id];
  assert.ok(g,'missing guide '+pathway.id);
  assert.ok(g.plainAnswer.length>=65&&g.firstAction.length>=35,pathway.id+' user-first summary');
  assert.equal(g.sections.length,8,pathway.id+' 8 sections + FAQs + risks');
  assert.ok(JSON.stringify(g.sections).length>=1800, pathway.id+' must contain substantial long-form instructions');
  for(const [i,s] of g.sections.entries()){
   assert.ok(s.title&&s.summary.length>=10,pathway.id+' section '+i+' heading');
   assert.ok(s.points.length>=3,pathway.id+' section '+i+' depth');
   for(const p of s.points)assert.ok(p.label.length>=3&&p.explain.length>=10&&p.action.length>=10,pathway.id+' detail/action');
  }
  assert.ok(g.faq.length>=4&&g.faq.every(f=>f.question.length>8&&f.answer.length>30),pathway.id+' FAQs');
  assert.ok(g.risks.length>=3&&g.risks.every(s=>s.length>=20),pathway.id+' risk explanation');
  assert.ok(g.terms.length>=4&&g.terms.every(t=>overseasTerms[t]),pathway.id+' glossary');
  assert.ok(g.sources.length>=2&&g.sources.every(s=>s.url.startsWith('https://www.immigration.govt.nz/')),pathway.id+' verified source');
 }
});
test('deep NZ route actually renders guide and responsive glossary, rather than old five tiny lists',()=>{
 assert.match(page,/OverseasDetailedGuide key=\{chosen\.id\}/);
 assert.ok(!page.includes('<Block title="01 · 申请资格与门槛"'));
 assert.ok(css.includes('.hhba-guide-v2-toc'));
 assert.ok(css.includes('.hhba-guide-inline-term'));
 assert.ok(css.includes('@media(max-width:840px)'));
 assert.ok(!css.includes('.hhba-guide-v2-check-status'));
 assert.ok(page.includes('hhba-overseas-reader-actions'));
 assert.ok(!page.includes('hhba-overseas-aside-card') || page.includes('hhba-overseas-reader-page'));
});
test('Tier 1 and student meaningful details are present',()=>{
 const a=nzCompleteGuidesV2['nz-green-tier1'],s=nzCompleteGuidesV2['nz-student'];
 assert.match(JSON.stringify(a),/NZD 6,450/);
 assert.match(JSON.stringify(a),/IQA/);
 assert.match(JSON.stringify(s),/NZD 20,000/);
 assert.match(JSON.stringify(s),/Offer of Place/);
 assert.equal(nzCompleteGuidesV2['nz-china-whv'].sources[0].url,'https://www.immigration.govt.nz/visas/china-working-holiday-visa/');
});
