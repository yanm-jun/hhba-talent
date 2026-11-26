import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('the independent password-admin branch uses authenticated real D1 phase metrics',()=>{
 const dashboard=read('../../admin-preview/dashboard.js'),html=read('../../admin-preview/index.html'),metrics=read('../functions/api/admin/metrics.js');
 assert.match(metrics,/await verifyAdmin\(request,env\)/);
 assert.match(metrics,/v4Operations:await readV4PhaseOps\(db,since,until\)/);
 assert.match(html,/id="view-operations"/);
 assert.match(html,/id="v4-ops-refresh"/);
 assert.match(dashboard,/function renderV4Ops\(/);
 assert.match(dashboard,/function refreshV4Ops\(/);
 assert.match(dashboard,/credentials:'same-origin'/);
 assert.match(dashboard,/s\?\.quality==='no_records'/);
});
