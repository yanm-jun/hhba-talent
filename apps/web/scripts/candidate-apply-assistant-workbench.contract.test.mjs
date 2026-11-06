import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const page=read('../src/pages/PersonalCenterPage.tsx');
const product=read('../src/components/ApplyAssistantProduct.tsx');
const service=read('../src/services/applyCredits.ts');
const css=read('../src/styles/demo-account.css');
const entry=read('../src/main.tsx');
test('personal workbench has exactly four cards, preserves original data and adds helper link',()=>{
 const block=page.split('<div className="hhba-account-stat-grid">')[1]?.split('</div>')[0];
 assert.ok(block);
 assert.equal((block.match(/<Link to=/g)||[]).length,4);
 assert.ok(block.includes('已收藏岗位')&&block.includes('求职申请')&&block.includes('我的简历'));
 assert.ok(block.includes('to="/candidate/account/apply-assistant"'));
 assert.ok(block.includes('一键网申'));
 assert.ok(block.includes('¥0.30'));
 assert.ok(block.includes('savedCount')&&block.includes('resumeCount'));
});
test('new link routes to an installation guide and keeps privacy safety disclaimers',()=>{
 assert.ok(entry.includes('privacy|apply-assistant'));
 assert.ok(page.includes("current==='apply-assistant'"));
 assert.ok(page.includes('<ApplyAssistantProduct userId={user?.id}/>'));
 assert.ok(product.includes("BASE_URL+'downloads/hhba-apply-assistant-v0.5.zip'"));
 assert.ok(product.includes('正式申请由你确认'));
 assert.ok(product.includes('尚未开展正式收费网申'));
 assert.ok(product.includes('V0.5'));
 assert.ok(product.includes('产品演示视频'));
 assert.ok(service.includes("'/api/apply'"));
});
test('desktop is four columns; mobile is two columns',()=>{
 assert.ok(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
 assert.ok(css.includes('@media(max-width:620px){.hhba-account-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}'));
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

test('P0 install entry never presents an unreviewed ZIP as an approved store install',()=>{
 assert.ok(product.includes('VITE_HHBA_CHROME_WEB_STORE_URL'));
 assert.ok(product.includes('VITE_HHBA_EDGE_ADDONS_URL'));
 assert.ok(product.includes('chromewebstore.google.com'));
 assert.ok(product.includes('microsoftedge.microsoft.com'));
 assert.ok(product.includes('url.protocol'));
 assert.ok(product.includes('!path.test(url.pathname)'));
 assert.ok(product.includes('商店尚未发布'));
 assert.ok(product.includes('开发者内部测试'));
 assert.ok(product.includes('to="/candidate/account/resume"'));
 assert.ok(product.includes('简历自动解析与同步仍需单独开发和验收'));
});
