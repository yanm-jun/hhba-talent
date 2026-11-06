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
 assert.equal(manifest.version,'0.5.0');
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
 assert.equal(last.options.method,'POST');
 await assert.rejects(()=>accountApi(fake,'/grant',token),/没有操作|只允许/);
 await assert.rejects(()=>accountApi(fake,'/pay',token),/没有操作|只允许/);
 await assert.rejects(()=>accountApi(fake,'/settle',token),/没有操作|只允许/);
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

test('P0 shortcuts open HHBA first-party workspace; never read login tokens or auto-sync a private CV',()=>{
 const html=readFileSync(new URL('../popup.html',import.meta.url),'utf8');
 const popup=readFileSync(new URL('../popup.js',import.meta.url),'utf8');
 for(const id of ['open-hhba-account','open-hhba-resume']){
  assert.ok(html.includes('id="'+id+'"'));
  assert.ok(popup.includes('$("'+id+'").addEventListener("click"'));
 }
 assert.ok(popup.includes('https://hhba.work/candidate/account/apply-assistant'));
 assert.ok(popup.includes('https://hhba.work/candidate/account/resume'));
 assert.ok(html.includes('未经同意不会同步或发送原始文件'));
 assert.ok(!popup.includes('chrome.cookies'));
});

test('P0 extension displays first-party privacy policy without silently consenting',()=>{
 const html=readFileSync(new URL('../popup.html',import.meta.url),'utf8');
 assert.ok(html.includes('https://hhba.work/apply-extension-privacy.html'));
 assert.ok(html.includes('扫描版 PDF 暂不支持 OCR'));
 assert.ok(!html.includes('checked="checked"'));
});

test('P0 reviewed profile import is explicit, owner-bound and never uploads the original CV',async()=>{
 const popup=readFileSync(new URL('../popup.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../popup.html',import.meta.url),'utf8');
 const code='profile-sync-consent';
 assert.ok(html.includes('id="'+code+'"'));
 assert.ok(html.includes('id="profile-sync-claim"'));
 assert.ok(popup.includes('savedDeviceSession()'));
 assert.ok(popup.includes('accountApi(fetch,"/profile/claim",device)'));
 assert.ok(popup.includes('validateProfile(data.profile)'));
 assert.ok(popup.includes('await storeProfile(checked)'));
 assert.ok(popup.includes('$("profile-sync-consent").checked=false'));
 let outgoing;
 const fake=async(url,opts)=>{
  outgoing={url,opts};
  return new Response(JSON.stringify({ok:true,profile:{fullName:'模拟求职者',school:'虚构学院'}}),{status:200});
 };
 const response=await accountApi(fake,'/profile/claim',token);
 assert.equal(response.profile.fullName,'模拟求职者');
 assert.ok(outgoing.url.endsWith('/profile/claim'));
 assert.equal(outgoing.opts.credentials,'omit');
 assert.equal(outgoing.opts.headers.Authorization,'Bearer '+token.token);
 assert.equal(outgoing.opts.method,'POST');
 assert.equal(outgoing.opts.body,undefined);
});
