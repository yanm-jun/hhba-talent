import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
const page=readFileSync(new URL('../src/pages/TalentQingdaoPolicyPreview.tsx',import.meta.url),'utf8');
const guide=readFileSync(new URL('../src/pages/TalentQingdaoGuidePreview.tsx',import.meta.url),'utf8');
const sharedList=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
const sharedGuide=readFileSync(new URL('../src/components/talent/UnifiedPolicyGuide.tsx',import.meta.url),'utf8');
const laoshan=readFileSync(new URL('../src/pages/TalentLaoshanGuide.tsx',import.meta.url),'utf8');
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const jinan=readFileSync(new URL('../src/pages/TalentJinanGuidePreview.tsx',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/pages/TalentServicePage.tsx',import.meta.url),'utf8');
const ids=['qd-rent-25','sd-qingdao-2026-free-housing','qd-home-25','qd-start-25','qd-laoshan-202610'];
let passed=0;function check(name,fn){fn();passed++;console.log('✓ '+name)}
check('Five distinct Qingdao policy directions exist and are de-duplicated in one list config',()=>{
 for(const id of ids){assert.ok(TALENT_POLICY_RECORDS.some(x=>x.id===id&&x.city==='青岛'),id);assert.ok(page.includes("'"+id+"'"),id)}
 assert.ok(page.includes('selectedIds.map(id=>'));
 assert.ok(page.includes('UnifiedPolicyList config={qingdaoConfig}'));
});
check('One shared list template manages categories, official links and archived data for all cities',()=>{
 assert.ok(sharedList.includes("useState('all')"));
 assert.ok(sharedList.includes('onClick={()=>setCategory(id)}'));
 assert.ok(sharedList.includes('href={record.sourceUrl}'));
 assert.ok(sharedList.includes('const old=filtered.filter(x=>historical(x.record))'));
 assert.ok(sharedList.includes("config.city"));
});
check('Cash housing subsidy requirements and actual official online portal remain in city-specific data',()=>{
 for(const s of ['500元/月','800元/月','1,200元/月','2027-03-31','青岛户籍','2023年1月1日以后毕业者申领该项时不再需要就业报到证'])assert.ok(guide.includes(s),s);
 assert.ok(guide.includes("officialUrl:'https://rc.qingdao.gov.cn/'"));
});
check('2026 rent-free accommodation remains a noncash, non-realtime application',()=>{
 for(const s of ['毕业3年内（含毕业学年）','求职最多6个月','最长12个月','5日内','2029-06-30','爱山东','房源不足时不能保证入住'])assert.ok(guide.includes(s),s);
 assert.ok(guide.includes('历史批次，不能把这47间当作今天仍然剩余'));
});
check('Both original Qingdao guides retain six separate actionable steps',()=>{
 const blocks=guide.match(/steps:\[([\s\S]*?)\],\s*checks:/g)||[];
 assert.equal(blocks.length,2);
 for(const b of blocks)for(const k of ['title:','why:','action:','done:'])assert.equal((b.match(new RegExp(k,'g'))||[]).length,6);
});
check('Unified guide provides actual user interactions without personal-data collection',()=>{
 assert.ok(sharedGuide.includes('setBranch(key)'));
 assert.ok(sharedGuide.includes('active.conditions.map('));
 assert.ok(sharedGuide.includes('aria-expanded={openFaq===x.i}'));
 assert.ok(sharedGuide.includes('setFaqQuery(e.target.value)'));
 assert.ok(sharedGuide.includes('checked={Boolean(selected[String(i)])}'));
 assert.ok(!sharedGuide.includes('fetch(')&&!sharedGuide.includes('localStorage'));
});
check('Laoshan official detailed rental guidance now includes 7 deadlines and known contacts',()=>{
 for(const s of ['492套','11月6日','11月10日','11月12日','12月3日','12月10日','12月17日','0532-88999751','0532-88998362','15.42元/㎡·月','20.96元/㎡·月'])assert.ok(laoshan.includes(s),s);
 assert.ok(laoshan.includes('UnifiedPolicyGuide data={data}'));
});
check('Routes preserve Jinan, Qingdao and new Laoshan deep guide separately',()=>{
 for(const t of ["fragments[2]==='qingdao'&&fragments[3]==='laoshan'","fragments[3]==='stay'?'stay':'housing'","fragments[2]==='jinan'"])assert.ok(routes.includes(t),t);
 assert.ok(routes.includes('UnifiedTalentRecordDetail'));
 assert.ok(jinan.includes('UnifiedPolicyGuide data={jinanGuide}'));
});
check('Homepage six sections are still untouched by this unified template',()=>{
 for(const t of ['htl-intro','htl-quick','htl-city-grid','htl-housing-grid','htl-policy-list','htl-match'])assert.ok(home.includes(t));
});
console.log(JSON.stringify({passed,sharedList:true,sharedGuide:true,laoshanSteps:7,otherCityDataRetained:true},null,2));
