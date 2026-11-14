import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const home = read('../src/pages/HomePage.tsx');
const drawer = read('../src/components/HomeLiveDrawer.tsx');
const model = read('../src/components/homeLiveMetricsPreview.ts');
const css = read('../src/styles/home-live-drawer.css');
const html = read('../../../previews/home-hover-drawer-20261109/index.html');

test('stage 1 removes the live drawer and redirects the second entry to the candidate directory',()=>{
 assert.doesNotMatch(home, /HomeLiveDrawer|hhba-rail-trigger|我要招人/);
 for (const s of ['让机会与人才，找到彼此。','你来到这里，是为了什么？',
  'title="我要应聘"','title="企业招聘导航"','<UnifiedJobMarket compact/>',
  '<HomeCompanyMarquee/>',"'/companies/discover'"]) assert.ok(home.includes(s),s);
 assert.doesNotMatch(home, /HomePeopleBanner/);
});
test('the right-side panel opens on hover and closes after leaving',()=>{
 for(const s of ['onMouseEnter','onMouseLeave','aria-expanded={open}',
  'setOpen(true)','event.key === \'Escape\''])assert.ok(drawer.includes(s),s);
 assert.ok(drawer.includes('previewMetricsAt(Date.now())'));
 assert.ok(html.includes('onmouseenter="enter()"'));
 assert.ok(html.includes('onmouseleave="leave()"'));
});
test('review data retains exact baseline and correct rise/fall contracts',()=>{
 for(const s of ['heat: 368527','offers: 28651','active: 12846',
    'applications: 486329','100000,499999','400,30000',
    "Math.floor(cumulativeProgress(epochMs,'offers')-baseOfferProgress",
    "Math.floor(cumulativeProgress(epochMs,'applications')-baseAppProgress"
  ])assert.ok(model.includes(s),'missing model contract: '+s);
 assert.ok(drawer.includes('previewMetricsAt(Date.now())'));
 for(const v of ['368,527','28,651','12,846','486,329'])assert.ok(html.includes(v));
});
test('2026-2027 official holiday and makeup-workday rules are present',()=>{
 for(const s of ['Asia/Shanghai','2026-02-15','2026-02-23',
  '2027-02-05','2027-02-13','2027-01-31','2027-05-08',
  'seasonalWeight','nonWorkPoints','smoothNoise'
 ])assert.ok(model.includes(s),'calendar missing '+s);
});
test('brand colors and preview-only disclosure are preserved',()=>{
 for(const s of ['#1979ed','#f49c28','#f7a22c'])assert.ok(css.includes(s));
 assert.ok(html.includes('不代表真实在线、投递或 Offer 成果'));
});
