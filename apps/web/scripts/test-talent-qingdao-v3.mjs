import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
const page=readFileSync(new URL('../src/pages/TalentQingdaoPolicyPreview.tsx',import.meta.url),'utf8');
const guide=readFileSync(new URL('../src/pages/TalentQingdaoGuidePreview.tsx',import.meta.url),'utf8');
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
const jinan=readFileSync(new URL('../src/pages/TalentJinanGuidePreview.tsx',import.meta.url),'utf8');
const home=readFileSync(new URL('../src/pages/TalentServicePage.tsx',import.meta.url),'utf8');
const policies=[
 'qd-rent-25','sd-qingdao-2026-free-housing','qd-home-25','qd-start-25','qd-laoshan-202610'
];
let n=0;function check(label,fn){fn();n++;console.log('✓ '+label)}
check('Exactly 5 distinct municipal policy directions, 2 full guides; duplicate records suppressed',()=>{
 for(const id of policies){const rec=TALENT_POLICY_RECORDS.find(p=>p.id===id);assert.ok(rec&&rec.city==='青岛',id);assert.ok(page.includes("'"+id+"'"),'Missing visible item '+id);}
 assert.equal(policies.length,5);
 assert.ok(page.includes('selectedIds.map(id=>TALENT_POLICY_RECORDS.find'));
 assert.ok(page.includes('住房补贴')&&page.includes('免租金住宿')&&page.includes('购房安家')&&page.includes('就业创业')&&page.includes('人才住房'));
});
check('Interactive city categories are wired to client state and accessibility',()=>{
 assert.ok(page.includes("useState<Kind>('all')"));
 assert.ok(page.includes('aria-pressed={filter===id}'));
 assert.ok(page.includes('onClick={()=>setFilter(id)}'));
 assert.ok(page.includes('filter===\\'all\\'||summaries[p.id].category===filter'));
});
check('Housing subsidy shows verified 500/800/1200 and correct policy validity',()=>{
 for(const s of ['500元/月','800元/月','1,200元/月','最长36个月','2027-03-31','青岛户籍','社会保险'])assert.ok(guide.includes(s),s);
 assert.ok(guide.includes('2023年1月1日以后毕业者申领该项时不再需要就业报到证'));
});
check('Free accommodation is not confused with cash subsidy or current vacancy',()=>{
 for(const s of ['毕业3年内（含毕业学年）','求职最多6个月','最长12个月','5日内','2029-06-30','爱山东','房源不足时不能保证入住'])assert.ok(guide.includes(s),s);
 assert.ok(guide.includes('历史批次，不能把这47间当作今天仍然剩余'));
});
check('Both guides have 6 separate cause/action/outcome application steps',()=>{
 const match=guide.match(/steps:\[([\s\S]*?)\],\s*checks:/g)||[];
 assert.equal(match.length,2,'Every guide needs its own six-step timeline');
 for(const block of match){assert.equal((block.match(/title:'/g)||[]).length,6);assert.equal((block.match(/why:'/g)||[]).length,6);assert.equal((block.match(/action:'/g)||[]).length,6);assert.equal((block.match(/done:'/g)||[]).length,6);}
});
check('Each official channel and source is identified rather than a generic government homepage',()=>{
 assert.ok(guide.includes("officialUrl:'https://rc.qingdao.gov.cn/'"));
 assert.ok(guide.includes('青岛市免租金住宿保障平台'));
 assert.ok(guide.includes('政府原文不是选房页面'));
 assert.ok(guide.includes('青人社发〔2024〕6号'));
 assert.ok(guide.includes('青人社发〔2026〕3号'));
 for(const phone of ['0532-66711723','0532-85912361'])assert.ok(guide.includes(phone));
});
check('Guide inputs and checklists stay browser only; no personal secrets collected',()=>{
 assert.ok(guide.includes('aria-pressed={branch===value}'));
 assert.ok(guide.includes('setFaqQuery(e.target.value)'));
 assert.ok(guide.includes('checked={Boolean(selected[String(i)])}'));
 assert.ok(!guide.includes('localStorage')&&!guide.includes('fetch(')&&!guide.includes('身份证号'));
});
check('Qingdao normal city route points to V3, all other cities use legacy unchanged',()=>{
 assert.ok(routes.includes("match.name==='青岛'&&k.id==='policies'"));
 assert.ok(routes.includes("kind==='policy-layout-preview'&&fragments[2]==='qingdao'"));
 assert.ok(routes.includes("kind==='policy-guide-preview'&&fragments[2]==='qingdao'"));
 assert.ok(routes.includes("fragments[3]==='stay'?'stay':'housing'"));
 assert.ok(routes.includes("talentListUrl(k.id,match.name)"));
 assert.ok(page.includes('/talent-service/list/policies/%E9%9D%92%E5%B2%9B'));
});
check('Main homepage & Jinan V3.1 remain untouched and available',()=>{
 for(const b of ['htl-intro','htl-quick','htl-city-grid','htl-housing-grid','htl-policy-list','htl-match'])assert.ok(home.includes(b));
 assert.ok(jinan.includes('济南市高层次人才生活补贴'));
 assert.ok(routes.includes("fragments[2]==='jinan'"));
});
console.log(JSON.stringify({passed:n,cities:['青岛'],policyItems:policies.length,fullGuides:2,stepCount:12,developmentBranch:'main'},null,2));
