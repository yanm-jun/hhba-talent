import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const promo=read('../src/styles/home-match-promo.css');
const market=read('../src/styles/unified-jobs.css');
const home=read('../src/pages/HomePage.tsx');

test('AI resume promo shares recruitment market inner width and horizontal center',()=>{
 assert.ok(market.includes('.unified-market{max-width:1120px;'));
 assert.ok(market.includes('padding:0 12px'));
 assert.ok(promo.includes('width:calc(100% - 24px);max-width:1096px'));
 assert.ok(promo.includes('margin:20px auto 0'));
 assert.ok(promo.includes('.home-match-promo + .unified-market{margin-top:38px}'));
});
test('shortened height and mobile stacking retain readable action button',()=>{
 assert.ok(promo.includes('max-width:1096px;padding:20px 22px'));
 assert.ok(promo.includes('@media(max-width:650px)'));
 assert.ok(promo.includes('.home-match-promo{flex-direction:column;align-items:stretch;gap:15px;padding:16px}'));
 assert.ok(promo.includes('.home-match-promo + .unified-market{margin-top:28px}'));
 assert.ok(promo.includes('.home-match-promo button{justify-content:center}'));
});
test('original HHBA home CTA, main dual-entry and shared job marketplace stay untouched',()=>{
 assert.ok(home.includes('className="home-match-promo"'));
 assert.ok(home.includes("navigate('/candidate/match')"));
 assert.ok(home.includes('title="我要应聘"'));
 assert.ok(home.includes('title="企业招聘导航"'));
 assert.ok(home.includes('<UnifiedJobMarket compact/>'));
});

test('remove only the redundant home company discovery banner, without deleting destination or later blocks',()=>{
 assert.doesNotMatch(home,/home-company-discover-link/);
 assert.doesNotMatch(home,/企业发现 · 200 家国内企业|探索 200 家企业/);
 const market=home.indexOf('<UnifiedJobMarket compact/>');
 const talent=home.indexOf('className="home-talent-service-link"');
 const marquee=home.indexOf('<HomeCompanyMarquee/>');
 assert(market>=0&&talent>market&&marquee>talent,
  'Market must flow to talent service and the domestic company marquee');
 assert.equal(home.includes('HomePeopleBanner'),false,
  'The unrelated lower-right photo banner was intentionally removed');
 assert.match(home,/to="\/talent-service"/);
 assert.match(home,/className="home-match-promo"/);
 assert.match(home,/title="我要应聘"/);
 assert.match(home,/title="企业招聘导航"/);
});
