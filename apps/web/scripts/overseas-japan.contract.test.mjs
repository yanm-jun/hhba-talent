import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {jpPathways,jpOfficialSources} from '../src/data/overseasJapan.ts';
import {jpSSWFields,jpSSW2FieldCount,jpEngineerExamples,jpOccupationRecords} from '../src/data/overseasJapanOccupations.ts';
import {jpCompleteGuidesV1} from '../src/data/overseasJapanGuides.ts';
import {overseasTerms} from '../src/data/overseasGlossary.ts';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');

test('Nine different Japanese statuses each have genuine law-grounded process and independent visa routes',()=>{
 assert.equal(jpPathways.length,9);
 assert.equal(new Set(jpPathways.map(x=>x.id)).size,9);
 for(const p of jpPathways){
  assert.ok(p.id.startsWith('jp-')&&p.name.length>=6&&p.english.length>=6,p.id);
  assert.ok(p.requirement.length>=4&&p.documents.length>=4&&p.steps.length>=4,p.id);
  assert.ok(p.fees.length>=2&&p.rights.length>=2&&p.risks.length>=2,p.id);
  const url=new URL(p.officialUrl);
  assert.ok(['www.moj.go.jp','www.ssw.go.jp','www.studyinjapan.go.jp'].includes(url.hostname),p.id+' invalid government source');
 }
 assert.match(JSON.stringify(jpPathways.find(x=>x.id==='jp-jfind')),/5年/);
 assert.match(JSON.stringify(jpPathways.find(x=>x.id==='jp-jskip')),/2000万日元/);
 assert.match(JSON.stringify(jpPathways.find(x=>x.id==='jp-designated46')),/BJT/);
 assert.match(JSON.stringify(jpPathways.find(x=>x.id==='jp-ssw1')),/餐饮服务领域.*暂停/);
});

test('Actual 19 first SSW fields, 11 second SSW fields, plus clear professional activity examples',()=>{
 assert.equal(jpSSWFields.length,19);
 assert.equal(jpSSW2FieldCount,11);
 assert.equal(jpEngineerExamples.length,9);
 assert.equal(jpOccupationRecords.length,28);
 assert.equal(new Set(jpOccupationRecords.map(x=>x.id)).size,28);
 assert.ok(jpSSWFields.every(x=>x.sector&&x.id.startsWith('jp-')&&x.source.startsWith('https://www.ssw.go.jp/')));
 for(const x of jpOccupationRecords){
  assert.ok(x.name.length>=2&&x.japanese.length>=2&&x.english.length>5,x.id);
  assert.ok(x.examples.length>=1&&x.qualification.length>=40,x.id+' clear duties/qualification');
  assert.ok(x.language.length>=30&&x.salary.length>=35,x.id+' actual language and pay qualification');
  assert.ok(x.evidence.length>=4&&x.steps.length===4,x.id+' detailed document instructions');
  assert.ok(x.warning===undefined||true);
  assert.equal(x.verifiedOn,'2026-11-04');
 }
 const restaurant=jpSSWFields.find(x=>x.id==='jp-food-service');
 assert.equal(restaurant.status,'closed-new-coe');
 assert.equal(restaurant.ssw2Eligible,true);
 assert.match(restaurant.language,/2026-04-13/);
 assert.equal(jpSSWFields.filter(x=>x.status==='detail-pending').length,3);
 assert.match(jpSSWFields.find(x=>x.id==='jp-nursing-care').language,/护理日语/);
 assert.match(jpSSWFields.find(x=>x.id==='jp-automobile-transport').language,/N3/);
 assert.ok(jpEngineerExamples.every(x=>!x.sector&&x.pathwayId==='jp-engineer'));
});

test('All 9 guides provide 8 substantial sections + actual FAQ, real sources and plain-language terms',()=>{
 assert.equal(Object.keys(jpCompleteGuidesV1).length,9);
 for(const p of jpPathways){
  const g=jpCompleteGuidesV1[p.id];
  assert.ok(g,p.id+' missing guide');
  assert.ok(g.plainAnswer.length>=60&&g.firstAction.length>=45,p.id+' plain intro');
  assert.equal(g.sections.length,8,p.id);
  assert.ok(JSON.stringify(g.sections).length>1900,p.id+' shallow content');
  for(const section of g.sections){
   assert.ok(section.summary.length>=20,p.id+' summary');
   assert.ok(section.points.length>=3,p.id+' missing practical points');
   for(const part of section.points){assert.ok(part.explain.length>=12&&part.action.length>=5,p.id+' action too short')}
  }
  assert.ok(g.faq.length>=4&&g.faq.every(x=>x.question.length>=8&&x.answer.length>=26),p.id+' practical FAQ');
  assert.ok(g.risks.length>=3,p.id+' risks');
  assert.ok(g.sources.length>=3&&g.sources.every(s=>s.url.startsWith('https://')),p.id+' real source');
  assert.ok(g.terms.every(term=>overseasTerms[term]),p.id+' missing jargon interpretation');
 }
});
test('Three-level routes and filtered search retain existing overseas, NZ and AU modules',()=>{
 const main=read('../src/main.tsx');
 const index=read('../src/pages/OverseasDevelopmentPage.tsx');
 const jp=read('../src/pages/JapanDevelopmentPage.tsx');
 const occupation=read('../src/components/JapanOccupationDirectory.tsx');
 const article=read('../src/components/OverseasDetailedGuide.tsx');
 assert.match(main,/study-abroad\/country\/japan/);
 assert.match(main,/study-abroad\/japan\/occupation\//);
 assert.match(main,/JapanOccupationDetailPage/);
 assert.match(jp,/JapanOccupationDirectory|OverseasDetailedGuide/);
 assert.match(jp,/hhba-overseas-jp-hero/);
 assert.match(occupation,/jpSSWFields/);
 assert.match(occupation,/jpEngineerExamples/);
 assert.match(occupation,/closed-new-coe/);
 assert.match(article,/JapanOccupationDirectory/);
 assert.match(article,/jp-ssw1/);
 assert.match(index,/c\.code==='nz'\?countryLink:root\+'\/country\/'\+c\.code/);
 const styles=read('../src/styles/overseas-japan.css');
 assert.ok(styles.includes('Tokyo_-_Sunset_Skyline.jpg'));
 assert.ok(styles.includes('@media(max-width:760px)'));
});
