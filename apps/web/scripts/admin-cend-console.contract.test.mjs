import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('C-end admin uses one protected operations workspace and no B-end recruitment menus',()=>{
 const html=read('../../../apps/admin-preview/index.html');
 const js=read('../../../apps/admin-preview/dashboard.js');
 const css=read('../../../apps/admin-preview/cend-console.css');
 const build=read('./build-standalone-admin.py');
 assert.match(html,/C端运营工作区/);
 for(const id of ['overview','users','market','library','membership','rights','finance','operations','settings']){
  assert.match(html,new RegExp('data-view="'+id+'"'));
 }
 assert.match(html,/17个行业馆/);
 assert.match(html,/个人用户分析/);
 assert.match(html,/会员与月度服务/);
 assert.match(html,/权益支持案件/);
 assert.doesNotMatch(html,/data-view="investor"/);
 assert.doesNotMatch(html,/企业招聘图书馆/);
 assert.doesNotMatch(html,/企业账户审核|企业入驻|企业招聘管理|职位发布审批/);
 assert.match(html,/id="hhba-command-center"/);
 assert.match(html,/id="view-finance"/);
 assert.match(html,/id="view-library"/);
 assert.match(html,/id="view-membership"/);
 assert.match(html,/id="view-rights"/);
 assert.match(js,/'membership','rights','operations','finance'/);
 assert.match(js,/document.querySelectorAll\('\[data-workspace-target\]'\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(build,/cend-console-hhba-v1\.css/);
 assert.match(build,/feat\/admin-password-console-20261112/);
});

test('membership and rights plans show unknown metrics, not fake income, active cases or paid subscribers',()=>{
 const html=read('../../../apps/admin-preview/index.html');
 assert.match(html,/产品状态：尚未开放购买/);
 assert.match(html,/案件受理：尚未开放/);
 assert.match(html,/¥24\.90/);
 for(const label of ['当前已核验付费会员','真实待办案件','本月已交付真实报告','已支付协作劳务费']){
  assert.ok(html.includes(label),label);
 }
 assert.match(html,/尚无受理账本与案卷系统/);
 assert.match(html,/未接入支付凭据与会员账本/);
 assert.match(html,/正式律师函只能由具备执业资格的律师或律所/);
 assert.doesNotMatch(html,/\b模拟营收\b.*\d{4,}/);
});

test('standalone admin private data routes and financial publication workflow stay intact',()=>{
 const html=read('../../../apps/admin-preview/index.html');
 const js=read('../../../apps/admin-preview/dashboard.js');
 const build=read('./build-standalone-admin.py');
 assert.match(js,/fetch\('\/admin-preview\/api\/metrics\?/);
 assert.match(js,/window\.hhbaFinance\?\.open\(\)/);
 assert.match(html,/id="hhba-fin-report-root"/);
 assert.match(html,/src="\/finance\.js"/);
 assert.match(html,/src="\/finance-report\.js"/);
 assert.match(html,/src="\/command-center\.js"/);
 assert.match(build,/"include":\["\/\*"\],"exclude":\[\]/);
 assert.match(build,/cend-console\.css/);
});
