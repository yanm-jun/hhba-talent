import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('Admin uses the EXACT public HHBA blue-orange bridge mark, not a recreated H placeholder',()=>{
 const official=read('../public/images/hhba-logo.svg');
 const admin=read('../../admin-preview/favicon.svg');
 assert.equal(admin,official);
 assert.match(admin,/HHBA 蓝橙连接桥标志/);
 assert.match(admin,/#3998ff/);
 assert.match(admin,/#ffca44/);
 const dashboard=read('../../admin-preview/index.html');
 assert.match(dashboard,/<div class="brand-mark"[^>]*><img src="\.\/favicon\.svg"/);
 assert.match(dashboard,/汇方职场<\/strong><small>HHBA · 管理中心<\/small>/);
 assert.doesNotMatch(dashboard,/<div class="brand-mark"[^>]*><span>H<\/span>/);
});
test('Login, first-time setup, browser favicon and management workspace share the same emblem',()=>{
 for(const path of ['../../admin-preview/login/index.html','../../admin-preview/setup/index.html']){
  const html=read(path);
  assert.match(html,/<img src="\/favicon\.svg" alt=""/);
  assert.match(html,/让机会与人才，找到彼此。/);
  assert.match(html,/汇方职场 <span>HHBA<\/span>/);
  assert.doesNotMatch(html,/<div class="mark">H<\/div>/);
 }
 const script=read('./build-standalone-admin.py');
 assert.match(script,/"favicon\.svg"/);
 assert.match(script,/SOURCE \/ f/);
});
test('Administration colors are consistently blue/orange, with unobtrusive mobile-safe background',()=>{
 const login=read('../../admin-preview/admin-login.css');
 const dash=read('../../admin-preview/styles.css');
 const library=read('../../admin-preview/library.css');
 assert.match(login,/#1569de/);
 assert.match(login,/#f8a13b/);
 assert.match(login,/radial-gradient/);
 assert.match(login,/@media\(max-width:480px\)/);
 assert.match(dash,/#287bf1/);
 assert.match(dash,/main-column/);
 assert.match(dash,/@media\(max-width:780px\)/);
 assert.match(library,/#4288ea/);
 assert.match(library,/lib-upload-preview/);
});

test('Fingerprinted CSS and hard-coded SVG dimensions prevent the real-life cached-style logo overlay',()=>{
 for(const path of ['../../admin-preview/login/index.html','../../admin-preview/setup/index.html']){
  const html=read(path);
  assert.match(html,/href="\/admin-login-brand-v2\.css"/);
  assert.match(html,/width="48" height="48"/);
  assert.match(html,/style="display:block;width:48px;height:48px;max-width:100%;object-fit:contain;flex:none"/);
 }
 const build=read('./build-standalone-admin.py');
 assert.match(build,/admin-login-brand-v2\.css/);
 assert.match(build,/styles-hhba-v2\.css/);
 assert.match(build,/library-hhba-v2\.css/);
 assert.match(build,/Cache-Control: no-cache/);
 const middleware=read('../functions/_middleware.js');
 assert.match(middleware,/path==='\/admin-login-brand-v2\.css'/);
 assert.match(middleware,/no-store, max-age=0, must-revalidate/);
});
