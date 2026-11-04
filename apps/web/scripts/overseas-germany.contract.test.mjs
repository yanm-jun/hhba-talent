import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {germanyPathways,allGermanyRoutes,deOfficial,deVerifiedOn} from '../src/data/overseasGermany.ts';
import {deCompleteGuides} from '../src/data/overseasGermanyGuides.ts';
import {deBlueProfessionSamples,deTrainingOccupationSamples} from '../src/data/overseasGermanyOccupations.ts';
import {overseasTerms} from '../src/data/overseasGlossary.ts';
import {overseasCountryOptions} from '../src/data/overseasNewZealand.ts';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');

test('Nine independent German government visa pathways with no generic simulated programs',()=>{
 assert.equal(deVerifiedOn,'2026-11-04');
 assert.equal(germanyPathways.length,9);
 assert.equal(new Set(germanyPathways.map(x=>x.id)).size,9);
 assert.deepEqual(germanyPathways.map(x=>x.id),[
 'de-opportunity','de-blue-card','de-skilled','de-experience','de-recognition','de-training','de-training-search','de-student','de-graduate']);
 for(const p of germanyPathways){
  assert.ok(p.id.startsWith('de-')&&p.name.length>=6,p.id);
  assert.ok(p.requirement.length>=4&&p.documents.length>=4&&p.steps.length>=4,p.id+' insufficient steps');
  assert.ok(p.fees.length>=3&&p.risks.length>=2&&p.rights.length>=3,p.id);
  const url=new URL(p.officialUrl);
  assert.ok(['www.make-it-in-germany.com','zab.kmk.org','digital.diplo.de'].includes(url.hostname),p.id+' source not a German official government agency');
 }
 assert.match(JSON.stringify(germanyPathways.find(x=>x.id==='de-opportunity')),/1,091/);
 assert.match(JSON.stringify(germanyPathways.find(x=>x.id==='de-blue-card')),/50,700/);
 assert.match(JSON.stringify(germanyPathways.find(x=>x.id==='de-blue-card')),/45,934\.20/);
 assert.match(JSON.stringify(germanyPathways.find(x=>x.id==='de-experience')),/45,630/);
 assert.match(JSON.stringify(germanyPathways.find(x=>x.id==='de-recognition')),/A2/);
 assert.match(JSON.stringify(germanyPathways.find(x=>x.id==='de-training-search')),/35岁/);
 assert.match(JSON.stringify(germanyPathways.find(x=>x.id==='de-student')),/11,904/);
 assert.match(JSON.stringify(germanyPathways.find(x=>x.id==='de-graduate')),/18个月/);
});

test('Each German guide has 10 substantial plain Chinese sections, specific proof, FAQ and original source',()=>{
 assert.equal(Object.keys(deCompleteGuides).length,9);
 for(const route of allGermanyRoutes){
  const g=deCompleteGuides[route.id];assert.ok(g,route.id+' missing guide');
  assert.ok(g.plainAnswer.length>60&&g.firstAction.length>30,route.id+' no concrete opening');
  assert.equal(g.sections.length,8);
  for(const [i,s] of g.sections.entries()){
   assert.ok(s.summary.length>=15,route.id+' weak intro '+i);
   assert.ok(s.points.length>=3,route.id+' no practical points '+i);
   assert.ok(s.points.every(x=>x.label.length>=4&&x.explain.length>=10&&x.action.length>=9),route.id+' incomplete actionable advice '+i);
  }
  assert.ok(JSON.stringify(g.sections).length>2000,route.id+' overall content too shallow');
  assert.ok(g.faq.length>=4&&g.faq.every(x=>x.question.length>=8&&x.answer.length>=25),route.id+' FAQ incomplete');
  assert.ok(g.risks.length>=3);
  assert.ok(g.sources.length>=3&&g.sources.every(x=>x.url.startsWith('https://')),route.id+' original official references');
  assert.ok(g.terms.every(x=>overseasTerms[x]),route.id+' unexplained jargon: '+g.terms.filter(x=>!overseasTerms[x]).join(','));
 }
});

test('12 actual Blue Card professional examples + 8 Ausbildung occupations have multilingual names, evidence and sources',()=>{
 assert.equal(deBlueProfessionSamples.length,12);
 assert.equal(deTrainingOccupationSamples.length,8);
 const all=[...deBlueProfessionSamples,...deTrainingOccupationSamples];
 assert.equal(new Set(all.map(x=>x.id)).size,20);
 for(const prof of all){
  assert.ok(prof.cn.length>=2&&prof.de.length>=7&&prof.en.length>=7,prof.id);
  assert.ok(prof.duties.length>=18&&prof.qualification.length>=30,prof.id);
  assert.ok(prof.salary.length>=40&&prof.language.length>=30,prof.id);
  assert.ok(prof.documents.length>=4&&prof.actions.length>=4,prof.id);
  assert.ok(prof.sources.length>=3&&prof.sources.every(s=>s.url.startsWith('https://')),prof.id);
  assert.ok(prof.important.length>=15);
 }
 assert.match(deBlueProfessionSamples.find(x=>x.id==='de-blue-doctor').regulation,/执业/);
 assert.match(deBlueProfessionSamples.find(x=>x.id==='de-blue-software').salary,/50,700/);
 assert.match(deTrainingOccupationSamples.find(x=>x.id==='de-training-mechatronics').salary,/1,048/);
});

test('German country link, independent occupation routes and photo stay part of existing site',()=>{
 const main=read('../src/main.tsx'), home=read('../src/pages/OverseasDevelopmentPage.tsx');
 const page=read('../src/pages/GermanyDevelopmentPage.tsx');
 const comp=read('../src/components/GermanyOccupationDirectory.tsx');
 const article=read('../src/components/OverseasDetailedGuide.tsx');
 assert.deepEqual(overseasCountryOptions.filter(x=>x.ready).map(x=>x.code),['nz','au','jp','de','ca']);
 assert.match(home,/c\.code==='de'\?root\+'\/country\/germany'/);
 assert.match(main,/\/study-abroad\/country\/germany/);
 assert.match(main,/\/study-abroad\/germany\/occupation\//);
 assert.match(main,/GermanyOccupationDetailPage/);
 assert.match(page,/data-hhba-overseas-de/);
 assert.match(page,/de\.webp/);
 assert.match(page,/deCompleteGuides/);
 assert.match(comp,/deBlueProfessionSamples/);
 assert.match(comp,/deTrainingOccupationSamples/);
 assert.match(comp,/aria-label=\{'搜索德国'/);
 assert.match(article,/GermanyOccupationDirectory/);
 assert.match(article,/de-blue-card/);
 assert.match(article,/de-training/);
 const photo=fileURLToPath(new URL('../public/overseas/countries/de.webp',import.meta.url));
 assert.ok(statSync(photo).size>12000);
 const img=readFileSync(photo);
 assert.equal(img.toString('ascii',8,12),'WEBP');
 const css=read('../src/styles/overseas-germany.css');
 assert.ok(css.includes('@media(max-width:760px)'));
 assert.ok(deOfficial.blue.startsWith('https://www.make-it-in-germany.com/'));
});
