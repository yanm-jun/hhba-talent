import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('recruitment remains primary; commercial flow is an employer sidebar feature',()=>{
 const main=read('src/main.tsx'),hub=read('src/pages/EmployerGrowthHubPage.tsx');
 for(const route of ['/employer/aid/apply','/employer/commercial','/admin/employer-aid']){
  assert.ok(main.includes("route==='"+route+"'"),route);
  assert.ok(main.includes("route==='"+route+"/'"),route+' slash deep link');
 }
 assert.ok(hub.includes('to="/employer/aid/apply"'));
 assert.ok(hub.includes('to="/employer/commercial"'));
 for(const symbol of ['EmployerWorkspacePage','EmployerScoringPage','EmployerAppealsPage','EmployerVerifiedProfilePage'])
  assert.ok(main.includes(symbol),symbol);
});
test('all business actions require disabled-by-default trusted service',()=>{
 const api=read('src/services/api.ts'),page=read('src/pages/EmployerAidCommercialPage.tsx');
 assert.match(api,/aidCommercialApiReady = employerApiReady && import\.meta\.env\.VITE_HHBA_AID_COMMERCIAL_API_ENABLED==='1'/);
 for(const msg of ['真实企业帮扶申请尚未开放','真实客户引荐后台尚未开放','真实帮扶审批与客户对接暂未开放','待可信帮扶服务接入','待独立审核服务接入','待匹配权限接入']){
  assert.ok(page.includes(msg),msg);
 }
 assert.match(page,/const enabled=aidCommercialApiReady&&user\?\.role==='admin'/);
});
test('buyer introduction and order claims cannot be conflated with actual deals',()=>{
 const page=read('src/pages/EmployerAidCommercialPage.tsx'),server=read('../api/aid_domain.py');
 for(const msg of ['已独立核验真实订单凭证','尚无独立核验的真实成交证明','客户同意','不保证获得订单'])
  assert.ok(page.includes(msg),msg);
 assert.match(page,/order_status==='independently_verified'/);
 assert.ok(!page.includes('恭喜已成交100万'));
 assert.ok(server.includes('INVALID_OPPORTUNITY_TRANSITION'));
});
