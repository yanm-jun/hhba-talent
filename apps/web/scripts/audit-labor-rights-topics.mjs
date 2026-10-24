import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const json=JSON.parse(readFileSync('src/data/laborRightsTopics.json','utf8'));
const expected=[
 'unpaid-wages','unlawful-dismissal','overtime-leave','labor-contracts',
 'social-insurance','work-injury','transfer-paycuts','flexible-work'];
assert.equal(json.schemaVersion,1);
assert.deepEqual(json.topics.map(t=>t.slug),expected,'Eight legal routes remain stable');
const urls=new Set();
for(const topic of json.topics){
 assert(topic.title.length>=4,topic.slug+' short title');
 assert(topic.situations.length>=3,topic.slug+' needs specific example situations');
 assert(topic.laws.length>=2,topic.slug+' needs multiple law bases');
 for(const law of topic.laws){
  assert(law.name&&/第\d+/.test(law.articles),topic.slug+' needs article-level basis');
  assert(law.summary.length>=25,topic.slug+' needs independent interpretation');
  assert(/^https:\/\/(www\.(court|mohrss|samr)\.gov\.cn|fgk\.chinatax\.gov\.cn|know\.12348\.gov\.cn)\//.test(law.url),topic.slug+' law link must be approved official authority '+law.url);
  urls.add(law.url);
 }
 assert(topic.proof.length>=3,topic.slug+' requires three proof objectives');
 for(const objective of topic.proof){
  assert(objective.fact.length>=6&&objective.note.length>=25,topic.slug+' proof purpose and note missing');
  assert(objective.materials.length>=3,topic.slug+' material examples missing');
 }
 assert(topic.paths.length>=3,topic.slug+' actionable legal pathways incomplete');
 for(const action of topic.paths)assert(action.description.length>=30,topic.slug+' process must be specific');
 assert(topic.case.title.length>=10&&topic.case.facts.length>=35,topic.slug+' actual case facts missing');
 assert(topic.case.outcome.length>=35&&topic.case.lesson.length>=30,topic.slug+' judgment/result and limits missing');
 assert(/^https:\/\/www\.court\.gov\.cn\//.test(topic.case.url),topic.slug+' case must cite official court source');
 assert(topic.special.length>=40,topic.slug+' needs outcome constraints');
}
assert.equal(new Set(json.topics.map(t=>t.slug)).size,8);
assert(urls.size>=5,'Insufficient independently checked legal sources');
const landing=readFileSync('src/pages/LegalAidLandingPage.tsx','utf8');
const detail=readFileSync('src/pages/LegalAidTopicPage.tsx','utf8');
const router=readFileSync('src/main.tsx','utf8');
for(const slug of expected)assert(landing.includes(slug),'Homepage must link '+slug);
assert(router.includes("if(/^\\/candidate\\/account\\/legal-aid\\/"),'Missing guarded deep link route');
for(const selector of ['topic.laws.map','topic.proof.map','topic.paths.map','topic.case.outcome','topic.case.url'])
 assert(detail.includes(selector),'Legal detail misses '+selector);
for(const forbidden of ['input type="file"','<textarea','<form','fetch(','localStorage','sessionStorage','navigator.sendBeacon'])
 assert(!detail.includes(forbidden),'Case pages must not collect/transmit personal data: '+forbidden);
console.log('HHBA_LABOR_RIGHTS_GUIDES_OK',JSON.stringify({
 topics:expected.length,lawCitations:json.topics.reduce((n,t)=>n+t.laws.length,0),
 evidenceObjectives:json.topics.reduce((n,t)=>n+t.proof.length,0),
 realOfficialCases:json.topics.filter(t=>t.case.url.includes('court.gov.cn')).length,
 legalSources:urls.size,liveCaseIntake:false
}));
