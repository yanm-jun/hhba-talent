import assert from 'node:assert/strict';
import {SICHUAN_HOUSING_GAP_2026_OFFICIAL} from '../src/data/sichuanHousingGapOfficial2026.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';

const required = ['广安','巴中','宜宾','资阳'];
assert.equal(SICHUAN_HOUSING_GAP_2026_OFFICIAL.length,required.length);
const ids = new Set();
for (const city of required) {
  const entries = SICHUAN_HOUSING_GAP_2026_OFFICIAL.filter(x=>x.city===city);
  assert.equal(entries.length,1,city+' needs exactly one independent housing record in this batch');
  const item = entries[0];
  assert.ok(!ids.has(item.id), 'duplicate record ID '+item.id);
  ids.add(item.id);
  assert.equal(item.kind,'program','do not misrepresent a policy as available apartment');
  assert.ok(item.sourceUrl.startsWith('https://'),'must provide traceable primary or clearly attributed evidence');
  assert.ok(item.steps.length>=5,'each guide must explain how to check and apply');
  assert.ok(item.statusNote.includes('待核实') || item.statusNote.includes('待复核') || item.statusNote.includes('需人工复核'),'do not claim live vacancies or fully verified admission');
  assert.ok(item.eligibility.length>30 && item.rent.length>30,'must have substantive specific information');
  assert.ok(TALENT_HOUSING_RECORDS.some(h=>h.id===item.id),'missing from nationwide housing aggregation');
}
for (const city of ['广安','巴中']) {
  const item=SICHUAN_HOUSING_GAP_2026_OFFICIAL.find(x=>x.city===city);
  assert.equal(item.housingCategory,'公共租赁住房');
  assert.ok(item.sourceUrl.includes('.gov.cn'),'district public rental rules must cite official government originals');
}
assert.ok(!SICHUAN_HOUSING_GAP_2026_OFFICIAL.some(x=>x.city==='泸州'),'news platform must remain research, not formal records');
const yibin=SICHUAN_HOUSING_GAP_2026_OFFICIAL.find(x=>x.city==='宜宾');
assert.match(yibin.statusNote,/超时/,'must preserve official SPA verification blocker');
const ziyang=SICHUAN_HOUSING_GAP_2026_OFFICIAL.find(x=>x.city==='资阳');
assert.match(ziyang.statusNote,/超时/,'must preserve inaccessible original document blocker');
console.log('Sichuan housing gap source and scope data tests passed: 4 added records, all marked non-vacancy. Public portal original-source verification is separately pending.');
