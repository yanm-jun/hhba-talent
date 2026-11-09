import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const home = src('../src/pages/HomePage.tsx');
const drawer = src('../src/components/HomeLiveDrawer.tsx');
const css = src('../src/styles/home-live-drawer.css');
const html = src('../../../previews/home-hover-drawer-20261109/index.html');

test('homepage original body remains unchanged except importing/mounting the hover rail', () => {
  assert.equal((home.match(/<HomeLiveDrawer\/>/g)||[]).length, 1);
  for (const text of ['让机会与人才，找到彼此。','你来到这里，是为了什么？',
   'title="我要应聘"', 'title="我要招人"', '<UnifiedJobMarket compact/>',
   '<HomeCompanyMarquee/>','<HomePeopleBanner/>']) {
    assert.ok(home.includes(text), 'Original homepage content changed: ' + text);
  }
});

test('preview drawer is right side, hover/click accessible, and never rearranges center', () => {
  assert.ok(css.includes('position:absolute'));
  assert.ok(css.includes('right:0'));
  assert.ok(css.includes('pointer-events:none'));
  assert.ok(css.includes('.hhba-hover-rail.is-open .hhba-stats-slideout'));
  assert.ok(drawer.includes('onMouseEnter'));
  assert.ok(drawer.includes('onMouseLeave'));
  assert.ok(drawer.includes('aria-expanded={open}'));
  assert.ok(drawer.includes('onClick={() => { cancelClose(); setOpen(value => !value); }}'));
  assert.ok(drawer.includes("event.key === 'Escape'"));
});

test('live demo trends follow Beijing time with nondecreasing counters', () => {
  assert.ok(drawer.includes("timeZone: 'Asia/Shanghai'"));
  assert.ok(drawer.includes('Math.max(100000, base - 33000)'));
  assert.ok(drawer.includes('Math.min(499999, base + 33000)'));
  assert.ok(drawer.includes('240, 830'));
  assert.ok(drawer.includes('offers: prev.offers + random(1, 2)'));
  assert.ok(drawer.includes('applications: prev.applications + random(1, 14)'));
  assert.ok(drawer.includes('sessionStorage'));
  assert.ok(html.includes('onmouseenter="enter()"') && html.includes('onmouseleave="leave()"'));
});
