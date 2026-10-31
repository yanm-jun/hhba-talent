import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {tamiuSources,tamiuPhotos,tamiuFacts,tamiuOverview,tamiuMbaCurriculum,tamiuMbaConcentrations,tamiuAdmission,tamiuCost,tamiuFunding,tamiuFaq} from '../src/data/studyTamiu.ts';
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
test('TAMIU is an extensive verified university profile, not a one-line description',()=>{
 assert.equal(tamiuFacts.length,6);
 assert.equal(tamiuOverview.length,4);
 assert.ok(tamiuOverview.every(x=>x.body.length>=80&&x.source.startsWith('https://')));
 assert.equal(tamiuMbaCurriculum.length,4);
 assert.ok(tamiuMbaCurriculum.every(x=>x.detail.length>=50));
 assert.ok(tamiuMbaConcentrations.length>=6);
 assert.ok(tamiuMbaConcentrations.every(x=>x.note.length>=25));
 assert.equal(tamiuAdmission.tasks.length,8);
 assert.equal(tamiuAdmission.deadlines.length,4);
 assert.equal(tamiuCost.length,6);
 assert.equal(tamiuFunding.length,4);
 assert.equal(tamiuFaq.length,7);
 assert.ok(tamiuCost.find(x=>x.value==='US$28,372'));
 assert.ok(tamiuAdmission.exam.some(x=>x.includes('79')&&x.includes('6.5')));
 assert.ok(tamiuAdmission.exam.some(x=>x.includes('3.00')&&x.includes('GMAT')));
 assert.ok(tamiuFunding.find(x=>x.name.includes('Assistantship'))?.note.includes('不代缴'));
});
test('Do not market online MBA as automatically approved for F-1 or pretend MBA concentrations are separate degrees',()=>{
 const src=read('components/TamiuUniversityPage.tsx');
 assert.ok(src.includes('不能把网课学习等同于线下留学'));
 assert.ok(tamiuAdmission.tasks.some(x=>x.includes('F-1')));
 assert.ok(src.includes('一个学位'));
 assert.ok(src.includes('tamiuMbaConcentrations.map'));
 assert.ok(src.includes('tamiuAdmission.tasks.map'));
 assert.ok(src.includes('tamiuCost.map'));
 assert.ok(src.includes('tamiuFunding.map'));
 assert.ok(tamiuFaq.some(v=>v.q.includes('F-1')&&v.a.includes('不能')));
 assert.ok(tamiuFaq.some(v=>v.q.includes('费用')||v.q.includes('28,372')));
});
test('Three distinct original real campus photos, photographer + legal terms + local assets',()=>{
 assert.deepEqual(tamiuPhotos.map(p=>p.id),['canseco','killam','trade']);
 assert.deepEqual(new Set(tamiuPhotos.map(p=>p.file)).size,3);
 assert.deepEqual(new Set(tamiuPhotos.map(p=>p.fileName)).size,3);
 for(const p of tamiuPhotos){
  assert.equal(p.creator,'Billy Hathorn');
  assert.ok(p.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
  assert.ok(p.licenseUrl.startsWith('https://'));
  assert.equal(p.date,'2012-09-26');
 }
 assert.ok(tamiuPhotos.some(p=>p.license.includes('公共领域')));
 assert.equal(tamiuPhotos.filter(p=>p.license==='CC BY-SA 3.0').length,2);
 const src=read('components/TamiuUniversityPage.tsx');
 assert.ok(src.includes('tamiuPhotos.map'));
 assert.ok(src.includes('imagePath(')===false&&src.includes('localPhoto('));
 assert.ok(src.includes('role="dialog" aria-modal="true"'));
 assert.ok(src.includes('href={p.sourceUrl}'));
});
test('Only clicked-in pages expand, keeping V1 homepage and both prior deep universities',()=>{
 const routes=read('components/StudyUniversityDirectory.tsx');
 assert.ok(routes.includes("if(id==='tamiu')"));
 assert.ok(routes.includes("if(id==='tamiu-mba')"));
 assert.ok(routes.includes("if(id==='minot-state')"));
 assert.ok(routes.includes("if(id==='south-dakota')"));
 assert.ok(read('pages/StudyAbroadPage.tsx').includes('StudyUniversityDirectory'));
 assert.ok(!read('pages/StudyAbroadPage.tsx').includes('TamiuUniversityPage'));
 const page=read('components/TamiuUniversityPage.tsx');
 for(const section of ['tamiu-overview','tamiu-campus','tamiu-mba','tamiu-admissions','tamiu-costs','tamiu-funding','tamiu-faq','tamiu-sources'])assert.ok(page.includes(section));
 assert.ok(read('styles/study-tamiu.css').includes('@media(max-width:640px)'));
 for(const s of Object.values(tamiuSources))assert.ok(s.url.startsWith('https://www.tamiu.edu/')||s.url.startsWith('https://catalog.tamiu.edu/'),s.url);
});
