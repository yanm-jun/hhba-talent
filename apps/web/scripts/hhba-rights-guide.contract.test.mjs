import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const source=read('../src/data/hhbaWorkValueGuide.ts');
const payload=source.match(/export const GUIDE_TIPS:GuideTip\[\]=([\s\S]+);\s*$/);
if(!payload)throw new Error('Original HHBA guide data is missing');
const tips=JSON.parse(payload[1]);
const legal=JSON.parse(read('../src/data/laborRightsTopics.json'));
const guide=read('../src/pages/WorkValueGuidePage.tsx');
const hub=read('../src/pages/LegalAidLandingPage.tsx');
const routes=read('../src/main.tsx');
const css=read('../src/styles/hhba-work-value-guide.css');
const index=read('../src/services/siteSearchIndex.ts');
const footer=read('../src/components/Shell.tsx');

test('original HHBA guide has 40 actionable entries evenly distributed across 8 relevant stages',()=>{
 assert.equal(tips.length,40);
 assert.equal(new Set(tips.map(x=>x.id)).size,40);
 const stages=['before','interview','offer','pay','work','change','leave','dispute'];
 for(const stage of stages)assert.equal(tips.filter(x=>x.stage===stage).length,5,stage);
 for(const tip of tips){
  assert.match(tip.id,/^[a-z]+$/);
  assert(tip.title.length>=7&&tip.summary.length>=26,tip.id+' must contain substantive copy');
  assert.equal(tip.steps.length,3,tip.id+' must give three practical actions');
  assert(tip.steps.every(x=>x.length>=12),tip.id+' must give substantive steps');
  assert(['钱','时间','岗位','权益','健康','安全'].includes(tip.value),tip.id);
  assert(/分钟$/.test(tip.minutes),tip.id+' must have a real time budget');
  assert(['低','中'].includes(tip.effort),tip.id);
  assert(tip.keywords.length>0,tip.id+' needs discoverability');
  if(tip.topic)assert(legal.topics.some(t=>t.slug===tip.topic),tip.id+' must point to an existing legal detail');
 }
});

test('full value-guide page has functional filtering, real details and locally saved checkboxes',()=>{
 for(const x of [
  'useMemo(()=>GUIDE_TIPS.filter','matchesTip(tip,query)',
  'maxTime===\'全部\'','onlyPending','onClick={()=>setStage(s.id)}',
  'tip.steps.map','<details','<summary','<ol>',
  'readCompleted','localStorage.setItem(STORAGE_KEY','onChange={()=>mark(tip.id)}',
  "to={'/rights/knowledge/'+tip.topic}"
 ])assert(guide.includes(x),'guide lacks '+x);
 assert.match(guide,/return <Shell user=\{user\}>/);
 assert.match(guide,/不上传账户或服务器/);
 assert.doesNotMatch(guide,/goodseafly\.github\.io|import\([^\n]*goodseafly|fetch\([^\n]*goodseafly/);
});

test('knowledge hub searches the original authoritative eight-topic dataset without collecting case files',()=>{
 assert.equal(legal.topics.length,8);
 assert.match(hub,/laborRights\.topics\.filter\(topic=>topicMatches\(topic,query\)\)/);
 assert.match(hub,/type="search"/);
 assert.match(hub,/setQuery\(e\.target\.value\)/);
 assert.match(hub,/topic\.short/);
 assert.match(hub,/knowledgeHref\+'\/'\+topic\.slug/);
 assert.match(hub,/GUIDE_TIPS\.filter/);
 assert.match(hub,/relatedSlugs\.has\(tip\.topic\)/);
 assert.match(hub,/topicKeywords\[topic\.slug\]/);
 assert.match(hub,/\/rights\/guide\?tip=/);
 assert.match(hub,/本页为关键词检索，不是 AI 自动法律判断/);
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
 assert.match(css,/\.hhba-vguide-grid\{display:grid/);
 assert.match(css,/@media\(max-width:740px\)/);
 assert.match(css,/\.hhba-rights-knowledge/);
 assert.match(css,/:focus-visible/);
 assert.match(routes,/route==='\/companies\/library'/);
 assert.match(routes,/route==='\/transparency'/);
});
