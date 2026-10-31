import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {tumSources,tumStats,tumPhotos,tumOverview,tumThemes,tumLanguage,tumApplication,tumWindows,tumFees,tumFaq} from '../src/data/studyTum.ts';
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
test('TUM MSc graduate entry truth: 120 ECTS, 4 semesters, no zero-background conversion claim',()=>{
 assert.equal(tumStats.length,6);assert.equal(tumOverview.length,4);assert.equal(tumThemes.length,6);
 assert.equal(tumLanguage.length,6);assert.equal(tumApplication.length,11);assert.equal(tumWindows.length,2);assert.equal(tumFees.length,5);assert.equal(tumFaq.length,8);
 assert.ok(tumStats.some(x=>x.value.includes('120 ECTS')));
 assert.ok(tumFees.some(x=>x.value.includes('€6,000')));
 assert.ok(tumFees.some(x=>x.value.includes('€97')));
 assert.ok(tumFaq.some(x=>x.a.includes('不能')&&x.a.includes('计算机')));
 assert.ok(tumApplication.some(x=>x.includes('VPD')));
 assert.ok(tumApplication.some(x=>x.includes('Curricular Analysis')));
 assert.ok(tumLanguage.some(x=>x.includes('IELTS')&&x.includes('6.5')));
 assert.ok(tumLanguage.some(x=>x.includes('TOEFL')&&x.includes('88')));
 assert.ok(tumOverview.every(x=>x.body.length>=65));
 assert.ok(tumThemes.every(x=>x.detail.length>=65));
});
test('Only three independent real Garching images with author/year/license and Commons provenance',()=>{
 assert.equal(tumPhotos.length,3);
 assert.equal(new Set(tumPhotos.map(x=>x.commons)).size,3);
 assert.equal(new Set(tumPhotos.map(x=>x.file)).size,3);
 for(const p of tumPhotos){
   assert.ok(p.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
   assert.ok(p.licenseUrl.startsWith('https://creativecommons.org/'));
   assert.ok(p.author&&p.date&&p.description.length>=40);
 }
 assert.ok(tumPhotos.some(x=>x.license.includes('BY-SA')));
 assert.ok(tumPhotos.some(x=>x.name.includes('信息学')));
});
test('HHBA main study homepage is unchanged, 6th university routes return longform school and master',()=>{
 const r=read('components/StudyUniversityDirectory.tsx');
 const page=read('components/TumUniversityPage.tsx');
 for(const id of ['minot-state','south-dakota','tamiu','birmingham','monash','tum'])assert.ok(r.includes("'"+id+"'"),id);
 assert.ok(r.includes("if(id==='tum')"));
 assert.ok(r.includes("if(id==='tum-informatics-ms')"));
 assert.ok(!read('pages/StudyAbroadPage.tsx').includes('TumUniversityPage'));
 assert.ok(page.includes('data-tum-deep-profile="true"'));
 assert.ok(page.includes('data-tum-gallery'));
 assert.ok(page.includes('role="dialog" aria-modal="true"'));
 assert.ok(page.includes('tumApplication.map'));
 for(const id of ['tum-overview','tum-campus','tum-degree','tum-admission','tum-dates','tum-costs','tum-faq','tum-sources'])assert.ok(page.includes(id));
 assert.ok(read('styles/study-tum.css').includes('@media(max-width:720px)'));
 assert.ok(Object.values(tumSources).every(v=>v.url.startsWith('https://www.tum.de/')||v.url.startsWith('https://www.cit.tum.de/')));
});
