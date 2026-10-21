import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../src/',import.meta.url);
const source=path=>readFileSync(new URL(path,base),'utf8');
test('candidate auth routes use isolated mock only while live account API disabled',()=>{
 const main=source('main.tsx');
 assert.match(main,/demoModeEnabled\s*\?\s*<DemoAuthPage/);
 assert.match(main,/if\(!employerApiReady\)\{setReady\(true\);return;\}/);
 assert.match(main,/candidate\/account/);
});
test('demo account cannot unlock real candidate or employer authenticated endpoints',()=>{
 const demo=source('services/demoAccount.ts');
 const auth=source('pages/DemoAuthPage.tsx');
 assert.ok(demo.includes('localStorage.setItem(KEY'));
 assert.ok(demo.includes("dispatchEvent(new Event('hhba:demo-account-change'))"));
 assert.ok(!demo.includes('api.login('));
 assert.ok(!demo.includes('api.register('));
 assert.ok(!auth.includes('type="password"'));
 assert.ok(auth.includes('不是真正注册或登录'));
 assert.ok(auth.includes('不需要密码'));
});
test('prototype has editable preferences and genuine device favorites but no fabricated activity',()=>{
 const page=source('pages/PersonalCenterPage.tsx');
 assert.ok(page.includes('updateDemoAccount({nickname,headline,city,intro,skills})'));
 assert.ok(page.includes('updateDemoAccount({preferredRole:role,preferredCity:targetCity,workMode:mode})'));
 assert.ok(page.includes('listSavedJobs()'));
 assert.ok(page.includes('暂无真实求职记录'));
 assert.ok(page.includes('不会获得企业权限'));
 assert.ok(page.includes('deleteDemoAccount()'));
});

test('personal center feature cards keep horizontal readable text and compact mobile layout',()=>{
 const page=source('pages/PersonalCenterPage.tsx');
 const styles=source('styles/demo-account.css');
 assert.ok(page.includes('className="hhba-account-tool-card"'));
 assert.ok(page.includes('className="hhba-account-tool-copy"'));
 assert.match(styles,/\.hhba-account-tool-copy\{[^}]*display:flex;flex-direction:column;[^}]*min-width:0;/);
 assert.match(styles,/\.hhba-account-tool-grid>a\.hhba-account-tool-card\{[^}]*grid-template-columns:20px minmax\(0,1fr\) 15px;/);
 assert.ok(styles.includes('min-height:88px'));
 assert.ok(styles.includes('.hhba-account-tool-grid{grid-template-columns:1fr}'));
 assert.ok(!styles.includes('grid-template-rows:auto auto'));
});
