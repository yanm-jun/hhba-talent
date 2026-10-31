import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(base+'companies/autumn/cn-autumn-035/',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response.status(),200,'Physical route index required to prevent 404');
  const root=page.locator('[data-employer-id="cn-autumn-035"]');
  await root.waitFor({timeout:16000});
  assert.equal(await root.locator('.hhba-v2-company-role').count(),14);
  assert.equal(await root.locator('.hhba-kpmg-service').count(),6);
  assert.equal(await root.locator('.hhba-kpmg-photo-grid img').count(),2);
  for(const img of await root.locator('.hhba-kpmg-photo-grid img').all()){
   await img.evaluate(async el=>{
    if(!el.complete)await new Promise(resolve=>{el.addEventListener('load',resolve,{once:true});el.addEventListener('error',resolve,{once:true})});
    if(el.naturalWidth<250)throw new Error('MINIEYE real photo not rendered');
   });
  }
  const logo=root.locator('.hhba-kpmg-logo img');
  await logo.evaluate(async el=>{if(!el.complete)await new Promise(resolve=>{el.addEventListener('load',resolve,{once:true});el.addEventListener('error',resolve,{once:true})});if(!el.naturalWidth)throw Error('MINIEYE logo not rendered')});
  assert.equal(await root.locator('.hhba-v2-company-role > .hhba-v2-qizheng-role-actions').count(),0,'No browser-default blue link stack');
  await root.getByRole('button',{name:'算法 / AI (4)'}).click();
  assert.equal(await root.locator('.hhba-v2-company-role').count(),4);
  assert(await root.getByRole('heading',{name:/规划模型算法工程师（上海）/}).isVisible());
  assert.equal(await root.locator('.hhba-v2-company-role:has-text("供应链管培生")').count(),0,'Unrelated job must stay hidden');
  const first=root.locator('.hhba-v2-company-role').first();
  assert.equal(await first.locator('details:not([open])').count(),1);
  await first.locator('details summary').click();
  assert.equal(await first.locator('details[open]').count(),1);
  assert.equal(await first.locator('[data-hhba-recruitment-outbound="true"]').count(),1);
  await root.getByRole('button',{name:'全部专业 (14)'}).click();
  assert.equal(await root.locator('.hhba-v2-company-role').count(),14);
  await root.getByRole('button',{name:'软件 / 数据 (4)'}).click();
  assert.equal(await root.locator('.hhba-v2-company-role').count(),4);
  assert.deepEqual(errors,[],errors.join('; '));
  mkdirSync('mainline-v2-browser-proof',{recursive:true});
  await page.screenshot({path:'mainline-v2-browser-proof/minieye-035-'+width+'.png',fullPage:true});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-employer-id="cn-autumn-035"]').waitFor();
  await page.close();
  console.log('MINIEYE_035_DESKTOP_MOBILE_BROWSER_OK',width);
 }
}finally{await browser.close()}
