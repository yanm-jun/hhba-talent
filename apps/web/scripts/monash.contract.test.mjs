import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {monashSources,monashPhotos,monashFacts,monashOverview,monashPrograms,monashEnglish,monashSteps,monashFaqs} from '../src/data/studyMonash.ts';
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
test('05 Monash deep official dossier covers two real degrees with detailed modules',()=>{
 assert.equal(monashFacts.length,6);assert.equal(monashPhotos.length,3);assert.equal(monashOverview.length,4);
 assert.equal(monashSteps.length,10);assert.equal(monashFaqs.length,8);assert.equal(monashEnglish.length,4);
 assert.deepEqual(Object.keys(monashPrograms).sort(),['monash-bis-master','monash-it-master']);
 for(const p of Object.values(monashPrograms)){
  assert.equal(p.units.length,6);assert.equal(p.points,96);assert.equal(p.shortPoints,72);
  assert.ok(p.units.every(x=>x.body.length>40),p.id);
  assert.ok(p.qualifications.length>90&&p.study.length>90,p.id);
  assert.equal(p.fee,'A$57,540');
  assert.ok(p.url.includes('international=true'));
 }
 assert.ok(monashPrograms['monash-bis-master'].scholarship.includes('20%'));
 assert.ok(monashPrograms['monash-it-master'].scholarship.includes('未纳入'));
 assert.ok(monashEnglish.some(x=>x.includes('6.5')&&x.includes('6.0')));
 assert.ok(monashFaqs.some(x=>x.answer.includes('不是')));
});
test('Three independently sourced correctly licensed actual Monash campus photos',()=>{
 assert.equal(new Set(monashPhotos.map(p=>p.file)).size,3);
 assert.equal(new Set(monashPhotos.map(p=>p.commonsName)).size,3);
 for(const p of monashPhotos){
  assert.ok(p.sourceUrl.includes('commons.wikimedia.org/wiki/File:'));
  assert.ok(p.licenseUrl.startsWith('https://creativecommons.org/'));
  assert.ok(p.author&&p.taken&&p.description.length>25);
 }
});
test('Existing HHBA homepage untouched, new longform routes and price provenance connected',()=>{
 const router=read('components/StudyUniversityDirectory.tsx');
 const main=read('components/MonashUniversityPage.tsx');
 assert.ok(router.includes("if(id==='monash')"));
 for(const id of Object.keys(monashPrograms))assert.ok(router.includes("'"+id+"'"));
 assert.ok(main.includes('data-monash-detail="deep"')&&main.includes('data-monash-gallery'));
 assert.ok(main.includes('role="dialog" aria-modal="true"'));
 assert.ok(main.includes('monashPrograms[id]')&&main.includes('monashSteps.map'));
 for(const key of ['monash-overview','monash-photos','monash-programs','monash-admission','monash-costs','monash-faq','monash-sources'])assert.ok(main.includes(key));
 assert.ok(!read('pages/StudyAbroadPage.tsx').includes('MonashUniversityPage'));
 assert.ok(read('styles/study-monash.css').includes('@media(max-width:690px)'));
 assert.ok(Object.values(monashSources).every(x=>x.url.startsWith('https://www.monash.edu/')));
});
