import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {findTalentCity} from '../src/data/talentCityRegistry.ts';
import {talentSourceKind,assessPolicy,assessHousing,assessTalentCity} from '../src/data/talentQuality.ts';
import {binzhouPurchaseGuide,binzhouLivingGuide,binzhouHousingGuide} from '../src/data/binzhouGuides.ts';
const policies=TALENT_POLICY_RECORDS.filter(x=>x.city==='滨州');
const homes=TALENT_HOUSING_RECORDS.filter(x=>x.city==='滨州');
const id=(i)=>{const p=policies.find(x=>x.id===i);assert.ok(p,'Missing policy '+i);return p};
for(const name of ['bz-start-26','sd-binzhou-2026-flex','bz-2026-living-archived','bz-2026-home-closed'])id(name);
assert.ok(policies.length>=4);
assert.equal(new Set(policies.map(x=>x.id)).size,policies.length);
assert.equal(id('bz-2026-living-archived').temporal,'historical');
assert.equal(id('bz-2026-home-closed').temporal,'past-window');
assert.equal(id('bz-2026-home-closed').deadline,'2026-10-30');
assert.ok(id('bz-2026-living-archived').summary.includes('2026-09-01'));
assert.ok(id('bz-2026-home-closed').reviewNote.includes('17:30'));
for(const i of ['bz-2026-living-archived','bz-2026-home-closed']){
 assert.equal(assessPolicy(id(i),'2026-10-30').grade,'C');
 assert.ok(id(i).materials.length>=3&&id(i).applicationSteps.length>=4);
 assert.ok(id(i).reviewNote.includes('截止')||id(i).reviewNote.includes('停止'));
 assert.equal(id(i).applicationUrl,undefined,'expired scheme cannot link directly as still open');
}
assert.equal(talentSourceKind('https://www.zoupingrc.cn/ywdt/sbyxjh/795673975169093.shtml'),'government','strictly reviewed HRSS-operated portal');
assert.equal(talentSourceKind('https://www.zoupingrc.cn/anonymous-upload'),'secondary','do not trust unreviewed URL paths');
assert.equal(talentSourceKind('https://zoupingrc.cn/ywdt/example'),'secondary','do not broaden host allowlist');
assert.equal(talentSourceKind('https://fakezoupingrc.cn/ywdt/notice'),'secondary','no lookalikes');
const names=['bz-zouping-tianjianyuan-2026-jan','bz-zouping-chuangxin-2026-apr','bz-zouping-talent-rent-rules-2026'];
for(const n of names)assert.ok(homes.some(h=>h.id===n),'Missing housing record '+n);
assert.ok(homes.length>=3);
assert.equal(new Set(homes.map(x=>x.id)).size,homes.length);
const project=homes.filter(h=>['bz-zouping-tianjianyuan-2026-jan','bz-zouping-chuangxin-2026-apr'].includes(h.id));
assert.equal(project.length,2);
for(const h of project){
 assert.equal(h.kind,'project');
 assert.equal(assessHousing(h,'2026-10-30').grade,'C','expired 2026 housing batch');
 assert.ok(h.applicationEnd<'2026-10-30');
 assert.ok(h.statusNote.includes('截止')&&h.statusNote.includes('不等于')&&h.statusNote.includes('申报入口未公布'));
 assert.equal(h.applyUrl,undefined);
 assert.ok(h.steps.length>=4&&h.contactPhone);
}
const program=homes.find(h=>h.id==='bz-zouping-talent-rent-rules-2026');
assert.equal(program.kind,'program');
assert.equal(assessHousing(program,'2026-10-30').grade,'B','housing rules are not expired project allocations');
assert.equal(program.applyUrl,undefined);
assert.ok(program.statusNote.includes('申报入口待核验'));
assert.equal(findTalentCity('binzhou')?.name,'滨州');
assert.equal(assessTalentCity('滨州','2026-10-30').accepted,false);
const guides=[binzhouPurchaseGuide,binzhouLivingGuide,binzhouHousingGuide];
for(const guide of guides){assert.equal(guide.city,'滨州');assert.ok(guide.steps.length>=5&&guide.faq.length>=6);assert.ok(Object.keys(guide.branches).length>=3);assert.equal(guide.officialUrl,undefined)}
assert.equal(binzouLiving(),true);
function binzouLiving(){return binzhouLivingGuide.desc.includes('9月1日')&&binzhouPurchaseGuide.desc.includes('10月30日17:30')&&binzhouHousingGuide.desc.includes('不等于目前有空房')}
const routes=readFileSync(new URL('../src/pages/TalentServiceRoutes.tsx',import.meta.url),'utf8');
assert.ok(routes.includes("fragments[2]==='binzhou'"));
const list=readFileSync(new URL('../src/components/talent/UnifiedPolicyList.tsx',import.meta.url),'utf8');
assert.ok(list.includes("p.id==='bz-2026-home-closed'"));
const detail=readFileSync(new URL('../src/components/talent/UnifiedTalentRecordDetail.tsx',import.meta.url),'utf8');
assert.ok(detail.includes("'bz-2026-living-archived':'/talent-service/policy-guide-preview/binzhou/living'"));
console.log('Binzhou V5.1 PASS: four+ policies, two historically dated apartment projects, one real housing program and three shared guides.');
