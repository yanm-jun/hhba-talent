import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const admin=read('../admin-ui/dashboard.js'),html=read('../admin-ui/index.html');
const ui=read('../admin-ui/unified-workbench.js'),server=read('../admin-console.ts');
test('reuse actual /management original investor and analytics, no duplicate admin console',()=>{
 for(const fragment of ['view-overview','view-users','view-investor','id="export-csv"']) assert.ok(html.includes(fragment),fragment);
 assert.ok(admin.includes("fetch('/api/admin/jobs'"));
 assert.ok(admin.includes("fetch('/api/admin/growth?"));
 assert.ok(admin.includes("mountUnifiedWorkbench(setView)"));
 assert.ok(admin.includes("byId('view-'+view)"));
 assert.ok(html.includes('./unified-workbench.css'));
});
test('single management navigation now links all real workbench groups',()=>{
 for(const key of ['recruitment','enterprise','inbox','evidence','care','scoring','appeals','improvements','publication','aid','commercial'])
  assert.ok(ui.includes(key+':')||ui.includes("'"+key+"'"),'missing view '+key);
 for(const label of ['招聘与企业','企业信誉治理','企业发展帮扶','统一审核待办','统一企业档案'])
  assert.ok(ui.includes(label),'missing '+label);
 assert.ok(!ui.includes('Math.random()'));
 assert.ok(!ui.includes('fakeScore'));
});
test('no sensitive module can be used through old global admin password',()=>{
 assert.ok(server.includes("if(!authenticated(req,p))"));
 assert.ok(server.includes("path==='/api/admin/workspace'&&req.method==='GET'"));
 assert.ok(server.includes("productionReviewerAuth:'not_connected'"));
 assert.ok(server.includes("workflowDatabase:'not_connected'"));
 assert.ok(server.includes("pending:null,total:null"));
 assert.ok(!server.includes("path==='/api/admin/approve'"));
 assert.ok(server.includes("'/management/unified-workbench.js'"));
 assert.ok(server.includes("'/management/unified-workbench.css'"));
 assert.ok(ui.includes("credentials:'same-origin'"));
 assert.ok(ui.includes("result.sensitiveData!=='not_connected'"));
});
test('safe UI handles missing sources without invented company, completed orders or scores',()=>{
 for(const message of ['尚未接入原后台','待接入真实组织数据','业务数据未接入','尚无可核实的数据源'])
  assert.ok(ui.includes(message),message);
 assert.ok(!ui.includes('已批准的订单：100'));
 assert.ok(!ui.includes('92/100'));
 assert.ok(!ui.includes('00000000-0000-0000-0000'));
});
