import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {birminghamSources,birminghamFacts,birminghamPhotos,birminghamOverview,birminghamPrograms,birminghamEnglish,birminghamApplication,birminghamDates,birminghamFaqs} from '../src/data/studyBirmingham.ts';
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
test('Fourth school longform: 2 real conversion degrees / 180 credits / deep curricula / sources',()=>{
 assert.equal(birminghamFacts.length,6);assert.equal(birminghamOverview.length,4);
 assert.equal(birminghamPhotos.length,3);assert.equal(birminghamFaqs.length,8);
 assert.equal(birminghamApplication.length,10);assert.equal(birminghamDates.length,2);
 assert.equal(Object.keys(birminghamPrograms).length,2);
 assert.equal(birminghamPrograms['birmingham-cs-conversion'].modules.reduce((n,x)=>n+x.credit,0),180);
 assert.equal(birminghamPrograms['birmingham-ai-conversion'].modules.reduce((n,x)=>n+x.credit,0),180);
 for(const [id,p] of Object.entries(birminghamPrograms)){
  assert.ok(p.intro.length>95&&p.admission.length>90,id);
  assert.equal(p.modules.length,6);
  assert.ok(p.modules.every(m=>m.content.length>65),id);
  assert.ok(p.courseUrl.startsWith('https://www.birmingham.ac.uk/'));
 }
 assert.equal(birminghamEnglish.length,5);assert.ok(birminghamEnglish.some(x=>x.includes('6.5')&&x.includes('6.0')));
 assert.equal(birminghamPrograms['birmingham-cs-conversion'].intlTuition[0].value,'£34,740');
 assert.equal(birminghamPrograms['birmingham-cs-conversion'].intlTuition[1].value,'£36,000');
 assert.equal(birminghamPrograms['birmingham-ai-conversion'].intlTuition.length,0);
 assert.ok(birminghamPrograms['birmingham-ai-conversion'].note.includes('不得'));
});
test('Separate International tuition from UK rates, deposit is credited and January availability differs',()=>{
 const page=read('components/BirminghamUniversityPage.tsx');
 assert.ok(page.includes('£34,740')===false||page.includes('intlTuition.map'));
 assert.ok(page.includes('£12,780')&&page.includes('不能作为国际生'));
 assert.ok(page.includes('£3,000')&&page.includes('抵扣'));
 assert.ok(birminghamDates[0].overseas==='2026-10-30'&&birminghamDates[1].overseas==='2027-07-02');
 assert.ok(birminghamFaqs.some(x=>x.a.includes('不是')||x.a.includes('不能')));
});
test('3 distinct real campus images with photographer credits and valid license links',()=>{
 assert.equal(new Set(birminghamPhotos.map(x=>x.file)).size,3);
 assert.equal(new Set(birminghamPhotos.map(x=>x.author)).size,3);
 for(const p of birminghamPhotos){
  assert.ok(p.file.endsWith('.jpg')&&p.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
  assert.ok(p.licenseUrl.startsWith('https://creativecommons.org/'));
  assert.ok(p.description.length>=35&&p.author.length>5);
 }
 assert.ok(birminghamPhotos.some(x=>x.date.startsWith('2026')&&x.label.includes('Old Joe')));
 const page=read('components/BirminghamUniversityPage.tsx');
 assert.ok(page.includes('data-bham-gallery')&&page.includes('aria-modal="true"')&&page.includes('birminghamPhotos.map'));
 assert.ok(page.includes('p.sourceUrl')&&page.includes('p.licenseUrl'));
});
test('Original HHBA study homepage unchanged; clicked-in school and both degrees present',()=>{
 const routes=read('components/StudyUniversityDirectory.tsx');
 assert.ok(routes.includes("if(id==='birmingham')"));
 for(const id of Object.keys(birminghamPrograms))assert.ok(routes.includes("'"+id+"'"));
 for(const id of ['minot-state','south-dakota','tamiu'])assert.ok(routes.includes("'"+id+"'"));
 assert.ok(!read('pages/StudyAbroadPage.tsx').includes('BirminghamUniversityPage'));
 const page=read('components/BirminghamUniversityPage.tsx');
 for(const id of ['bham-intro','bham-photos','bham-programs','bham-admission','bham-deadlines','bham-fees','bham-faq','bham-sources'])assert.ok(page.includes(id));
 assert.ok(read('styles/study-birmingham.css').includes('@media(max-width:680px)'));
 assert.ok(Object.values(birminghamSources).every(x=>x.url.startsWith('https://www.birmingham.ac.uk/')));
});
