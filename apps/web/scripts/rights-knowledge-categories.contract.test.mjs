import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const groups=JSON.parse(read('src/data/laborRightsBrowseGroups.json'));
const main=JSON.parse(read('src/data/laborRightsTopics.json'));
const detailed=JSON.parse(read('src/data/laborRightsSubtopics.json'));
const landing=read('src/pages/LegalAidLandingPage.tsx');
const styles=read('src/styles/hhba-work-value-guide.css');

test('six simple categories cover every one of the twenty real legal topics exactly once',()=>{
 assert.equal(groups.schemaVersion,1);
 assert.equal(groups.groups.length,6);
 assert.deepEqual(groups.groups.map(g=>g.label),[
  '工资与报酬','劳动合同','辞退与离职','社保与工伤','加班与休假','调岗与劳动争议'
 ]);
 const actual=groups.groups.flatMap(group=>group.topics.map(t=>t.slug));
 const expected=[...main.topics,...detailed.topics].map(t=>t.slug);
 assert.equal(actual.length,20);
 assert.equal(new Set(actual).size,20,'Every detailed or full topic must appear in exactly one group');
 assert.deepEqual(actual.slice().sort(),expected.slice().sort(),'A real topic must never disappear from the simpler homepage');
 assert(groups.groups.every(g=>g.topics.length>=2&&g.topics.length<=5));
 for(const group of groups.groups){
  assert(group.topics.every(t=>t.question.length>=9&&t.question.endsWith('？')),
   group.label+' requires short, concrete user-phrased questions');
 }
});

test('knowledge landing has searchable issue rows, accessible category buttons and concise design',()=>{
 assert.match(landing,/browseData\.groups\.map/);
 assert.match(landing,/onClick=\{\(\)=>setCategory\(group\.id\)\}/);
 assert.match(landing,/aria-pressed=\{group\.id===selectedGroup\.id\}/);
 assert.match(landing,/aria-controls="hhba-knowledge-results"/);
 assert.match(landing,/const \[category,setCategory\]=useState\('salary'\)/);
 assert.match(landing,/const isSearching=normal\(query\)\.length>0/);
 assert.match(landing,/visibleTopics\.map/);
 assert.match(landing,/knowledgeHref\+'\/'\+topic\.slug/);
 assert.match(landing,/aria-live="polite"/);
 for(const s of [
  '你遇到了什么职场问题？','按问题分类','相关问题','搜索结果','hhba-knowledge-result-list',
  'hhba-knowledge-guide-mini','建议下一步','高性价比职场指南',
  '本地检索','不上传你的问题'
 ])assert(landing.includes(s),'Missing required navigation or information: '+s);
 for(const legacy of ['劳动权益深度专题 ·','劳动权益细分专题 ·','hhba-knowledge-subtopic-grid',
   '了解劳动权益，从可靠的依据开始。']){
  assert(!landing.includes(legacy),'The confusing old twenty-card layout should not be visible: '+legacy);
 }
 assert.match(styles,/\.hhba-knowledge-category-grid\{display:grid;grid-template-columns:repeat\(2/);
 assert.match(styles,/\.hhba-knowledge-category-grid\{grid-template-columns:1fr/);
 assert.match(styles,/\.hhba-knowledge-result-list\{border/);
 assert.match(styles,/:focus-visible/);
 assert.doesNotMatch(landing,/<textarea|input type="file"|navigator\.sendBeacon|onSubmit=/);
});

test('all twenty detail URLs remain accessible through current public router',()=>{
 const routes=read('src/main.tsx');
 assert.match(routes,/route==='\/rights\/knowledge'/);
 assert.match(routes,/supportedLaborTopicSlugs/);
 assert.match(routes,/route==='\/rights\/guide'/);
});
