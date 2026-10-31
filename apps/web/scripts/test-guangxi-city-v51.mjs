import assert from 'node:assert/strict';
import {GUANGXI_POLICY_RECORDS,GUANGXI_CITY_CONTACTS} from '../src/data/guangxiPolicyRecords.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
import {assessPolicy,talentSourceKind} from '../src/data/talentQuality.ts';
const expected=['南宁','柳州','桂林','梧州','北海','防城港','钦州','贵港','玉林','百色','贺州','河池','来宾','崇左'];
assert.deepEqual(GUANGXI_CITY_CONTACTS.map(c=>c.city),expected);
assert.equal(GUANGXI_POLICY_RECORDS.length,28);
assert.equal(new Set(GUANGXI_POLICY_RECORDS.map(p=>p.id)).size,28);
for(const city of expected){
 const rows=TALENT_POLICY_RECORDS.filter(p=>p.city===city&&p.id.startsWith('gx-'));
 assert.equal(rows.length,2,city+' missing coverage');
 assert.equal(rows.filter(p=>p.temporal==='past-window').length,1);
 for(const p of rows){
  assert.equal(talentSourceKind(p.sourceUrl),'government');
  assert.ok(p.applicationSteps.length>=4&&p.materials.length>=3);
  assert.ok(p.reviewedAt&&p.reviewNote&&p.targetGroup);
  assert.notEqual(assessPolicy(p,'2026-10-31').grade,'A','No A without dedicated certified guide');
 }
 assert.equal(assessPolicy(rows.find(p=>p.temporal==='past-window'),'2026-10-31').grade,'C');
}
assert.ok(TALENT_POLICY_RECORDS.length>GUANGXI_POLICY_RECORDS.length);
console.log('✓ 广西14市独立搜索索引；28份自治区政策属地展示，2026历史招募归档，不伪造A级');
console.log('INFO: 正式住房项目 '+expected.reduce((n,c)=>n+TALENT_HOUSING_RECORDS.filter(h=>h.city===c).length,0)+' 条；未证实项不算已交付');
