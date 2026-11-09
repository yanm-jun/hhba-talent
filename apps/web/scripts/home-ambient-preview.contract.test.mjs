import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const home=read('../src/pages/HomePage.tsx');
const component=read('../src/components/HomeAmbientStats.tsx');
const styles=read('../src/styles/home-ambient-stats.css');

test('only one ambient stats component is inserted into the existing homepage',()=>{
  assert.equal((home.match(/<HomeAmbientStats\/>/g)||[]).length,1);
  for(const original of ['让机会与人才，找到彼此。','你来到这里，是为了什么？',
     'title="我要应聘"','title="我要招人"','<UnifiedJobMarket compact/>',
     '<HomeCompanyMarquee/>','<HomePeopleBanner/>']){
    assert.ok(home.includes(original), 'Original homepage content missing: '+original);
  }
});
test('Beijing clock and unconstrained update intervals are used',()=>{
  assert.ok(component.includes("timeZone: 'Asia/Shanghai'"));
  assert.ok(component.includes('window.setTimeout(tick, rand(2600, 9200))'));
  assert.ok(component.includes('Math.random() + Math.random() + Math.random()'));
  assert.ok(component.includes('Math.max(100000, target - 41000)'));
  assert.ok(component.includes('Math.min(499999, target + 41000)'));
});
test('home panels occupy side whitespace only and hide on narrow viewports',()=>{
  assert.ok(styles.includes('position:absolute'));
  assert.ok(styles.includes('@media(max-width:1399px)'));
  assert.ok(styles.includes('.hhba-home-ambient{display:none}'));
});
