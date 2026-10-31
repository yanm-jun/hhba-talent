#!/usr/bin/env node
// Real Chrome accessibility and interaction acceptance on unchanged HHBA homepage + deep details.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const out='mainline-v2-browser-proof';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const result={desktop:false,mobile:false,photoAssets:false,photoCredits:false,lightbox:false,programs:false,admissions:false,tuition:false,faq:false,sources:false,visaGuard:false};
async function dismiss(page){const b=page.getByRole('button',{name:'暂不同意'});if(await b.isVisible().catch(()=>false))await b.click();}
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:850},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'study-abroad/university/minot-state',{waitUntil:'domcontentloaded',timeout:60000});
  await dismiss(page);
  await page.locator('[data-minot-detail="official-longform"]').waitFor({state:'visible',timeout:15000});
  assert(await page.getByRole('heading',{name:'迈诺特州立大学',exact:true}).isVisible());
  assert.equal(await page.locator('.hhba-minot-facts>div').count(),6);
  assert.equal(await page.locator('.hhba-minot-program-card').count(),2);
  assert((await page.locator('#minot-cost').innerText()).includes('US$20,641'));
  assert((await page.locator('#minot-admissions').innerText()).includes('WES'));
  assert((await page.locator('#minot-admissions').innerText()).includes('IELTS'));
  result.admissions=true;result.tuition=true;
  const gallery=page.locator('[data-minot-gallery]');
  assert.equal(await gallery.locator('.hhba-minot-thumb').count(),3);
  for(const img of await gallery.locator('img').all()) {
   await img.evaluate(async el=>{
    if(!el.complete) await new Promise((resolve,reject)=>{el.addEventListener('load',resolve,{once:true});el.addEventListener('error',reject,{once:true});});
    if(!el.naturalWidth||!el.naturalHeight)throw Error('Campus photo failed to load: '+el.src);
   });
  }
  result.photoAssets=true;
  const selected=gallery.locator('.hhba-minot-photo-trigger img');
  const before=await selected.getAttribute('src');
  await gallery.locator('.hhba-minot-thumb').nth(1).click();
  const after=await selected.getAttribute('src');
  assert.notEqual(before,after,'Thumbnail must switch the displayed real photo');
  assert((await gallery.locator('.hhba-minot-photo-credit').innerText()).includes('Goldenpaw2000'));
  const attribution=gallery.locator('.hhba-minot-photo-credit a');
  assert.equal(await attribution.count(),2);
  assert((await attribution.first().getAttribute('href')).includes('commons.wikimedia.org'));
  result.photoCredits=true;
  await gallery.locator('.hhba-minot-photo-trigger').click();
  await page.getByRole('dialog',{name:'校园照片放大查看'}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'下一张校园照片'}).click();
  await page.getByRole('button',{name:'关闭图片放大'}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  result.lightbox=true;
  await page.locator('#minot-faq .hhba-minot-faq-item button').nth(2).click();
  assert((await page.locator('#minot-faq').innerText()).includes('I-20'));
  result.faq=true;
  assert((await page.locator('#minot-sources a').count())>=13);
  result.sources=true;
  await page.screenshot({path:out+'/minot-university-'+width+'.png',fullPage:true});
  const program=page.locator('.hhba-minot-program-card').first().getByRole('link',{name:/查看完整专业/});
  await program.click();
  await page.locator('.hhba-minot-degree-hero').waitFor({state:'visible'});
  assert((await page.locator('.hhba-minot-degree-hero').innerText()).includes('管理学理学硕士'));
  assert((await page.locator('.hhba-minot-deadlines').innerText()).includes('5 月 31 日'));
  assert.equal(await page.locator('.hhba-minot-narrative').count(),4);
  result.programs=true;
  await page.goto(base+'study-abroad/program/minot-cyber-ms',{waitUntil:'domcontentloaded'});
  await page.locator('.hhba-minot-warning').waitFor({state:'visible'});
  assert((await page.locator('.hhba-minot-warning').innerText()).includes('I-20'));
  assert((await page.locator('.hhba-minot-warning').innerText()).includes('未列入'));
  result.visaGuard=true;
  assert.deepEqual(errors,[],'Uncaught client runtime errors');
  if(width===1440)result.desktop=true;else result.mobile=true;
  await page.close();
 }
 writeFileSync(out+'/minot-state-live-chromium.json',JSON.stringify(result,null,2));
 console.log('HHBA_MINOT_DEEP_PROFILE_LIVE_CHROMIUM_PASS',JSON.stringify(result));
} finally {await browser.close();}
