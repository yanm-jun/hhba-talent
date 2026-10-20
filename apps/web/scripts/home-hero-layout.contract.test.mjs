import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const css=read('../src/styles.css');
const home=read('../src/pages/HomePage.tsx');

test('home hero uses compact desktop whitespace and larger typographic hierarchy',()=>{
 assert.ok(css.includes('.home-hero{margin-top:clamp(38px,7vh,68px)}'),
   'desktop title must not be pushed down by 16vh / 170px');
 assert.ok(css.includes('.home-hero h1{font-size:clamp(28px,3vw,31px)'),
   'main slogan must be bigger than the former 23px');
 assert.ok(css.includes('.home-hero p{font-size:16px;line-height:1.55'),
   'subtitle must be bigger than the former 14px');
 assert.ok(css.includes('.home-hero{text-align:center;margin:24px auto 19px}'),
   'title-to-cards whitespace must be compact');
});
test('mobile spacing and headline remain readable without horizontal overflow',()=>{
 assert.ok(css.includes('.home-hero{margin:28px 0 19px}'));
 assert.ok(css.includes('.home-hero h1{font-size:clamp(25px,6vw,28px)}'));
 assert.ok(css.includes('.home-hero p{font-size:15px}'));
 assert.ok(css.includes('.entry-grid,.workspace-grid,.summary-grid,.requirement-summary{grid-template-columns:1fr}'));
});
test('original landing double-entry and real job market are preserved',()=>{
 for(const t of ['让机会与人才，找到彼此。','你来到这里，是为了什么？',
    'title="我要应聘"','title="我要招人"','<UnifiedJobMarket compact/>']){
  assert.ok(home.includes(t),'home content unexpectedly removed: '+t);
 }
 assert.ok(home.includes("navigate(kind === 'candidate' ? '/candidate' : '/recruiter/register')"),
   'candidate/employer route changed');
 assert.ok(home.includes('className="home-match-promo"'),'resume matching link changed');
});
