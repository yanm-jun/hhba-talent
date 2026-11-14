import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const home=fs.readFileSync('src/pages/HomePage.tsx','utf8');

test('the bottom-right people photograph popup is completely absent from the homepage',()=>{
 assert.doesNotMatch(home, /HomePeopleBanner|hhba-people-banner|hhba-people-group/);
 assert.equal(fs.existsSync('src/components/HomePeopleBanner.tsx'),false);
 assert.equal(fs.existsSync('src/styles/home-people-banner.css'),false);
});

test('removal does not affect the HHBA interactive homepage and letter',()=>{
 for(const expected of [
  'title="企业招聘导航"',
  '<HomeCompanyMarquee/>',
  '<UnifiedJobMarket compact/>',
  '<HomeOpenLetter autoOpen={false}/>',
  '<WinterInternshipPopup/>',
  '我要应聘',
  '企业招聘导航'
 ]) assert.ok(home.includes(expected),expected);
});

test('no associated fixed-position overlay or close action can mount',()=>{
 assert.doesNotMatch(home, /关闭 HHBA 品牌理念展示|hhba-people-banner-close/);
});
