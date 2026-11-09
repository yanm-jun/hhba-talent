import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREVIEW_ANCHOR_MS, PREVIEW_START, previewMetricsAt,
  beijingParts, chineseDateMode
} from '../src/components/homeLiveMetricsPreview.ts';

const bj = (time) => Date.parse(time);

test('initial values are full precise numerals at design anchor; never 0',()=>{
 const initial=previewMetricsAt(PREVIEW_ANCHOR_MS);
 assert.equal(initial.heat,PREVIEW_START.heat);
 assert.equal(initial.offers,PREVIEW_START.offers);
 assert.equal(initial.active,PREVIEW_START.active);
 assert.equal(initial.applications,PREVIEW_START.applications);
 assert.ok(Object.values(initial).filter(x=>typeof x==='number').every(x=>x>0));
});

test('Beijing date and official Chinese holidays and make-up workdays',()=>{
 assert.equal(beijingParts(bj('2026-11-09T16:41:00+08:00')).hour,16);
 assert.equal(chineseDateMode('2026-02-15'),'holiday');
 assert.equal(chineseDateMode('2026-02-28'),'workday');
 assert.equal(chineseDateMode('2026-11-14'),'weekend');
 assert.equal(chineseDateMode('2027-02-05'),'holiday');
 assert.equal(chineseDateMode('2027-05-08'),'workday');
 assert.equal(chineseDateMode('2027-09-26'),'workday');
});

test('never starts a visit from zero and follows Chinese daily rhythm',()=>{
 const day='2026-11-10';
 const night=previewMetricsAt(bj(day+'T03:00:00+08:00'));
 const morning=previewMetricsAt(bj(day+'T10:00:00+08:00'));
 const afternoon=previewMetricsAt(bj(day+'T16:00:00+08:00'));
 const evening=previewMetricsAt(bj(day+'T22:00:00+08:00'));
 assert.ok(night.heat>=100000 && night.active>0);
 assert.ok(morning.heat>night.heat,'morning should exceed night');
 assert.ok(afternoon.heat>morning.heat,'afternoon peak should exceed morning');
 assert.ok(evening.heat<afternoon.heat,'evening should wind down');
 assert.ok(night.heat>102000,'night time must not be clamped to the minimum for hours');
});

test('midnight transitions have no artificial jumps, including holidays and months',()=>{
 for(const date of ['2026-11-14','2026-12-01','2027-01-01','2027-02-05','2027-02-14','2027-05-01','2027-09-15']){
  const edge=bj(date+'T00:00:00+08:00');
  const previous=previewMetricsAt(edge-1000),current=previewMetricsAt(edge+1000);
  assert.ok(Math.abs(current.heat-previous.heat)<2000,date+': large midnight heat jump');
  assert.ok(Math.abs(current.active-previous.active)<300,date+': large midnight active jump');
  assert.ok(current.active>0,date+': rolling active reset to zero');
  assert.ok(current.offers>=previous.offers,date+': offer count went backwards');
  assert.ok(current.applications>=previous.applications,date+': application count went backwards');
 }
});

test('shared timestamps are deterministic; cumulative values never decrease',()=>{
 const start=bj('2026-11-09T15:00:00+08:00');
 let last=previewMetricsAt(start);
 for(let hours=1;hours<24*66;hours+=4){
  const now=previewMetricsAt(start+hours*3600000);
  assert.deepEqual(now,previewMetricsAt(start+hours*3600000));
  assert.ok(now.heat>=100000 && now.heat<=499999);
  assert.ok(now.active>0);
  assert.ok(now.offers>=last.offers,'Offer must never decrease');
  assert.ok(now.applications>=last.applications,'cumulative applications must never decrease');
  last=now;
 }
});

test('live heat and active counts move in both directions',()=>{
 let upHeat=false,downHeat=false,upActive=false,downActive=false;
 const start=bj('2026-11-10T14:00:00+08:00');
 let prior=previewMetricsAt(start);
 for(let i=1;i<=600;i++){
  const value=previewMetricsAt(start+i*1500);
  upHeat ||= value.heat>prior.heat;
  downHeat ||= value.heat<prior.heat;
  upActive ||= value.active>prior.active;
  downActive ||= value.active<prior.active;
  prior=value;
 }
 assert.ok(upHeat&&downHeat,'heat must have irregular two-way movement');
 assert.ok(upActive&&downActive,'today-active must have irregular two-way movement');
});
