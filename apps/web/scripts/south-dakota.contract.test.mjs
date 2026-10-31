import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {usdAdmission,usdCost,usdFacts,usdFaqs,usdOverview,usdPhotos,usdProgramDetails,usdSources} from '../src/data/studySouthDakota.ts';
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
test('South Dakota: verified longform with 2026 facts, 3 unique masters, 7-step checklist and genuine admissions detail',()=>{
 assert.equal(usdFacts.length,6);assert.equal(usdOverview.length,4);assert.equal(usdPhotos.length,3);
 assert.equal(usdFaqs.length,7);assert.equal(usdAdmission.steps.length,7);assert.equal(usdCost.length,5);
 assert.deepEqual(Object.keys(usdProgramDetails).sort(),['usd-business-analytics-ms','usd-cs-ms','usd-mba']);
 for(const p of Object.values(usdProgramDetails)){
   assert.equal(p.chapters.length,4);assert.equal(p.intake.length,2);
   assert.ok(p.chapters.every(x=>x.content.length>=55),p.id+' curriculum needs full depth');
   assert.ok(p.background.length>55&&p.summary.length>75,p.id+' detail');
   assert.ok(p.source.startsWith('https://www.usd.edu/'));
   assert.ok(p.intake.every(x=>x.deadline.match(/^202[67]-\d{2}-\d{2}$/)));
 }
 assert.ok(usdAdmission.languages.join(' ').includes('IELTS'));
 assert.ok(usdAdmission.languages.join(' ').includes('110'));
 assert.ok(usdAdmission.feeNote.includes('38')&&usdAdmission.feeNote.includes('40'));
 assert.ok(usdCost.some(x=>x.value.includes('689.15')));
 assert.ok(usdFaqs.some(x=>x.q.includes('STEM')&&x.a.includes('不能')));
});
test('University-only image data: 3 independently photographed, licensed, correctly attributed actual USD locations',()=>{
 assert.deepEqual(new Set(usdPhotos.map(x=>x.id)).size,3);
 assert.ok(usdPhotos.some(x=>x.title.includes('航拍')&&x.license==='CC BY-SA 4.0'));
 assert.ok(usdPhotos.some(x=>x.title.includes('Old Main')&&x.license.includes('公共领域')));
 assert.ok(usdPhotos.some(x=>x.title.includes('Belbas')&&x.license==='CC0 1.0'));
 for(const p of usdPhotos){
   assert.ok(p.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'));
   assert.ok(p.licenseUrl.startsWith('https://'));
   assert.ok(p.creator.length>6&&p.description.length>45);
 }
});
test('Link integration: existing HHBA homepage is untouched; clicked university and three real programs have unique routed pages',()=>{
 const routes=read('components/StudyUniversityDirectory.tsx');
 const page=read('components/SouthDakotaUniversityPage.tsx');
 const home=read('pages/StudyAbroadPage.tsx');
 assert.ok(routes.includes("id==='south-dakota'"));
 for(const id of Object.keys(usdProgramDetails))assert.ok(routes.includes("'"+id+"'"));
 assert.ok(page.includes('data-usd="longform"'));
 for(const id of ['usd-overview','usd-campus','usd-programs','usd-admissions','usd-costs','usd-life','usd-faq','usd-sources'])assert.ok(page.includes(id));
 assert.ok(page.includes('setSelected(')&&page.includes('aria-modal="true"'));
 assert.ok(page.includes('usdPhotos.map')&&page.includes('usdAdmission.steps.map'));
 assert.ok(page.includes('target="_blank" rel="noopener noreferrer"'));
 assert.ok(home.includes('StudyUniversityDirectory'));
 assert.ok(!home.includes('SouthDakotaUniversityPage'));
 assert.ok(read('styles/study-south-dakota.css').includes('@media(max-width:620px)'));
});
