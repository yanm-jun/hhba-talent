import assert from 'node:assert/strict';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
const cities=['济南','青岛','淄博','枣庄','东营','烟台','潍坊','济宁','泰安','威海','日照','临沂','德州','聊城','滨州','菏泽'];
const all=TALENT_POLICY_RECORDS.filter(x=>cities.includes(x.city));
const extended=all.filter(x=>x.materials?.length&&x.applicationSteps?.length);
let passed=0;function check(name,fn){fn();passed++;console.log('✓ '+name)}
check('16 Shandong cities each have at least two different policies',()=>{for(const city of cities){const r=all.filter(x=>x.city===city);assert.ok(r.length>=2,city+': '+r.length);assert.equal(new Set(r.map(x=>x.id)).size,r.length)}});
check('At least 25 detailed additions and 41 total Shandong references',()=>{assert.ok(extended.length>=25,'detailed '+extended.length);assert.ok(all.length>=41,'total '+all.length)});
check('Extended policies include materials, staged steps and exact benefit limitations',()=>{for(const r of extended){assert.ok(r.materials.length>=2,r.id);assert.ok(r.applicationSteps.length>=3,r.id);assert.ok(r.benefit.length>=30,r.id);assert.ok(r.eligibility.length>=40,r.id);assert.ok(r.reviewNote.length>=20,r.id)}});
check('All source URLs use audited host allowlist and non-official sources disclose limitations',()=>{
 const allowed=['www.rznews.cn','m.thepaper.cn','www.sdfzxy.edu.cn','weifang.sdnews.com.cn','liaocheng.sdnews.com.cn'];
 for(const r of extended){const host=new URL(r.sourceUrl).hostname;const strong=host.endsWith('.gov.cn')||host.endsWith('.ncss.cn');assert.ok(strong||allowed.includes(host),r.id+' '+host);if(!strong)assert.ok(/转载|报道|历史|复核|核实|原文|汇编|媒体|旧版|来源/.test(r.reviewNote),r.id)}
});
check('Old cohorts, regional limits, employer payments and loans remain explicit',()=>{
 for(const id of ['zb-home-history','wf-home-history','dz-home-history'])assert.equal(all.find(x=>x.id===id)?.temporal,'historical');
 assert.equal(all.find(x=>x.id==='jn-opc-insurance-26')?.payoutTo,'用人单位');
 assert.equal(all.find(x=>x.id==='hz-loan-26')?.payoutTo,'非现金贷款');
 assert.equal(all.find(x=>x.id==='rz-rent-buy-26')?.payoutTo,'住房折扣');
 assert.equal(all.find(x=>x.id==='sd-lc-insurance-2026')?.deadline,'2026-12-31');
});
check('No city subsidy may be marked auto-approved',()=>{for(const r of extended)assert.ok(!/已通过审核|保证可领|实时开放|当前有房源/.test(r.summary+r.reviewNote),r.id)});
console.log(JSON.stringify({passed,shandongPolicies:all.length,extended:extended.length,cities:cities.length},null,2));
