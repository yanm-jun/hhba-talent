import assert from 'node:assert/strict';
import {SICHUAN_HOUSING_GAP_2026_OFFICIAL} from '../src/data/sichuanHousingGapOfficial2026.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';

const required = ['广安','巴中'];
assert.equal(SICHUAN_HOUSING_GAP_2026_OFFICIAL.length,required.length);
for(const city of required){
  const entries=SICHUAN_HOUSING_GAP_2026_OFFICIAL.filter(x=>x.city===city);
  assert.equal(entries.length,1, city+' must have one verified local program');
  const item=entries[0];
  assert.equal(item.kind,'program');
  assert.ok(item.sourceUrl.startsWith('https://'),'must cite government original');
  assert.ok(item.sourceUrl.includes('.gov.cn') || item.sourceUrl.includes('.gov.cn/'));
  assert.ok(item.steps.length>=4,'guide must include detailed steps');
  assert.ok(item.statusNote.includes('待核实'),'cannot claim current vacancy or open enrollment');
  assert.ok(TALENT_HOUSING_RECORDS.some(h=>h.id===item.id),'not connected to nationwide records');
  assert.equal(item.housingCategory,'公共租赁住房');
}
assert.ok(SICHUAN_HOUSING_GAP_2026_OFFICIAL.some(x=>x.district.includes('广安区')));
assert.ok(SICHUAN_HOUSING_GAP_2026_OFFICIAL.some(x=>x.district.includes('巴州区')));
console.log('Sichuan 2026 housing gap official local programs: 2/2 data and integration assertions passed. Current vacancies unverified.');
