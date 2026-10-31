import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const src=n=>readFileSync(path.join(here,'../src/data',n),'utf8');
const raw=(name,key)=>{const s=src(name);const prefix=key+'=';const i=s.indexOf(prefix);assert.ok(i>=0,'not exported '+name);return JSON.parse(s.slice(i+prefix.length).trim().replace(/;\s*$/,''))};
const policies=raw('jilinPolicyRecords.ts','JILIN_POLICY_RECORDS:TalentPolicyRecord[]');
const housing=raw('jilinHousingRecords.ts','JILIN_HOUSING_RECORDS:TalentHousingRecord[]');
const cities=['长春','吉林','四平','辽源','通化','白山','松原','白城','延边'];
const registry=src('talentCityRegistry.ts'),policyIndex=src('talentPolicyRecords.ts'),housingIndex=src('talentHousingRecords.ts'),guides=src('jilinGuides.ts');
const routes=readFileSync(path.join(here,'../src/pages/TalentServiceRoutes.tsx'),'utf8');
const cards=readFileSync(path.join(here,'../src/components/talent/UnifiedPolicyList.tsx'),'utf8');
assert.equal(cities.length,9);
assert.equal(policies.length,35);
assert.equal(housing.length,9);
for(const city of cities){
 assert.ok(policies.filter(p=>p.city===city).length>=3,'missing Jilin provincial subsidy '+city);
 assert.equal(housing.filter(p=>p.city===city).length,1,'empty/duplicate Jilin housing entry '+city);
 if(city!=='延边')assert.ok(registry.includes('|'+city+'市|吉林省|'),city+' missing existing directory');
}
assert.ok(registry.includes("official:'延边朝鲜族自治州'"));
assert.ok(registry.includes("code:'222400'"));
assert.ok(registry.includes('...TALENT_JILIN_PREFECTURES'),'Yanbian missing from nationwide directory');
assert.equal(new Set(policies.map(p=>p.id)).size,policies.length,'duplicate policy IDs');
assert.equal(new Set(housing.map(h=>h.id)).size,housing.length,'duplicate housing IDs');
for(const p of policies){
 assert.ok(p.id.startsWith('jl-'),p.id);
 assert.ok(p.sourceUrl.startsWith('https://')&&new URL(p.sourceUrl).hostname.endsWith('.gov.cn'),p.id+' source invalid');
 assert.ok(p.eligibility?.length>40,p.id+' weak eligibility');
 assert.ok(p.materials?.length>=2,p.id+' material checklist');
 assert.ok(p.applicationSteps?.length>=4,p.id+' real steps');
 assert.ok(p.reviewNote?.includes('办理入口待核实'),p.id+' must clarify unknown application deep link');
 if(p.id.startsWith('jl-prov-'))assert.ok(p.title.includes('吉林省'),p.id+' provincial item mislabelled municipality');
}
for(const p of housing){
 assert.ok(p.sourceUrl.startsWith('https://')&&new URL(p.sourceUrl).hostname.endsWith('.gov.cn'));
 assert.ok(p.steps?.length>=4);
 assert.ok(p.statusNote?.includes('申报入口待核实'),'do not claim an unverified portal '+p.id);
 assert.ok(p.statusNote.includes('实时空房'),'do not claim actual vacancy '+p.id);
 assert.ok(p.units?.length>25&&p.address?.length>12);
}
for(const a of ['...JILIN_POLICY_RECORDS'])assert.ok(policyIndex.includes(a));
assert.ok(housingIndex.includes('...JILIN_HOUSING_RECORDS'));
assert.ok(routes.includes("fragments[2]==='jilin'")&&routes.includes('buildJilinGuide(decode('));
assert.ok(cards.includes("p.id.startsWith('jl-')"),'card must click into guide');
assert.ok(guides.includes("qualityLevel:expired?'C':'B'"),'no unsupported A certification');
for(const city of cities) {
 assert.ok(policies.some(p=>p.city===city&&p.title.includes('就业生活补贴')));
 assert.ok(policies.some(p=>p.city===city&&p.title.includes('就业创业租房补贴')));
 assert.ok(policies.some(p=>p.city===city&&p.title.includes('首次购房补贴')));
}
const longSchool=policies.filter(p=>p.id.endsWith('-purchase'));
assert.equal(longSchool.length,9);
assert.ok(longSchool.every(p=>p.reviewNote.includes('安家补贴')&&p.reviewNote.includes('租房补贴')),'purchase exclusions');
assert.ok(housing.find(p=>p.city==='松原')?.statusNote.includes('省级公租房管理框架'),'Songyuan must not claim unverified local project');
console.log('PASS Jilin V5.1: 8 cities+Yanbian, 35 policies, 9 housing sources, 27 province-by-locality benefits, original city index intact and shared B/C route');
