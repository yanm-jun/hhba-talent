import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const page=read('../src/pages/PersonalCenterPage.tsx');
const product=read('../src/components/ApplyAssistantProduct.tsx');
const service=read('../src/services/applyCredits.ts');
const css=read('../src/styles/demo-account.css');
const entry=read('../src/main.tsx');
test('minimal workbench keeps true resume, saved jobs and matching history',()=>{
 assert.match(page,/hhba-workbench-overview/);
 assert.match(page,/resumeCount/);
 assert.match(page,/savedCount/);
 assert.match(page,/historyCount/);
 assert.match(page,/latestMatch/);
 assert.match(page,/label:'智能岗位匹配',path:'\/candidate\/account\/match'/);
 assert.doesNotMatch(page,/hhba-account-stat-grid|hhba-career-membership|hhba:career-stage:/);
 assert.ok(page.includes("label:'一键网申'"),'apply assistant remains in the grouped navigation');
 assert.ok(page.includes("to=\"/candidate/account/rights\""));
});
test('new link routes to an installation guide and keeps privacy safety disclaimers',()=>{
 assert.ok(entry.includes('privacy|apply-assistant'));
 assert.ok(page.includes("current==='apply-assistant'"));
 assert.ok(page.includes("<ApplyAssistantProduct userId={user?.id} active={current==='apply-assistant'}/>"));
 assert.ok(product.includes("BASE_URL+'downloads/hhba-apply-assistant-v0.5.zip'"));
 assert.ok(product.includes('正式申请由你确认'));
 assert.ok(product.includes('尚未开展正式收费网申'));
 assert.ok(product.includes('V0.5'));
 assert.ok(product.includes('产品演示视频'));
 assert.ok(service.includes("'/api/apply'"));
});
test('original account styling stays available while workbench uses compact cards',()=>{
 const theme=read('../src/styles/career-refresh.css');
 assert.match(theme,/\.hhba-workbench-profile-links/);
 assert.match(theme,/\.hhba-workbench-rights-main/);
 assert.match(theme,/@media\(max-width:620px\)/);
 assert.ok(css.includes('.hhba-account-tool-grid'),'original account subpages remain styled');
});
test('download archive is an actual ZIP containing extension sources',()=>{
 const zip=readFileSync(new URL('../public/downloads/hhba-apply-assistant-v0.2.zip',import.meta.url));
 assert.equal(zip.subarray(0,4).toString('hex'),'504b0304');
 for(const name of ['manifest.json','popup.html','popup.css','popup.js','core.mjs','content.js','README.md']){
  assert.ok(zip.includes(Buffer.from(name)),name);
 }
});

test('browser helper V0.5 download is a real ZIP with all install files',()=>{
 const zip=readFileSync(new URL('../public/downloads/hhba-apply-assistant-v0.5.zip',import.meta.url));
 assert.equal(zip.subarray(0,4).toString('hex'),'504b0304');
 for(const name of ['manifest.json','popup.html','popup.css','popup.js','core.mjs','content.js','account.mjs','README.md'])
  assert.ok(zip.includes(Buffer.from(name)),name);
});

test('site exposes pairing as a gated, revocable and account-scoped feature',()=>{
 assert.ok(product.includes('startApplyPair()'));
 assert.ok(product.includes('revokeApplyPairs()'));
 assert.ok(product.includes('连接码 5 分钟失效'));
 assert.ok(service.includes('getApplyPairStatus'));
 assert.ok(service.includes('pairingEnabled'));
});
