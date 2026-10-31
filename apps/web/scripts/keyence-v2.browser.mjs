import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(base+'companies/autumn/cn-autumn-157/',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response.status(),200,'Physical company deep link must return HTTP 200');
  const root=page.locator('[data-employer-id="cn-autumn-157"]');
  await root.waitFor({timeout:18000});
  assert.equal(await root.locator('.hhba-v2-company-role').count(),1);
  assert.equal(await root.locator('.hhba-kpmg-service').count(),6);
  assert.equal(await root.locator('.hhba-kpmg-photo-grid img').count(),2);
  for(const img of await root.locator('.hhba-kpmg-photo-grid img').all()){
   await img.evaluate(async el=>{
     if(!el.complete)await new Promise(done=>{el.addEventListener('load',done,{once:true});el.addEventListener('error',done,{once:true})});
     assert.ok(el.naturalWidth>100,'Broken KEYENCE image');
   });
  }
  const logo=root.locator('.hhba-kpmg-logo img');
  await logo.evaluate(async el=>{if(!el.complete)await new Promise(done=>{el.addEventListener('load',done,{once:true});el.addEventListener('error',done,{once:true})});if(el.naturalWidth===0)throw Error('Logo missing')});
  await root.getByRole('button',{name:'专业不限 (1)'}).click();
  assert.equal(await root.locator('.hhba-v2-company-role').count(),1);
  const job=root.locator('.hhba-v2-company-role').first();
  assert.equal(await job.locator('details:not([open])').count(),1);
  assert.equal(await root.locator('.hhba-v2-company-role > .hhba-v2-qizheng-role-actions').count(),0);
  await job.locator('details summary').click();
  assert.equal(await job.locator('details[open]').count(),1);
  assert.equal(await job.locator('[data-hhba-recruitment-outbound="true"]').count(),1);
  await root.getByRole('button',{name:'全部专业 (1)'}).click();
  assert.equal(await root.locator('.hhba-v2-company-role').count(),1);
  assert.deepEqual(errors,[],'Page errors in real browser');
  mkdirSync('mainline-v2-browser-proof',{recursive:true});
  await page.screenshot({path:'mainline-v2-browser-proof/keyence-157-'+width+'.png',fullPage:true});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-employer-id="cn-autumn-157"]').waitFor();
  console.log('KEYENCE_157_BROWSER_OK',width);
  await page.close();
 }
}finally{await browser.close()}
