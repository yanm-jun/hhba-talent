import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const guideData=read('src/data/hhbaWorkValueGuide.ts');
const rightsData=JSON.parse(read('src/data/laborRightsTopics.json'));
const guide=read('src/pages/WorkValueGuidePage.tsx');
const knowledge=read('src/pages/LegalAidLandingPage.tsx');
const routes=read('src/main.tsx');
const footer=read('src/components/Shell.tsx');
const search=read('src/services/siteSearchIndex.ts');
const css=read('src/styles/hhba-work-value-guide.css');
const records=JSON.parse(guideData.match(/export const GUIDE_TIPS:GuideTip\[\]=([\s\S]*);\s*$/)?.[1]||'null');

test('HHBA original guide contains 40 complete entries across eight workplace stages',()=>{
 assert.ok(Array.isArray(records));
 assert.equal(records.length,40);
 assert.equal(new Set(records.map(v=>v.id)).size,40);
 const stages=['before','interview','offer','pay','work','change','leave','dispute'];
 for(const stage of stages)assert.equal(records.filter(v=>v.stage===stage).length,5,stage);
 for(const tip of records){
  assert.match(tip.id,/^[a-z][a-z0-9-]+$/);
  assert.ok(tip.title.length>=8,tip.id);
  assert.ok(tip.summary.length>=15,tip.id);
  assert.equal(tip.steps.length,3,tip.id);
  assert.ok(tip.steps.every(s=>typeof s==='string'&&s.length>=8),tip.id);
  assert.match(tip.minutes,/^(5|10|15|20|30)分钟$/);
  assert.ok(['低','中'].includes(tip.effort),tip.id);
  assert.ok(['钱','时间','岗位','权益','健康','安全'].includes(tip.value),tip.id);
  assert.ok(Array.isArray(tip.keywords)&&tip.keywords.length>=2,tip.id);
 }
});

test('all law-related guide links point to existing source-backed public topics',()=>{
 assert.equal(rightsData.topics.length,8);
 const slugs=new Set(rightsData.topics.map(t=>t.slug));
 for(const tip of records)if(tip.topic!==null)assert.ok(slugs.has(tip.topic),tip.id);
 for(const topic of rightsData.topics){
  assert.ok(topic.laws.length>=1,topic.slug);
  for(const law of topic.laws)assert.match(law.url,/^https:\/\//,topic.slug);
  assert.match(topic.case.url,/^https:\/\//,topic.slug);
  assert.ok(topic.proof.length>=1&&topic.paths.length>=1,topic.slug);
 }
});

test('public route, knowledge landing, search and footer link to real pages',()=>{
 assert.match(routes,/route==='\/rights\/guide'\)return <WorkValueGuidePage user=\{user\}\/>/);
 assert.match(routes,/route==='\/rights\/knowledge'\)return <LegalAidLandingPage user=\{user\}\/>/);
 assert.ok(knowledge.includes('hhba-knowledge-search'));
 assert.ok(knowledge.includes("GUIDE_TIPS.filter"));
 assert.ok(knowledge.includes('topicMatches(topic,query)'));
 assert.ok(knowledge.includes('relatedTopics.has(tip.topic)'));
 assert.ok(knowledge.includes('本页为关键词检索，不是 AI 自动法律判断'));
 assert.ok(knowledge.includes('to="/rights/guide"'));
 assert.ok(knowledge.includes('knowledgeHref+\'/\'+topic.slug'));
 assert.doesNotMatch(knowledge,/to="\/membership\/rules"|24\.90|60%|40%|功能筹备中/);
 assert.ok(footer.includes("['高性价比职场指南','/rights/guide']"));
 assert.ok(search.includes("path:'/rights/guide'"));
 assert.ok(search.includes('for(const tip of GUIDE_TIPS)'));
});

test('guide filtering, local-only progress, article disclosure and mobile experience are implemented',()=>{
 assert.ok(guide.includes('GUIDE_TIPS.filter'));
 assert.ok(guide.includes('matchesTip(tip,query)'));
 assert.ok(guide.includes('setStage'));
 assert.ok(guide.includes('setMaxTime'));
 assert.ok(guide.includes('setOnlyPending'));
 assert.ok(guide.includes('localStorage.setItem(STORAGE_KEY'));
 assert.ok(guide.includes("new URLSearchParams(window.location.search).get('tip')"));
 assert.ok(guide.includes('to={\'/rights/knowledge/\'+tip.topic}'));
 assert.ok(guide.includes('不能替代劳动法规定或个案法律意见'));
 assert.ok(css.includes('@media(max-width:740px)'));
 assert.ok(css.includes('grid-template-columns:1fr'));
 assert.ok(css.includes(':focus-visible'));
});

test('original HHBA content does not ship a copied proprietary guide corpus',()=>{
 assert.doesNotMatch(guideData,/goodseafly|how-to-make-work-pay|576 条|CC BY-NC/);
 assert.doesNotMatch(guide,/goodseafly\.github\.io|how-to-make-work-pay/);
 assert.ok(guide.includes('本指南由 HHBA 独立撰写'));
});
