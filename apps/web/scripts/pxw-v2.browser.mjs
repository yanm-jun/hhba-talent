#!/usr/bin/env node
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:920},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'companies/autumn/cn-autumn-034/',{waitUntil:'domcontentloaded',timeout:60000});
  const root=page.locator('[data-employer-id="cn-autumn-034"]');
  await root.waitFor({timeout:15000});
  assert.equal(await root.locator('.hhba-kpmg-photo-grid img').count(),2);
  for(const img of await root.locator('.hhba-kpmg-photo-grid img').all()){
   await img.evaluate(async el=>{
    if(!el.complete)await new Promise(done=>{el.addEventListener('load',done,{once:true});el.addEventListener('error',done,{once:true})});
    if(!el.naturalWidth||!el.naturalHeight)throw Error('Broken PXW photo '+el.src);
   });
  }
  assert.equal(await root.locator('.hhba-v2-company-role').count(),11);
  assert.equal(await root.locator('.hhba-kpmg-service').count(),6);
  assert.equal(await root.locator('.hhba-v2-company-role > .hhba-v2-qizheng-role-actions').count(),0,'No blue permanent links');
  await root.getByRole('button',{name:'设备 / 自动化 (2)'}).click();
  assert.equal(await root.locator('.hhba-v2-company-role').count(),2,'Equipment only 2 relevant jobs');
  assert(await root.getByRole('heading',{name:'AMHS设备工程师（2027届）'}).isVisible());
  assert.equal(await root.locator('.hhba-v2-company-role:has-text("生产管理工程师")').count(),0);
  const job=root.locator('.hhba-v2-company-role').first();
  assert.equal(await job.locator('details:not([open])').count(),1);
  await job.locator('details summary').click();
  assert.equal(await job.locator('details[open]').count(),1);
  assert(await job.getByText('官方招聘入口').isVisible());
  await root.getByRole('button',{name:'全部专业 (11)'}).click();
  assert.equal(await root.locator('.hhba-v2-company-role').count(),11);
  assert.deepEqual(errors,[],errors.join('; '));
  mkdirSync('mainline-v2-browser-proof',{recursive:true});
  const filename='mainline-v2-browser-proof/pxw-034-'+width+'.png';
  await page.screenshot({path:filename,fullPage:true});
  results.push({width,jobs:11,equipment:2,photos:2,services:6,screenshot:filename});
  await page.close();
 }
}finally{await browser.close()}
writeFileSync('mainline-v2-browser-proof/pxw-034.json',JSON.stringify(results,null,2));
console.log('PXW_034_BROWSER_DESKTOP_AND_MOBILE_OK',JSON.stringify(results));
