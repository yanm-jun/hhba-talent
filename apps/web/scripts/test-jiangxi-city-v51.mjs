import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const data=n=>readFileSync(path.join(here,'../src/data',n),'utf8');
function records(file,symbol){const raw=data(file);const marker=symbol+'=';const i=raw.indexOf(marker);assert.ok(i>=0,'export not found: '+file);return JSON.parse(raw.slice(i+marker.length).trim().replace(/;\s*$/,''));}
const policy=records('jiangxiPolicyRecords.ts','JIANGXI_POLICY_RECORDS:TalentPolicyRecord[]');
const housing=records('jiangxiHousingRecords.ts','JIANGXI_HOUSING_RECORDS:TalentHousingRecord[]');
const cities=['南昌','景德镇','萍乡','九江','新余','鹰潭','赣州','吉安','宜春','抚州','上饶'];
const registry=data('talentCityRegistry.ts');
const pIndex=data('talentPolicyRecords.ts'),hIndex=data('talentHousingRecords.ts'),guides=data('jiangxiGuides.ts');
const routes=readFileSync(path.join(here,'../src/pages/TalentServiceRoutes.tsx'),'utf8');
const cards=readFileSync(path.join(here,'../src/components/talent/UnifiedPolicyList.tsx'),'utf8');
assert.equal(cities.length,11);
assert.equal(policy.length,46,'33 province-by-locality + 13 local policies');
assert.equal(housing.length,11);
assert.equal(new Set([...policy,...housing].map(x=>x.id)).size,57,'unique policy and housing IDs');
for(const city of cities){
 assert.ok(registry.includes('|'+city+'市|江西省|'),'city directory missing '+city);
 assert.ok(policy.filter(x=>x.city===city).length>=4,'policy coverage missing '+city);
 assert.equal(housing.filter(x=>x.city===city).length,1,'city housing content missing '+city);
 for(const type of ['jobs-2026','jobseek-2026','employer-2026'])assert.ok(policy.some(x=>x.city===city&&x.id.endsWith('-'+type)),'missing province support '+type+' '+city);
}
for(const p of policy){
 assert.ok(p.id.startsWith('jx-'));
 assert.ok(p.sourceUrl.startsWith('https://'));
 assert.ok(p.eligibility?.length>48,'eligibility underdeveloped '+p.id);
 assert.ok(p.materials?.length>=3&&p.applicationSteps?.length>=4,'real evidence list missing '+p.id);
 assert.ok(p.reviewNote?.includes('办理入口待核实'),'must label application portal '+p.id);
}
for(const h of housing){
 assert.equal(h.kind,'program','historical and procurement sources are not live projects '+h.id);
 assert.ok(h.statusNote.includes('申报入口待核实')&&h.statusNote.includes('实时空房'),'must mark stock and portal caveat '+h.id);
 assert.ok(h.steps?.length>=4,'housing procedure missing '+h.city);
 assert.ok(h.sourceUrl.startsWith('https://'),'missing source '+h.city);
}
assert.ok(housing.find(x=>x.city==='鹰潭')?.statusNote.includes('并非正式住建配租或实际交付证明'),'procurement must not become verified vacant apartment');
assert.ok(pIndex.includes('...JIANGXI_POLICY_RECORDS'),'national policy search registration missing');
assert.ok(hIndex.includes('...JIANGXI_HOUSING_RECORDS'),'national housing search registration missing');
assert.ok(guides.includes("qualityLevel:expired?'C':'B'"),'unverified A guide');
assert.ok(routes.includes("fragments[2]==='jiangxi'")&&routes.includes('buildJiangxiGuide(decode('),'guide route missing');
assert.ok(cards.includes("p.id.startsWith('jx-')"),'card clickthrough missing');
assert.ok(!policy.some(p=>p.id.includes('-prov-')&&!p.title.includes('江西')),'province-level grant wrongly framed as local');
console.log('PASS Jiangxi V5.1: 11 prefectural cities, 46 policy records, 11 sourced housing records, 46 shared B/C guides, national directory, no housing empty cards');
