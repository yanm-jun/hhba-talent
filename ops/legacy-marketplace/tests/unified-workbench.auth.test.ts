import {test,expect} from 'bun:test';
import {handlePrivateAdmin,privateAdminWorkspace} from '../admin-console.ts';

const secret='TEST_ONLY_DO_NOT_PUBLISH_UNIFIED_ADMIN_CREDENTIAL';
test('private workspace inventory is null-valued, not simulated business totals',()=>{
 const data=privateAdminWorkspace();
 expect(data.kind).toBe('HHBA_ADMIN_WORKSPACE_V1');
 expect(data.workflowDatabase).toBe('not_connected');
 expect(data.productionReviewerAuth).toBe('not_connected');
 expect(data.sensitiveData).toBe('not_connected');
 expect(data.modules.length).toBe(10);
 expect(data.modules.every(x=>x.pending===null&&x.total===null&&!x.reviewAllowed)).toBe(true);
});
test('unconnected module directory is behind the ORIGINAL admin session',async()=>{
 Bun.env.HHBA_ADMIN_PASSWORD=secret;
 const endpoint=new URL('https://local.test/api/admin/workspace');
 const missing=await handlePrivateAdmin(new Request(endpoint),endpoint);
 expect(missing?.status).toBe(401);
 const login=new URL('https://local.test/management/login');
 const auth=await handlePrivateAdmin(new Request(login,{method:'POST',
  headers:{origin:login.origin,'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({password:secret})}),login);
 expect(auth?.status).toBe(303);
 const token=auth?.headers.get('set-cookie')?.split(';')[0]||'';
 const ok=await handlePrivateAdmin(new Request(endpoint,{headers:{cookie:token}}),endpoint);
 expect(ok?.status).toBe(200);
 expect(ok?.headers.get('cache-control')).toContain('no-store');
 const data=await ok?.json();
 expect(data.sensitiveData).toBe('not_connected');
 expect(data.modules.find((x:any)=>x.key==='commercial')?.total).toBeNull();
 for(const url of [
  'https://local.test/api/admin/workspace/approve',
  'https://local.test/api/admin/workspace/employee-feedback',
  'https://local.test/api/admin/order-proofs/123/verify'
 ]){
  const x=await handlePrivateAdmin(new Request(url,{method:'POST',headers:{cookie:token}}),new URL(url));
  expect(x?.status).toBe(404);
 }
 const asset=new URL('https://local.test/management/unified-workbench.js');
 const assetGuest=await handlePrivateAdmin(new Request(asset),asset);
 expect(assetGuest?.status).toBe(200);
 expect((await assetGuest?.text())).toContain('管理员登录');
});
