import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const source=read('../src/data/hhbaWorkValueGuide.ts');
const payload=source.match(/export const GUIDE_TIPS:GuideTip\[\]=([\s\S]+);\s*$/);
if(!payload)throw new Error('Original HHBA guide data is missing');
const tips=JSON.parse(payload[1]);
const legal=JSON.parse(read('../src/data/laborRightsTopics.json'));
const subtopics=JSON.parse(read('../src/data/laborRightsSubtopics.json'));
const subtopicDetail=read('../src/pages/LegalAidSubtopicPage.tsx');
const topicDetail=read('../src/pages/LegalAidTopicPage.tsx');
const guide=read('../src/pages/WorkValueGuidePage.tsx');
const hub=read('../src/pages/LegalAidLandingPage.tsx');
const routes=read('../src/main.tsx');
const css=read('../src/styles/hhba-work-value-guide.css');
const index=read('../src/services/siteSearchIndex.ts');
const footer=read('../src/components/Shell.tsx');

test('HHBA guide V2 has 200 actionable entries evenly distributed across eight stages',()=>{
 assert.ok(tips.length===200,'expected 200 independently written guide entries');
 assert.equal(new Set(tips.map(x=>x.id)).size,200);
 const stages=['before','interview','offer','pay','work','change','leave','dispute'];
 for(const stage of stages)assert.ok(tips.filter(x=>x.stage===stage).length===25,stage+' must have 25 actions');
 for(const tip of tips){
  assert.match(tip.id,/^[a-z]+$/);
  assert(tip.title.length>=7&&tip.summary.length>=26,tip.id+' must contain substantive copy');
  assert.equal(tip.steps.length,3,tip.id+' must give three practical actions');
  assert(tip.steps.every(x=>x.length>=12),tip.id+' must give substantive steps');
  assert(['钱','时间','岗位','权益','健康','安全'].includes(tip.value),tip.id);
  assert(/分钟$/.test(tip.minutes),tip.id+' must have a real time budget');
  assert(['低','中'].includes(tip.effort),tip.id);
  assert(tip.keywords.length>0,tip.id+' needs discoverability');
  if(tip.topic)assert([...legal.topics,...subtopics.topics].some(t=>t.slug===tip.topic),tip.id+' must point to an existing legal detail');
 }
});

test('editorial guide retains full search, advanced filters, deep links and browser-only progress',()=>{
 for(const marker of [
  "matchesTip(tip,query)","maxTime==='全部'","onlyPending",
  "GUIDE_STAGES.map((s,i)=>","selectedTip.steps.map((step,i)=>",
  "localStorage.setItem(STORAGE_KEY","mark(selectedTip.id)",
  "setVisibleCount(8)","filtered.slice(0,visibleCount)",
  "to={'/rights/knowledge/'+selectedTip.topic}",
  "getTipFromUrl","setSelectedTipId(getTipFromUrl())",
  "window.addEventListener('popstate',syncTip)",
  "hhba-edition-cover","hhba-edition-search","hhba-edition-directory",
  "hhba-edition-practical-steps","hhba-edition-next-reads",
  "hhba-edition-feature","hhba-edition-result-row",
  "浏览全部章节","继续查看","上一篇","下一篇",
  "aria-pressed={isComplete}"
 ])assert(guide.includes(marker),'edition or reader lacks '+marker);
 assert.match(guide,/return <Shell user=\{user\}>/);
 assert.match(guide,/不上传账户或服务器/);
 assert.doesNotMatch(guide,/hhba-vguide-grid|hhba-vguide-card-meta|打开具体行动步骤/);
 assert.doesNotMatch(guide,/goodseafly\.github\.io|import\([^\n]*goodseafly|fetch\([^\n]*goodseafly/);
});

test('knowledge hub searches the original authoritative eight-topic dataset without collecting case files',()=>{
 assert.equal(legal.topics.length,8);
 assert.match(hub,/laborRights\.topics\.filter\(topic=>topicMatches\(topic,query\)\)/);
 assert.match(hub,/type="search"/);
 assert.match(hub,/setQuery\(e\.target\.value\)/);
 assert.match(hub,/topic\.short/);
 assert.match(hub,/knowledgeHref\+'\/'\+topic\.slug/);
 assert.match(hub,/GUIDE_TIPS\.map/);
 assert.match(hub,/subtopics\.topics\.filter\(topic=>subtopicMatches\(topic,query\)\)/);
 assert.match(hub,/hhba-knowledge-result-list/);
 assert.match(hub,/relatedSlugs\.has\(tip\.topic\)/);
 assert.match(hub,/topicKeywords\[topic\.slug\]/);
 assert.match(hub,/\/rights\/guide\?tip=/);
 assert.match(hub,/本页使用关键词和常见说法匹配，只用于查找资料，不会自动判断是否违法/);
 for(const term of ['工资','加班','社保','离职证明','调岗'])assert(hub.includes(term));
 assert.doesNotMatch(hub,/to="\/membership\/rules"|input type="file"|<form|fetch\(|navigator\.sendBeacon/);
});

test('two routes and global search are public, while other HHBA product modules are intact',()=>{
 assert.match(routes,/route==='\/rights\/guide'/);
 assert.match(routes,/route==='\/rights\/knowledge'/);
 assert.match(index,/id:'work-value-guide'/);
 assert.match(index,/GUIDE_TIPS/);
 assert.match(index,/guide:'\+tip\.id/);
 assert.match(footer,/\['高性价比职场指南','\/rights\/guide'\]/);
 assert.match(css,/\.hhba-edition-article-layout\{display:grid/);
 assert.match(css,/@media\(max-width:740px\)/);
 assert.match(css,/\.hhba-rights-knowledge/);
 assert.match(css,/:focus-visible/);
 assert.match(routes,/route==='\/companies\/library'/);
 assert.match(routes,/route==='\/transparency'/);
});

test('twelve new subtopics extend eight full topics to twenty without fake case claims',()=>{
 assert.equal(legal.topics.length,8);
 assert.equal(subtopics.topics.length,12);
 assert.equal(new Set([...legal.topics,...subtopics.topics].map(t=>t.slug)).size,20);
 for(const topic of subtopics.topics){
  assert(legal.topics.some(v=>v.slug===topic.parentSlug),topic.slug+' must link to a full source-backed topic');
  assert.equal(topic.situations.length,3);
  assert.equal(topic.laws.length,2);
  assert.equal(topic.proof.length,3);
  assert.equal(topic.paths.length,3);
  assert.equal(topic.misconceptions.length,2);
  assert(topic.laws.every(l=>l.url.startsWith('https://')),topic.slug);
  assert.equal(topic.contentType,'independently_written_guidance_without_individual_case');
  assert.equal(Object.hasOwn(topic,'case'),false,'no fake case for '+topic.slug);
 }
 assert.match(topicDetail,/subtopics\.topics\.find\(t=>t\.slug===slug\)/);
 assert.match(topicDetail,/LegalAidSubtopicPage user=\{user\}/);
 for(const token of ['topic.laws.map','topic.proof.map','topic.paths.map','topic.misconceptions.map','topic.parentSlug','不使用模拟案例'])assert(subtopicDetail.includes(token),token);
 assert.doesNotMatch(subtopicDetail,/input type="file"|<form|<textarea|fetch\(|localStorage/);
});

