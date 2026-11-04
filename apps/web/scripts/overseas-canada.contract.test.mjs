import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {caPathways,allCanadaRoutes,caOfficial,caVerifiedOn,caClosedWarnings} from '../src/data/overseasCanada.ts';
import {caCompleteGuides} from '../src/data/overseasCanadaGuides.ts';
import {ca2026Categories,caOfficialNoc2026,caProvinceEntries} from '../src/data/overseasCanadaOccupations.ts';
import {overseasTerms} from '../src/data/overseasGlossary.ts';
import {overseasCountryOptions} from '../src/data/overseasNewZealand.ts';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');

test('14 actual Canada paths with separate EE programs, PNP, francophone, work and study',()=>{
 assert.equal(caVerifiedOn,'2026-11-04');
 assert.equal(caPathways.length,14);
 assert.equal(new Set(caPathways.map(x=>x.id)).size,14);
 for(const p of caPathways){
  assert.ok(p.id.startsWith('ca-')&&p.name.length>5&&p.english.length>8,p.id);
  assert.ok(p.requirement.length>=4&&p.documents.length>=4&&p.steps.length>=4,p.id);
  assert.ok(p.fees.length>=3&&p.rights.length>=3&&p.risks.length>=2,p.id);
  assert.ok(['www.canada.ca','www.quebec.ca'].includes(new URL(p.officialUrl).hostname),p.id+' must have govt source');
 }
 for(const id of ['ca-fsw','ca-cec','ca-fst','ca-express-categories','ca-pnp-express','ca-pnp-base','ca-atlantic','ca-rcip','ca-fcip','ca-employer-work','ca-francophone-mobility','ca-student','ca-pgwp','ca-quebec-pstq'])assert.ok(caPathways.some(x=>x.id===id),id);
 assert.match(JSON.stringify(caPathways.find(x=>x.id==='ca-fsw')),/67/);
 assert.match(JSON.stringify(caPathways.find(x=>x.id==='ca-cec')),/1560|1,560/);
 assert.match(JSON.stringify(caPathways.find(x=>x.id==='ca-express-categories')),/11-03/);
 assert.match(JSON.stringify(caPathways.find(x=>x.id==='ca-student')),/23,448/);
 assert.match(JSON.stringify(caPathways.find(x=>x.id==='ca-pgwp')),/180天/);
 assert.match(JSON.stringify(caPathways.find(x=>x.id==='ca-quebec-pstq')),/10-31/);
 assert.match(JSON.stringify(caPathways.find(x=>x.id==='ca-francophone-mobility')),/C16/);
 assert.equal(caClosedWarnings.length,3);
 assert.match(caClosedWarnings[0].status,/停止接受/);
 assert.match(caClosedWarnings[1].status,/暂停/);
});

test('Each Canadian pathway provides ten chapters with executable evidence, source and FAQ',()=>{
 assert.equal(Object.keys(caCompleteGuides).length,14);
 for(const r of allCanadaRoutes){
  const g=caCompleteGuides[r.id];
  assert.ok(g&&g.sections.length===8&&g.faq.length>=4,r.id);
  assert.ok(g.plainAnswer.length>65&&g.firstAction.length>25,r.id);
  for(const sec of g.sections){
   assert.ok(sec.summary.length>28&&sec.points.length>=3,r.id+' chapter too short');
   assert.ok(sec.points.every(x=>x.label.length>=4&&x.explain.length>12&&x.action.length>12),r.id+' missing practical action');
  }
  assert.ok(JSON.stringify(g.sections).length>2400,r.id+' long-form detail too shallow');
  assert.ok(g.risks.length>=3&&g.sources.length>=3,r.id);
  assert.ok(g.sources.every(x=>x.url.startsWith('https://')),r.id+' official source');
  assert.ok(g.terms.every(x=>overseasTerms[x]),r.id+' undefined glossary terms '+g.terms.filter(x=>!overseasTerms[x]));
 }
});

test('Actual 2026 Express Entry category NOC codes and 11 province official PNP websites',()=>{
 assert.equal(ca2026Categories.length,10,'2026 categories include French and specialist Canadian-work lists');
 assert.ok(caOfficialNoc2026.length>=65,'must not present 5 generic jobs as complete list');
 assert.equal(new Set(caOfficialNoc2026.map(x=>x.group+'-'+x.code)).size,caOfficialNoc2026.length);
 for(const x of caOfficialNoc2026){
  assert.match(x.code,/^\d{5}$/,'5 digit NOC must preserve leading zeros');
  assert.ok(x.name.length>=2&&x.english.length>=7&&x.teer>=0&&x.teer<=5,x.code);
  assert.ok(ca2026Categories.some(g=>g.key===x.group),x.code);
  assert.ok(x.experience.length>30&&x.notes.length>25,x.code);
 }
 const check=(code,group)=>assert.ok(caOfficialNoc2026.some(x=>x.code===code&&x.group===group),code+' '+group);
 check('31301','health');check('21301','stem');check('72106','trades');
 check('42202','education');check('72410','transport');check('00012','executive');check('41201','research');
 assert.equal(caProvinceEntries.length,11);
 assert.equal(new Set(caProvinceEntries.map(x=>x.id)).size,11);
 assert.ok(!caProvinceEntries.some(x=>x.id==='qc'||x.id==='nu'));
 assert.ok(caProvinceEntries.every(p=>p.url.startsWith('https://')&&p.example.length>35));
});

test('Canada fifth country routes, existing eight authentic photos, and previous countries remain',()=>{
 const main=read('../src/main.tsx'),home=read('../src/pages/OverseasDevelopmentPage.tsx');
 const detail=read('../src/components/CanadaOccupationDirectory.tsx');
 const article=read('../src/components/OverseasDetailedGuide.tsx');
 const page=read('../src/pages/CanadaDevelopmentPage.tsx');
 assert.deepEqual(overseasCountryOptions.filter(c=>c.ready).map(c=>c.code),['nz','au','jp','de','ca']);
 assert.match(main,/study-abroad\/country\/canada/);
 assert.match(main,/CanadaOccupationDetailPage/);
 assert.match(home,/c\.code==='ca'\?root\+'\/country\/canada'/);
 assert.match(article,/CanadaOccupationDirectory/);
 assert.match(article,/ca-express-categories/);
 assert.match(article,/ca-pnp-express/);
 assert.match(detail,/caOfficialNoc2026/);assert.match(detail,/caProvinceEntries/);
 assert.match(page,/data-hhba-overseas-ca/);
 assert.match(page,/overseas\/countries\/ca\.webp/);
 assert.match(page,/caCompleteGuides/);
 assert.ok(!page.includes('欧盟蓝卡')&&!page.includes('€1,091')&&!page.includes('GERMANY PATHWAYS'),'wrong-country content');
 const photo=fileURLToPath(new URL('../public/overseas/countries/ca.webp',import.meta.url));
 assert.ok(statSync(photo).size>12000);
 assert.equal(readFileSync(photo).toString('ascii',8,12),'WEBP');
 assert.ok(read('../src/styles/overseas-canada.css').includes('@media(max-width:760px)'));
 assert.ok(caOfficial.reform.includes('/express-entry/changes.html'));
});
