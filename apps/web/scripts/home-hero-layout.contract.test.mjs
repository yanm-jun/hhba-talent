import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const css=read('../src/styles.css');
const home=read('../src/pages/HomePage.tsx');
const homeStyles=read('../src/styles/home-workplace-promise.css');

test('home hero uses compact desktop whitespace and larger typographic hierarchy',()=>{
 assert.ok(css.includes('.home-hero{margin-top:clamp(38px,7vh,68px)}'),
   'desktop title must not be pushed down by 16vh / 170px');
 assert.ok(css.includes('.home-hero h1{font-size:clamp(28px,3vw,31px)'),
   'base main slogan sizing remains intact');
 assert.ok(css.includes('.home-hero p{font-size:16px;line-height:1.55'),
   'base subtitle sizing remains intact');
 assert.ok(css.includes('.home-hero{text-align:center;margin:24px auto 19px}'),
   'title-to-cards whitespace must be compact');
 assert.ok(homeStyles.includes('.hhba-public-hero h1{max-width:900px;margin:0 auto;font-size:clamp(31px,4vw,42px)'),
   'new homepage positioning headline must have a stronger hierarchy');
});
test('mobile spacing and headline remain readable without horizontal overflow',()=>{
 assert.ok(css.includes('.home-hero{margin:28px 0 19px}'));
 assert.ok(css.includes('.home-hero h1{font-size:clamp(25px,6vw,28px)}'));
 assert.ok(css.includes('.home-hero p{font-size:15px}'));
 assert.ok(css.includes('.entry-grid,.workspace-grid,.summary-grid,.requirement-summary{grid-template-columns:1fr}'));
 assert.ok(homeStyles.includes('@media(max-width:680px)'));
 assert.ok(homeStyles.includes('.hhba-home-workplace::before{content:\'\';position:absolute;z-index:-1;inset:-8px -12px -20px'),
   'Decorative gradient should stay within the page shell at all desktop widths');
 assert.ok(!homeStyles.includes('calc(50% - 50vw)'),
   '100vw includes the Windows scrollbar gutter and causes unwanted horizontal scrolling');
 assert.ok(homeStyles.includes('.hhba-public-entry-grid.hhba-home-entry-grid{grid-template-columns:1fr;gap:11px}'));
});
test('home preserves job search, company directory and adds labor-rights support',()=>{
 for(const t of ['让机会与人才，找到彼此。','一份工作，值得认真选择。','你来到这里，是为了什么？',
    'title="求职与机会"','title="劳动权益"','title="企业招聘导航"','<UnifiedJobMarket compact/>']){
  assert.ok(home.includes(t),'home content unexpectedly removed: '+t);
 }
 assert.ok(home.includes("kind==='candidate'?(candidateTarget||'/candidate/match')"),
   '求职与机会 card must use the AI match destination');
 assert.ok(home.includes('candidateTarget={matchTarget}'));
 assert.ok(home.includes('onClick={()=>navigate(matchTarget)}'));
 assert.ok(home.includes('to={target}'), 'the whole card remains clickable');
 assert.ok(home.includes("kind==='rights'?'/rights/knowledge'"),
   'public rights card must open a standalone explanation');
 assert.ok(home.includes(":'/companies/library'"),'company directory entry must lead to the 17 industry halls');
 assert.ok(home.includes('className="home-match-promo"'),'resume matching link changed');
 assert.ok(home.includes('<HomeWorkplacePromise/>'));
});
