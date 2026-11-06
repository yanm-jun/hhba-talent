import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync} from 'node:crypto';
import {onRequest} from '../functions/api/apply/[[path]].js';
import {alipayConfigured,alipayCredentialsConfigured,amountFen,canonical,packagePriceFen,rsaSign,verifyAlipayNotification,tasksConfigured} from '../functions/_lib/apply-billing.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const page=read('../src/components/ApplyAssistantProduct.tsx');
const stylesheet=read('../src/styles/apply-assistant-product.css');
const handler=read('../functions/api/apply/[[path]].js');
const doc=read('../../../docs/APPLY_CREDITS_PHASE1_20261106.md');
const keypair=generateKeyPairSync('rsa',{modulusLength:2048,
 publicKeyEncoding:{type:'spki',format:'pem'},
 privateKeyEncoding:{type:'pkcs8',format:'pem'}
});
const env={ALIPAY_APP_ID:'2026000000000000',ALIPAY_SELLER_ID:'2088000000000000',
 ALIPAY_PRIVATE_KEY_PKCS8:keypair.privateKey,ALIPAY_PUBLIC_KEY:keypair.publicKey,
 HHBA_ALIPAY_NOTIFY_URL:'https://hhba.work/api/apply/alipay/notify'};
test('fixed service packages use integer cents and ignore user-supplied totals',()=>{
 assert.equal(packagePriceFen(10),300);assert.equal(packagePriceFen(20),600);
 assert.equal(packagePriceFen(50),1500);assert.equal(packagePriceFen(100),3000);
 assert.equal(packagePriceFen(1),null);assert.equal(packagePriceFen('10'),null);
 assert.equal(packagePriceFen(2000),null);
 assert.equal(amountFen('3.00'),300);assert.equal(amountFen('3.001'),null);
 assert.equal(amountFen('test'),null);
});
test('live merchant creation is opt-in and uses exactly the fixed callback URL',()=>{
 assert.equal(alipayCredentialsConfigured(env),true);
 assert.equal(alipayConfigured(env),false);
 assert.equal(alipayConfigured({...env,HHBA_APPLY_PAYMENTS_ENABLED:'1'}),true);
 assert.equal(alipayConfigured({...env,HHBA_APPLY_PAYMENTS_ENABLED:'1',HHBA_ALIPAY_NOTIFY_URL:'https://evil.example/notify'}),false);
 assert.equal(tasksConfigured({HHBA_APPLY_TASKS_ENABLED:'1'}),false,'cannot enable unverified engine by toggling a flag');
});
test('RSA2 signatures verify; changed amount or seller fails signature',async()=>{
 const notice={app_id:env.ALIPAY_APP_ID,out_trade_no:'2d6a626d-23ac-4b2b-bb14-aeb5cbd00998',
  total_amount:'3.00',trade_no:'202611061234567890',seller_id:env.ALIPAY_SELLER_ID,
  trade_status:'TRADE_SUCCESS',sign_type:'RSA2'};
 const sig=await rsaSign(notice,env.ALIPAY_PRIVATE_KEY_PKCS8);
 const form=new URLSearchParams({...notice,sign:sig});
 assert.equal(await verifyAlipayNotification(form,env.ALIPAY_PUBLIC_KEY),true);
 form.set('total_amount','30.00');
 assert.equal(await verifyAlipayNotification(form,env.ALIPAY_PUBLIC_KEY),false);
 assert.equal(canonical({...notice,sign:sig}).includes('sign='),false);
});
test('unconfigured site is not a billing switch and returns no invented credits',async()=>{
 const c=await onRequest({request:new Request('https://hhba.work/api/apply/config'),env:{}});
 assert.equal(c.status,200);
 const value=await c.json();
 assert.equal(value.paymentEnabled,false);
 assert.equal(value.tasksEnabled,false);
 assert.deepEqual(value.packages.map(p=>p.amountFen),[300,600,1500,3000]);
 const w=await onRequest({request:new Request('https://hhba.work/api/apply/wallet'),env:{}});
 assert.equal(w.status,503);
 const pay=await onRequest({request:new Request('https://hhba.work/api/apply/orders',{method:'POST',headers:{Origin:'https://hhba.work','Content-Type':'application/json'},body:'{"uses":10}'}),env:{}});
 assert.equal(pay.status,503);
});
test('missing or invalid bearer tokens may never view account-specific orders',async()=>{
 const db={prepare(){return {bind(){return {first:async()=>null,run:async()=>({})}}}}};
 const res=await onRequest({request:new Request('https://hhba.work/api/apply/orders'),env:{HHBA_PNVS_AUTH_DB:db}});
 assert.equal(res.status,401);
});
test('product has no public model marketing, no fake purchase, and no fake submission',()=>{
 assert.ok(page.includes('网申，不必再'));
 assert.ok(page.includes('产品演示视频'));
 assert.ok(page.includes('支付宝支付待开通'));
 assert.ok(page.includes('aria-pressed={choice.uses===p.uses}'));
 assert.ok(page.includes('getApplyWallet()'));
 assert.ok(page.includes('正式申请由你确认'));
 assert.ok(!page.toLowerCase().includes('deepseek'));
 assert.ok(!page.includes('自动提交成功'));
 assert.ok(stylesheet.includes('@media(max-width:520px)'));
 assert.ok(handler.includes("status='pending'"));
 assert.ok(handler.includes('verifyAlipayNotification(form,env.ALIPAY_PUBLIC_KEY)'));
 assert.ok(doc.includes('NOT')&&doc.includes('Cloudflare'));
});
