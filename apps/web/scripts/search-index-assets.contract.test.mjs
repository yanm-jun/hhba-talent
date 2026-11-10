import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const script=resolve('scripts/build-search-index-assets.mjs');
test('public HTML has unique metadata and private paths never enter sitemap',()=>{
 const root=mkdtempSync(join(tmpdir(),'hhba-seo-'));
 try{
  mkdirSync(join(root,'dist/companies/autumn/cn-autumn-034'),{recursive:true});
  mkdirSync(join(root,'dist/candidate/match'),{recursive:true});
  mkdirSync(join(root,'src/data/employerProfiles'),{recursive:true});
  const html='<!doctype html><html><head><meta name="description" content="old" /><meta property="og:title" content="old" /><meta property="og:description" content="old" /><meta property="og:url" content="https://hhba.work/" /><link rel="canonical" href="https://hhba.work/" /><title>old</title></head><body><div id="root"></div><script src="/assets/main.js"></script></body></html>';
  writeFileSync(join(root,'dist/index.html'),html);
  writeFileSync(join(root,'dist/companies/autumn/cn-autumn-034/index.html'),html);
  writeFileSync(join(root,'dist/candidate/match/index.html'),html);
  writeFileSync(join(root,'dist/robots.txt'),'User-agent: *\nSitemap: https://hhba.work/sitemap.xml\n');
  writeFileSync(join(root,'dist/_headers'),'');
  writeFileSync(join(root,'src/data/employerProfiles/cn-autumn-034.json'),JSON.stringify({id:'cn-autumn-034',displayName:'鹏芯微',overview:'半导体制造与校园招聘信息',lastReviewed:'2026-10-31',recruitment:{status:'archived_source',url:'https://university.example.edu/announcements/42'}}));
  execFileSync(process.execPath,[script],{cwd:root,encoding:'utf8',env:{...process.env,CF_PAGES_COMMIT_SHA:'1234567890123456789012345678901234567890'}});
  const home=readFileSync(join(root,'dist/index.html'),'utf8');
  const co=readFileSync(join(root,'dist/companies/autumn/cn-autumn-034/index.html'),'utf8');
  const directory=readFileSync(join(root,'dist/companies/discover/index.html'),'utf8');
  const cities=readFileSync(join(root,'dist/talent-service/cities/index.html'),'utf8');
  const sitemap=readFileSync(join(root,'dist/sitemap.xml'),'utf8');
  const release=JSON.parse(readFileSync(join(root,'dist/seo-release.json'),'utf8'));
  assert.equal(release.sha,'1234567890123456789012345678901234567890');
  assert.equal(release.publicUrlCount,18);
  assert.match(home,/<h1>汇方职场 HHBA<\/h1>/);
  // Critical: the temporary SEO navigation must never paint as the homepage
  // when React is loading on a real iPhone/Android browser.
  assert.match(home,/<div id="root"><style id="hhba-boot-style">/);
  assert.match(home,/<div class="hhba-app-boot"/);
  assert.match(home,/正在打开完整网站/);
  assert.match(home,/hhba-boot-trouble/);
  assert.match(home,/reduced-motion/);
  assert.match(home,/<noscript>/);
  assert.match(home,/<h1>汇方职场 HHBA<\/h1>/);
  assert.match(home,/<script src="\/assets\/main.js"><\/script>/);
  assert.doesNotMatch(home,/hhba-seo-entry|hhba-seo-hero|hhba-seo-fallback-style/);
  assert.doesNotMatch(home,/location\.reload\(\)/);
  assert.ok(home.indexOf('hhba-app-boot')<home.indexOf('<noscript>'),'Loading shell must precede no-JS content');
  assert.match(co,/<noscript>/);
  assert.match(co,/半导体制造与校园招聘信息/);
  assert.match(co,/href="https:\/\/hhba.work\/companies\/discover\/"/);
  assert.match(directory,/已整理企业档案（1 家）/);
  assert.match(directory,/href="https:\/\/hhba.work\/companies\/autumn\/cn-autumn-034\/"[^>]*>鹏芯微<\/a>/);
  assert.match(cities,/北京人才政策与住房/);
  assert.match(cities,/不代表已经覆盖全部城市/);
  assert.match(co,/<title>鹏芯微企业档案/);
  assert.match(co,/半导体制造与校园招聘信息/);
  assert.match(co,/返回汇方职场企业目录/);
  assert.match(co,/当前档案未核验企业官方在线投递入口/);
  assert.doesNotMatch(co,/university.example.edu|访问企业官方招聘入口/);
  assert.match(co,/companies\/autumn\/cn-autumn-034\/"/);
  assert.match(sitemap,/https:\/\/hhba.work\/talent-service\/city\/%E5%8C%97%E4%BA%AC\//);
  assert.match(sitemap,/cn-autumn-034\/<\/loc><lastmod>2026-10-31<\/lastmod>/);
  assert.doesNotMatch(sitemap,/candidate\/match|admin-preview|api\//);
  assert.match(readFileSync(join(root,'dist/candidate/match/index.html'),'utf8'),/noindex,nofollow/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('mobile home retains real React homepage instead of deferring its key sections',()=>{
  const main=readFileSync(resolve('src/main.tsx'),'utf8');
  const home=readFileSync(resolve('src/pages/HomePage.tsx'),'utf8');
  assert.match(main,/import \{ HomePage \} from '\.\/pages\/HomePage'/);
  assert.match(main,/function AppLoadingState\(\)/);
  assert.match(main,/const ResumeUploadPage=lazy\(/);
  assert.match(main,/const EmployerEvidencePage=lazy\(/);
  assert.match(home,/<UnifiedJobMarket compact\/>/);
  assert.match(home,/<HomeCompanyMarquee\/>/);
  assert.match(home,/<HomeLiveDrawer\/>/);
  assert.doesNotMatch(home,/DeferredHomeSection/);
});
