import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {minotAdmissions,minotCampusSections,minotFacts,minotFAQs,minotPhotos,minotPrograms,minotSources,minotTuitionRows} from '../src/data/studyMinotState.ts';
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
test('01 Minot State real longform: four deep sections, 2 program curricula, admissions and 6 FAQs',()=>{
 assert.equal(minotFacts.length,6);
 assert.equal(minotCampusSections.length,4);
 assert.equal(minotPhotos.length,3);
 assert.equal(minotFAQs.length,6);
 assert.equal(minotAdmissions.documents.length,7);
 assert.equal(minotTuitionRows.length,4);
 assert.equal(Object.keys(minotPrograms).length,2);
 for(const p of Object.values(minotPrograms)){
  assert.equal(p.curriculum.length,4);
  assert.ok(p.curriculum.every(x=>x.body.length>35));
  assert.ok(p.eligibility.length>45&&p.suitability.length>40);
 }
 assert.ok(minotPrograms['minot-management-ms'].deadlines.length>=2);
 assert.ok(minotPrograms['minot-cyber-ms'].deadlines.length===1);
 assert.ok(minotAdmissions.english.join('').includes('79'));
 assert.ok(minotAdmissions.english.join('').includes('6.0'));
 assert.ok(minotAdmissions.english.join('').includes('105'));
 assert.ok(minotAdmissions.general.includes('2.75'));
 assert.ok(minotTuitionRows.some(x=>x.value==='US$20,641'));
 assert.ok(minotTuitionRows.every(x=>x.tip.length>20));
});
test('Risk accuracy: cyber is NOT presented as an F-1 eligible on-campus program',()=>{
 const cyber=minotPrograms['minot-cyber-ms'];
 const management=minotPrograms['minot-management-ms'];
 assert.ok(cyber.flag.includes('未列入')&&cyber.flag.includes('I-20'));
 assert.ok(management.flag.includes('Management')&&management.flag.includes('I-20'));
 assert.ok(minotFAQs.find(x=>x.q.includes('网络安全'))?.a.includes('不建议'));
 assert.ok(minotFAQs.find(x=>x.q.includes('20,641'))?.a.includes('不是'));
 assert.ok(cyber.suitability.includes('确认'));
});
test('Rights-aware gallery: 3 independent photographs of actual Old Main, with per-photo sources',()=>{
 assert.equal(new Set(minotPhotos.map(p=>p.file)).size,3);
 assert.equal(new Set(minotPhotos.map(p=>p.creator)).size,3);
 for(const p of minotPhotos){
  assert.ok(p.file.endsWith('.jpg'));
  assert.ok(p.sourceUrl.startsWith('https://'));
  assert.ok(p.licenseUrl.startsWith('https://'));
  assert.ok(p.creator.length>4&&p.license.length>6&&p.credit.length>10);
  assert.ok(p.title.includes('Old Main'));
 }
 assert.ok(minotPhotos.some(p=>p.sourceUrl.includes('loc.gov')&&p.license.includes('Public domain')));
 assert.equal(minotPhotos.filter(p=>p.license==='CC BY-SA 3.0').length,2);
});
test('First-party source coverage and original HHBA integration without main-home redesign',()=>{
 assert.ok(Object.values(minotSources).length>=12);
 for(const v of Object.values(minotSources))assert.ok(v.url.startsWith('https://www.minotstateu.edu/')||v.url.startsWith('https://catalog.minotstateu.edu/'),v.label);
 const component=read('components/MinotStateUniversityPage.tsx');
 const router=read('components/StudyUniversityDirectory.tsx');
 const workflow=read('../../../.github/workflows/hhba-github-pages-preview.yml');
 const css=read('styles/study-minot-state.css');
 for(const section of ['minot-overview','minot-campus','minot-programs','minot-admissions','minot-cost','minot-life','minot-faq','minot-sources']) assert.ok(component.includes(section));
 assert.ok(router.includes("if(id==='minot-state')return <MinotStateUniversityPage user={user}/>"));
 assert.ok(router.includes("id==='minot-management-ms'||id==='minot-cyber-ms'"));
 assert.ok(component.includes('role="dialog" aria-modal="true"'));
 assert.ok(component.includes('href={p.sourceUrl}'));
 assert.ok(component.includes('imagePath(item.file)'));
 assert.ok(component.includes('minotTuitionRows.map'));
 assert.ok(component.includes('minotAdmissions.documents.map'));
 assert.ok(css.includes('@media(max-width:690px)'));
 for(const p of minotPhotos)assert.ok(workflow.includes(p.file));
 assert.ok(workflow.includes('node scripts/minot-state.browser.mjs'));
 assert.ok(!read('pages/HomePage.tsx').includes('MinotStateUniversityPage'));
});
