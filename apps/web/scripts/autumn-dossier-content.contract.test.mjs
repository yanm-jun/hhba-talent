import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=p=>JSON.parse(readFileSync(p,'utf8'));
const roster=load('src/data/domesticAutumnScreenshot20261028.json').entries;
const a=load('src/data/domesticAutumnBusinessDraft001.json').entries;
const b=load('src/data/domesticAutumnBusinessDraft002.json').entries;
const history=load('src/data/domesticAutumnMilestonesVerified20261029.json').entries;
const source=readFileSync('src/pages/AutumnCompanyProfilePage.tsx','utf8');
const scope={...a,...b};
assert.equal(roster.length,156);
assert.equal(Object.keys(scope).length,156,'Every employer has a distinct editorial business scope');
assert.equal(new Set(roster.map(e=>e.id)).size,156);
assert.deepEqual(Object.keys(scope).sort(),roster.map(e=>e.id).sort(),'No swapped employer business IDs');
for(const employer of roster){
 const x=scope[employer.id];
 assert(x.reviewLevel==='editorial_business_scope_requires_source_check','Unverified business scope cannot masquerade as official');
 assert(x.business.length>=2&&x.business.length<=5,'Need distinct useful business areas for '+employer.name);
 const titles=new Set();
 for(const card of x.business){
  assert(typeof card.title==='string'&&card.title.length>=2,employer.name+' missing business title');
  assert(typeof card.description==='string'&&card.description.length>=8,employer.name+' missing business details');
  assert(!titles.has(card.title),'Duplicate business title '+employer.name);
  titles.add(card.title);
 }
}
assert.equal(Object.keys(history).length,26);
let events=0;
for(const [id,v] of Object.entries(history)){
 assert(scope[id],id+' source-backed timeline has no company');
 assert(v.businessSource.startsWith('https://'),'Must have documented source');
 assert(v.milestones.length>0,id+' timeline empty');
 const dates=new Set();
 for(const m of v.milestones){
  assert(/^\d{4}$/.test(m.date),'Date must be unambiguous year');
  assert(+m.date<=2026,'Never show future history');
  assert(m.description.length>=10,'Timeline must have a real meaningful event');
  assert(m.source===v.businessSource,'Each item must point to reviewed source');
  assert(!dates.has(m.date),'Duplicate date '+id);
  dates.add(m.date);
  events++;
 }
}
assert.equal(events,74);
assert(source.includes('businessDraftA.entries')&&source.includes('businessDraftB.entries'));
assert(source.includes('documentedHistories'));
assert(source.includes('editorial?.business?.length?editorial.business:businessDraft?.business||[]'),'Prefer existing vetted deep business descriptions');
assert(source.includes('data-hhba-recruitment-outbound="true"'),'Protect outbound official recruitment');
assert(!source.includes('AutumnIndustryReferenceGallery'),'No industry stock photos');
console.log('AUTUMN_DOSSIER_SCOPE_156_AND_SOURCED_HISTORY_26_COMPANIES_74_EVENTS_OK');
