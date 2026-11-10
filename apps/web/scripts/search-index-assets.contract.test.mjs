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
  writeFileSync(join(root,'src/data/employerProfiles/cn-autumn-034.json'),JSON.stringify({id:'cn-autumn-034',displayName:'鹏芯微',overview:'半导体制造与校园招聘信息',lastReviewed:'2026-10-31'}));
  execFileSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
  const home=readFileSync(join(root,'dist/index.html'),'utf8');
  const co=readFileSync(join(root,'dist/companies/autumn/cn-autumn-034/index.html'),'utf8');
  const sitemap=readFileSync(join(root,'dist/sitemap.xml'),'utf8');
  assert.match(home,/<h1>汇方职场 HHBA<\/h1>/);
  assert.match(co,/<title>鹏芯微企业档案/);
  assert.match(co,/companies\/autumn\/cn-autumn-034\/"/);
  assert.match(sitemap,/https:\/\/hhba.work\/talent-service\/city\/%E5%8C%97%E4%BA%AC\//);
  assert.match(sitemap,/cn-autumn-034\/<\/loc><lastmod>2026-10-31<\/lastmod>/);
  assert.doesNotMatch(sitemap,/candidate\/match|admin-preview|api\//);
  assert.match(readFileSync(join(root,'dist/candidate/match/index.html'),'utf8'),/noindex,nofollow/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
