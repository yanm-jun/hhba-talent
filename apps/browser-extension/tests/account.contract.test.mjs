import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cleanPairCode,validDeviceSession,accountApi,HHBA_PERMISSION,
 HHBA_EXTENSION_API,EXTENSION_SESSION_KEY} from '../account.mjs';
const token={token:'hhbaext_'+'a'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString()};
test('one-time code normalization rejects malformed codes',()=>{
 assert.equal(cleanPairCode('ABCDEF-GHJKLM'),'ABCDEFGHJKLM');
 assert.equal(cleanPairCode('abc defghjklm'),'ABCDEFGHJKLM');
 assert.equal(cleanPairCode('12345'),null);
});
test('read-only browser token is separate from website login, expires and stays in session storage',()=>{
 assert.equal(validDeviceSession(token),true);
 assert.equal(validDeviceSession({...token,token:'website_login_token'}),false);
 assert.equal(validDeviceSession({...token,expiresAt:'2020-01-01T00:00:00Z'}),false);
 assert.equal(EXTENSION_SESSION_KEY,'hhba.apply.extension.session.v1');
 const manifest=JSON.parse(readFileSync(new URL('../manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.version,'0.4.0');
 assert.deepEqual(manifest.optional_host_permissions,[HHBA_PERMISSION]);
 assert.ok(!manifest.host_permissions);
});
test('account requests omit cookies and never support client-issued spending or grants',async()=>{
 let last;
 const fake=async(url,options)=>{
  last={url,options};
  return new Response(JSON.stringify({ok:true,wallet:{purchased:10,consumed:3,reserved:1,available:6}}),{status:200});
 };
 const data=await accountApi(fake,'/wallet',token);
 assert.equal(data.wallet.available,6);
 assert.equal(last.url,HHBA_EXTENSION_API+'/wallet');
 assert.equal(last.options.credentials,'omit');
 assert.equal(last.options.headers.Authorization,'Bearer '+token.token);
 assert.equal(last.options.method,'GET');
 await assert.rejects(()=>accountApi(fake,'/grant',token),/只允许/);
 await assert.rejects(()=>accountApi(fake,'/pay',token),/只允许/);
 await assert.rejects(()=>accountApi(fake,'/settle',token),/只允许/);
});
test('extension claim uses explicit one-time code and no website bearer',async()=>{
 let req;
 const fake=async(url,options)=>{
  req={url,options};
  return new Response(JSON.stringify({ok:true,token:token.token,expiresAt:token.expiresAt}),{status:200});
 };
 await accountApi(fake,'/claim',null,{code:'ABCDEF-GHJKLM'});
 assert.equal(req.options.method,'POST');
 assert.ok(!req.options.headers.Authorization);
 assert.equal(req.options.credentials,'omit');
 assert.equal(JSON.parse(req.options.body).code,'ABCDEFGHJKLM');
 await assert.rejects(()=>accountApi(fake,'/claim',null,{code:'123'}),/请输入正确/);
});
