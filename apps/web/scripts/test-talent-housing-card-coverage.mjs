import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TALENT_CITY_INDEX} from '../src/data/talentCityRegistry.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {TALENT_HOUSING_RESEARCH_LEADS} from '../src/data/talentHousingResearch.ts';
import {GUANGXI_RENT_RESEARCH_RECORDS} from '../src/data/guangxiRentPolicyResearch.ts';
import {talentSourceKind} from '../src/data/talentQuality.ts';

const files=new URL('../src/',import.meta.url);
const routes=readFileSync(new URL('pages/TalentServiceRoutes.tsx',files),'utf8');
const housingSource=readFileSync(new URL('data/talentHousingRecords.ts',files),'utf8');

const guangdong=['广州','深圳','佛山','东莞','珠海','中山','惠州','江门','肇庆','汕头','潮州','揭阳','汕尾','湛江','茂名','阳江','韶关','清远','云浮','河源','梅州'];
const jiangsu=['南京','无锡','徐州','常州','苏州','南通','连云港','淮安','盐城','扬州','镇江','泰州','宿迁'];
const guangxi=['南宁','柳州','桂林','梧州','北海','防城港','钦州','贵港','玉林','百色','贺州','河池','来宾','崇左'];
const audited=[...guangdong,...jiangsu,...guangxi];

assert.equal(new Set(audited).size,audited.length,'City uniqueness');
const IDs=TALENT_HOUSING_RECORDS.map(h=>h.id);
assert.equal(new Set(IDs).size,IDs.length,'Housing IDs must be unique');

for(const city of audited){
 assert.ok(TALENT_CITY_INDEX.find(c=>c.name===city),city+' city must exist in national directory');
 assert.ok(TALENT_POLICY_RECORDS.some(p=>p.city===city),city+' sourced policy record absent');
}
for(const city of guangdong){
 const records=TALENT_HOUSING_RECORDS.filter(h=>h.city===city);
 assert.ok(records.length>0,city+' must show an independently verifiable housing program/project (not 住房资料核验中)');
 assert.ok(records.every(h=>talentSourceKind(h.sourceUrl)==='government'),city+' housing source must be official');
 assert.ok(records.every(h=>h.steps.length>=4 && h.statusNote.length>20),city+' housing detail missing real steps/status');
}
for(const city of jiangsu){
 assert.ok(TALENT_HOUSING_RECORDS.some(h=>h.city===city),city+' housing program/project absent');
}
const guangzhou=TALENT_HOUSING_RECORDS.filter(h=>h.city==='广州');
assert.ok(guangzhou.some(h=>h.id==='gd-gz-housing-2025'));
assert.ok(guangzhou.some(h=>h.sourceUrl==='https://zfcj.gz.gov.cn/gkmlpt/content/10/10121/post_10121797.html'));
assert.ok(guangzhou.every(h=>h.kind==='program'), 'Guangzhou 2025 regulations are NOT advertised as current apartment units');

for(const city of guangxi){
 assert.ok(GUANGXI_RENT_RESEARCH_RECORDS.some(p=>p.city===city&&p.category==='租房安居'),city+' region-wide rental eligibility lead absent');
}
// A city can lack a verified apartment. In that case, show transparent fallback
// and actual researched policies; NEVER fabricate a verified building just to silence the UI.
assert.ok(routes.includes('GUANGXI_RENT_RESEARCH_RECORDS.filter(p=>p.city===match.name&&isHousingPolicy(p)).length'));
assert.ok(routes.includes("guangxiRentalResearch>0?guangxiRentalResearch+"));
assert.ok(routes.includes("尚未收录已核实住房 · 查看核验进展"),'No empty-looking city housing card');
assert.ok(routes.includes("homes.length>0?homes.length+"),'Housing count must derive from runtime records');
assert.ok(routes.includes("TALENT_HOUSING_RECORDS.filter(h=>h.city===match.name)"));
assert.ok(routes.includes("TALENT_HOUSING_RECORDS.filter(p=>p.city===city"),'City housing list must use same source as city card');
assert.ok(routes.includes("<UnifiedTalentRecordDetail policy={p} housing={h}/>"),'Housing detail must route to common renderer');
assert.ok(housingSource.includes('...TALENT_HOUSING_COVERAGE_FIX_20261031'),'Guangzhou+10 housing fixes must be included in live aggregate');
assert.ok(housingSource.includes('...GUANGXI_HOUSING_RECORDS'),'Guangxi real programs indexed');
assert.ok(housingSource.includes('...GUANGDONG_EXPANDED_HOUSING_RECORDS'),'Keep expanded Guangdong programs');
assert.ok(TALENT_HOUSING_RESEARCH_LEADS.every(h=>!TALENT_HOUSING_RECORDS.some(r=>r.id===h.id)),'Research-only projects must never be counted as verified');

console.log('PASS Housing card regression: Guangdong 21/21 and Jiangsu 13/13 city housing programs, Guangzhou direct government source verified');
console.log('PASS Guangxi 14/14 rental-research city entries, honest empty-state, shared search/list/detail consistency');
console.log(JSON.stringify({guangdong:guangdong.length,jiangsu:jiangsu.length,guangxi:guangxi.length,guangzhouHousing:guangzhou.length,guangxiVerifiedHousingCities:new Set(TALENT_HOUSING_RECORDS.filter(h=>guangxi.includes(h.city)).map(h=>h.city)).size}));
