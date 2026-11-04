import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=read('src/pages/HomePage.tsx'),main=read('src/main.tsx'),popup=read('src/components/WinterInternshipPopup.tsx'),page=read('src/pages/WinterInternshipPage.tsx'),data=read('src/data/winter2027Programs.ts'),css=read('src/styles/winter-internship.css');
test('winter campaign replaces ONLY original homepage letter auto-popup',()=>{
 assert.ok(home.includes('<WinterInternshipPopup/>'));
 assert.ok(home.includes('<HomeOpenLetter autoOpen={false}/>'),'manual-only public letter component must be mounted');
 assert.ok(home.includes('读一封来自 HHBA 的信')&&home.includes('hhba:open-letter'),'public letter button must remain clickable');
 const letter=read('src/components/HomeOpenLetter.tsx');
 assert.ok(letter.includes('if (!autoOpen) return null;'),'letter must never auto-open during a regular visit');
 assert.ok(popup.includes("get('letter')==='1'"),'explicit letter shares must not be covered by winter popup');
 assert.ok(existsSync(new URL('../src/components/HomeOpenLetter.tsx',import.meta.url)),'public letter source must stay present');
 for(const stable of ['<UnifiedJobMarket compact/>','<HomeCompanyMarquee/>','<HomePeopleBanner/>','我要应聘','我要招人'])assert.ok(home.includes(stable),stable+' must remain');
});
test('first visit modal uses accessible close/escape/backdrop and real internal CTA',()=>{
 for(const part of ['aria-modal="true"','role="dialog"','aria-label="关闭寒假实习广告"',"event.key==='Escape'",'e.target===e.currentTarget','sessionStorage.setItem','to="/winter-internship"'])assert.ok(popup.includes(part),part+' missing');
 assert.ok(popup.includes('images/hhba-join-team.webp'),'existing locally-hosted campaign photo missing');
 assert.ok(css.includes('hhba-winter-modal-overlay')&&css.includes('@media(max-width:600px)'),'responsive centered modal CSS missing');
});
test('landing route and permanent programme-detail routes are public',()=>{
 for(const part of ["route==='/winter-internship'",'/^\\/winter-internship\\/[a-z0-9-]{3,100}$/.test(route)',"<WinterInternshipPage user={user}"])assert.ok(main.includes(part),part+' missing');
 assert.ok(page.includes('data-winter-page="directory"'));
 assert.ok(page.includes('data-winter-page="detail"'));
 assert.ok(page.includes("to={'/winter-internship/'+program.id}"));
 assert.ok(page.includes('href={p.sourceUrl}'));
 assert.ok(page.includes('target="_blank" rel="noopener noreferrer"'));
});
test('directory contains source-backed programmes without invented job numbers',()=>{
 const ids=[...data.matchAll(/\bid:'([a-z0-9-]+)'/g)].map(x=>x[1]);
 assert.equal(ids.length,4);
 assert.equal(new Set(ids).size,ids.length);
 for(const name of ['毕马威中国','德勤中国','摩根大通','APCO Worldwide'])assert.ok(data.includes(name),name+' missing');
 for(const source of ['kpmg.com','deloitte.com','jpmorganchase.com','oraclecloud.com'])assert.ok(data.includes(source));
 assert.ok(data.includes("checkedOn:'2026-11-04'"));
 assert.ok(!data.includes('currentOpenVerified:true'),'no false live availability');
});
test('site search and personal data flows are unchanged',()=>{
 assert.ok(!home.includes('siteSearchIndex'));
 assert.ok(!popup.includes('localStorage'),'no private auth tokens read');
 assert.ok(page.includes('过滤')||page.includes('筛选'),'filter UI should exist');
});
