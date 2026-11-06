import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {ukRoutes,ukPathways,ukRouteById,ukOfficial,ukVerifiedOn} from '../src/data/overseasUK.ts';
import {ukCompleteGuides} from '../src/data/overseasUKGuides.ts';
import {overseasCountryOptions} from '../src/data/overseasNewZealand.ts';
import {overseasTerms} from '../src/data/overseasGlossary.ts';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const ids=['uk-skilled-worker','uk-health-care','uk-student','uk-graduate','uk-global-talent','uk-hpi','uk-scale-up','uk-innovator','uk-seasonal','uk-creative-worker','uk-gov-exchange','uk-senior-specialist','uk-family-partner','uk-youth-mobility','uk-global-business-graduate-trainee'];

test('UK 2026 has 15 independent official pathways, stable IDs and no invented availability',()=>{
 assert.equal(ukVerifiedOn,'2026-11-06');
 assert.equal(ukRoutes.length,15);
 assert.equal(ukPathways.length,15);
 assert.deepEqual(ukPathways.map(r=>r.id),ids);
 assert.equal(new Set(ukRoutes.map(x=>x.id)).size,15);
 assert.equal(Object.keys(ukRouteById).length,15);
 assert.equal(Object.keys(ukOfficial).length>=40,true);
 for(const r of ukRoutes){
  assert.equal(ukRouteById[r.id],r);
  assert.ok(r.name.length>=6&&r.english.length>=8&&r.summary.length>=30,r.id);
  assert.ok(r.requirements.length>=3&&r.documents.length>=3&&r.steps.length>=3,r.id);
  assert.ok(r.costs.length>=3&&r.time.length>=3&&r.rights.length>=3&&r.next.length>=3,r.id);
  assert.ok(r.faq.length>=2&&r.risks.length>=2&&r.sourceKeys.length>=3,r.id);
  for(const key of r.sourceKeys)assert.equal(new URL(ukOfficial[key]).hostname,'www.gov.uk',key);
  for(const group of [r.requirements,r.documents,r.steps,r.costs,r.time,r.rights,r.next]){
   for(const [label,explain,action] of group)assert.ok(label.length>4&&explain.length>10&&action.length>8,r.id+' must have independently actionable content');
  }
  const x=ukPathways.find(x=>x.id===r.id);
  assert.equal(x.availability,r.availability||'check-official');
  assert.ok(x.officialUrl.startsWith('https://www.gov.uk/'),r.id);
 }
 assert.equal(ukRouteById['uk-youth-mobility'].availability,'closed','China-mainland-only warning must be explicit');
 assert.ok(ukPathways.filter(r=>r.availability==='closed').length===1);
});

test('All UK guides have complete eight-subject chapters, 3+ useful points, FAQs, risks and sources',()=>{
 assert.equal(Object.keys(ukCompleteGuides).length,15);
 for(const r of ukRoutes){
  const g=ukCompleteGuides[r.id];
  assert.ok(g,r.id);
  assert.equal(g.checkedAt,ukVerifiedOn,r.id);
  assert.equal(g.sections.length,8,r.id);
  assert.ok(g.plainAnswer.length>45&&g.firstAction.length>15,r.id);
  for(const chapter of g.sections){
   assert.ok(chapter.title.length>=8&&chapter.summary.length>15&&chapter.points.length>=3,r.id+' incomplete chapter');
   assert.ok(chapter.points.every(p=>p.label.length>=4&&p.explain.length>10&&p.action.length>8),r.id+' missing useful action');
  }
  assert.ok(g.faq.length>=4&&g.risks.length>=3&&g.sources.length>=3,r.id);
  assert.ok(g.sources.every(s=>s.label&&s.purpose&&new URL(s.url).hostname==='www.gov.uk'),r.id);
  assert.ok(g.terms.every(t=>overseasTerms[t]),r.id+' glossary missing '+g.terms.filter(t=>!overseasTerms[t]));
  assert.ok(JSON.stringify(g.sections).length>2500,r.id+' guide should be substantive');
 }
});

test('Critical 2026 UK safeguards must not revert to inaccurate immigration claims',()=>{
 const skilled=JSON.stringify(ukCompleteGuides['uk-skilled-worker']);
 const healthcare=JSON.stringify(ukCompleteGuides['uk-health-care']);
 const student=JSON.stringify(ukCompleteGuides['uk-student']);
 const graduate=JSON.stringify(ukCompleteGuides['uk-graduate']);
 const hpi=JSON.stringify(ukCompleteGuides['uk-hpi']);
 const creative=JSON.stringify(ukCompleteGuides['uk-creative-worker']);
 const youth=JSON.stringify(ukCompleteGuides['uk-youth-mobility']);
 const trainee=JSON.stringify(ukCompleteGuides['uk-global-business-graduate-trainee']);
 assert.match(skilled,/41,700/);
 assert.match(skilled,/B2/);
 assert.match(skilled,/going rate/);
 assert.match(healthcare,/2025年7月22日/);
 assert.match(healthcare,/海外/);
 assert.match(student,/1,529/);
 assert.match(student,/1,171/);
 assert.match(student,/CAS/);
 assert.match(graduate,/2027年1月1日/);
 assert.match(graduate,/18个月/);
 assert.match(hpi,/毕业年份|授予日期|授予学位|授予当年/);
 assert.match(hpi,/8000|8,000/);
 assert.match(creative,/中国普通护照/);
 assert.match(youth,/中国大陆普通护照/);
 assert.match(trainee,/27,300/);
 assert.match(trainee,/3个月/);
 assert.ok(ukPathways.some(r=>r.id==='uk-family-partner'));
});

test('Existing UK photo/country card, clickable frontend route and legacy five countries are preserved',()=>{
 const main=read('../src/main.tsx'),homepage=read('../src/pages/OverseasDevelopmentPage.tsx');
 const page=read('../src/pages/UKDevelopmentPage.tsx'),css=read('../src/styles/overseas-uk.css');
 assert.ok(main.includes("import { UKDevelopmentPage } from './pages/UKDevelopmentPage'"));
 for(const url of ['/study-abroad/country/united-kingdom','/study-abroad/uk/saved','/study-abroad/uk/compare','/study-abroad/uk/match','/study-abroad/uk/pathway/'])assert.ok(main.includes(url),url);
 assert.ok(homepage.includes("c.code==='uk'?root+'/country/united-kingdom'"),'UK card must not fall back to generic old study-abroad page');
 assert.ok(overseasCountryOptions.find(c=>c.code==='uk'&&c.ready));
 for(const code of ['nz','au','jp','de','ca'])assert.ok(overseasCountryOptions.some(c=>c.code===code&&c.ready),code);
 assert.ok(page.includes('ukCompleteGuides')&&page.includes('ukPathways'));
 assert.ok(page.includes('overseas/countries/uk.webp'));
 assert.ok(page.includes('https://commons.wikimedia.org/wiki/File:Westminster_Palace_and_Big_Ben.jpg'));
 assert.ok(page.includes('ukOfficial.sponsors')&&page.includes('ukOfficial.rates'));
 assert.ok(page.includes('data-hhba-overseas-uk'));
 assert.ok(page.includes('hhba.overseas.uk.favourites.v1'));
 assert.ok(page.includes('hhba.overseas.uk.compare.v1'));
 assert.ok(css.includes('@media(max-width:760px)'));
 const photo=fileURLToPath(new URL('../public/overseas/countries/uk.webp',import.meta.url));
 assert.ok(statSync(photo).size>8000,'UK image must be real self-hosted file');
 assert.equal(readFileSync(photo).toString('ascii',8,12),'WEBP');
});
