import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');

test('single admin.hhba.work workspace embeds registered costs and monthly disclosure, not another login',()=>{
 const html=read('../../../apps/admin-preview/index.html');
 const build=read('../scripts/build-standalone-admin.py');
 const js=read('../../../apps/admin-preview/finance-report.js');
 assert.match(html,/id="view-finance"/);
 assert.match(html,/id="hhba-fin-report-root"/);
 assert.match(html,/src="\/finance\.js"/);
 assert.match(html,/src="\/finance-report\.js"/);
 assert.doesNotMatch(html,/hhba\.work\/transparency\/manage/);
 assert.match(build,/"finance-report\.js","finance-report\.css"/);
 assert.match(build,/Refusing standalone admin build on an unapproved branch/);
 assert.match(js,/const path='\/admin-preview\/api\/financial\/'/);
});

test('read-only expense reference requires same month, explicit approval, and empty field',()=>{
 const costs=read('../../../apps/admin-preview/finance.js');
 const report=read('../../../apps/admin-preview/finance-report.js');
 assert.match(costs,/getLoadedRegister\(month\)/);
 assert.match(costs,/data\.month!==month/);
 assert.match(report,/source\.month!==month/);
 assert.match(report,/source\.quality!=='owner_entered_unreconciled'/);
 assert.match(report,/if\(entry\.voided\|\|entry\.direction!=='expense'\)continue/);
 assert.match(report,/if\(!field\)continue/);
 assert.match(report,/!String\(node\.value\|\|''\)\.trim\(\)/);
 assert.match(report,/window\.confirm\('只将相同月份已登记、未冲销的费用参考/);
 assert.match(report,/未保存/);
 assert.match(report,/尚未保存/);
 assert.doesNotMatch(report,/fetch\(['"]https:\/\/hhba\.work\/api\/transparency\/admin/);
});

test('financial API is protected by existing password administrator AND finance owner whitelist',()=>{
 const handler=read('../functions/admin-preview/api/financial/[[path]].js');
 const login=read('../functions/_lib/admin-access.js');
 const middle=read('../functions/_middleware.js');
 assert.match(login,/if\(new URL\(request\.url\)\.hostname===ADMIN_HOST\)return verifyPasswordAdmin/);
 assert.match(middle,/verifyPasswordAdmin\(request,env\)/);
 assert.match(handler,/const admin=await verifyAdmin\(request,env\)/);
 assert.match(handler,/admin\.email!==expected/);
 assert.match(handler,/financeDb\(env\)/);
 assert.match(handler,/safeOrigin\(request\)/);
 assert.match(handler,/publishReviewed\(db/);
 assert.match(handler,/CONFIRMATION_REQUIRED|confirmPublish!==true/);
});
