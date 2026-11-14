import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const guide=JSON.parse(read('../src/data/majorHallGuide.json'));
const manifest=JSON.parse(read('../public/recruitment-library/v1/manifest.json'));
const explorer=read('../src/pages/MajorHallExplorer.tsx');
const library=read('../src/pages/IndustryLibraryPage.tsx');
const main=read('../src/main.tsx');
const router=read('../src/router.tsx');
const css=read('../src/styles/industry-library.css');
const majors=guide.groups.flatMap(g=>g.majors);
const hallIds=new Set(manifest.halls.map(h=>h.id));

test('professional-to-industry mapping stays explicit, unique, and limited to real halls',()=>{
 assert.equal(guide.kind,'HHBA_MAJOR_HALL_GUIDE_V1');
 assert.equal(guide.groups.length,12);
 assert.equal(majors.length,102);
 assert.equal(new Set(majors).size,majors.length);
 for(const g of guide.groups){
  assert.ok(g.id&&g.label&&g.majors.length>0);
  assert.ok(g.halls.length>=4&&g.halls.length<=9);
  assert.equal(new Set(g.halls).size,g.halls.length);
  for(const id of g.halls)assert.ok(hallIds.has(id),g.id+' incorrectly recommends '+id);
 }
 assert.ok(guide.groups.find(g=>g.majors.includes('计算机科学与技术')).halls.includes('automotive'));
 assert.ok(guide.groups.find(g=>g.majors.includes('计算机科学与技术')).halls.includes('finance'));
 assert.ok(guide.groups.find(g=>g.majors.includes('会计学')).halls.includes('internet-ai'));
 assert.ok(guide.groups.find(g=>g.majors.includes('舞蹈学')).halls.includes('culture-media'));
});

test('cross-industry explorer loads only selected static halls; no D1 / AI dependency',()=>{
 assert.ok(explorer.includes("fetch(ROOT+id+'.json'"));
 assert.ok(explorer.includes("hallCache.get(manifest.asOf+'|'+id)"));
 assert.ok(explorer.includes('Promise.all(work)'));
 assert.ok(explorer.includes('data.asOf!==manifest.asOf'));
 assert.ok(explorer.includes('controller.abort()'));
 assert.ok(!explorer.includes('hhba_industry_employer_links'));
 assert.ok(!explorer.includes('openai.com'));
 assert.ok(!explorer.includes('/api/match'));
 assert.ok(!explorer.includes('/admin-preview/api/library'));
});

test('professional exploration never claims job matching or current openings',()=>{
 assert.match(guide.description,/并非任何企业的岗位/);
 assert.match(explorer,/不是企业是否正在招聘该专业的证明/);
 assert.match(explorer,/不一定招聘该专业/);
 assert.match(explorer,/以企业招聘网站为准|请到招聘官网查看/);
 assert.doesNotMatch(explorer,/候选·待复核|曾有来源核对|hhba-library-tag|网址来源状态/);
 assert.match(explorer,/未经过核验的网址|未经核验的网址|不提供实时职位/);
 assert.match(explorer,/数据可能不完整/);
 assert.ok(explorer.includes('safeUrl(entry.url)'));
 assert.ok(explorer.includes("u.protocol==='https:'"));
 assert.ok(explorer.includes('rel="noopener noreferrer"'));
});

test('search, custom halls, dedupe, partial-load errors and 25-per-page are implemented',()=>{
 assert.ok(explorer.includes('const PAGE_SIZE=25'));
 assert.ok(explorer.includes('setPage(1)'));
 assert.ok(explorer.includes('setSelectedHalls'));
 assert.ok(explorer.includes('toggleHall'));
 assert.ok(explorer.includes('const results=new Map<string,CrossHallRow>()'));
 assert.ok(explorer.includes("previous.hallIds.push(hallId)"));
 assert.ok(explorer.includes('setErrors(failed)'));
 assert.ok(explorer.includes("rows.filter(r=>!q"));
 assert.ok(explorer.includes('role="alert"'));
 assert.ok(explorer.includes('aria-label="跨行业搜索分页"'));
 assert.ok(css.includes('@media(max-width:620px)'));
 assert.ok(css.includes('.hhba-major-chooser{grid-template-columns:1fr;'));
});

test('both industry list and each hall link to major page; routing prioritizes /majors',()=>{
 assert.ok(library.includes('to="/companies/library/majors"'));
 assert.ok(library.includes('<MajorHallExplorer manifest={data}/>'));
 const major=main.indexOf("route==='/companies/library/majors'");
 const general=main.indexOf("route==='/companies/library'||");
 assert.ok(major>=0&&general>major,'major route must take priority over hall-id route');
 assert.ok(router.includes('publicLibraryRoute.test(path)'));
 assert.ok(library.includes('view?:'));
 assert.ok(library.includes('<HallSelection manifest={data}/>'));
});
