import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';import {chromium} from 'playwright';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const dir='mainline-v2-browser-proof';mkdirSync(dir,{recursive:true});
const proof={desktop:false,mobile:false,realCampusPhotos:false,credits:false,lightbox:false,degreeRoute:false,fees:false,internationalAdmission:false,faq:false,noUncaughtErrors:false};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'study-abroad/university/tum',{waitUntil:'domcontentloaded',timeout:50000});
  await page.locator('[data-tum-deep-profile="true"]').waitFor({state:'visible',timeout:18000});
  assert(await page.getByRole('heading',{name:'慕尼黑工业大学',exact:true}).isVisible());
  assert.equal(await page.locator('.hhba-minot-facts>div').count(),6);
  assert.equal(await page.locator('#tum-degree .hhba-minot-narrative').count(),6);
  assert.equal(await page.locator('#tum-admission .hhba-minot-step').count(),11);
  assert((await page.locator('#tum-admission').innerText()).includes('VPD'));
  assert((await page.locator('#tum-costs').innerText()).includes('€6,000'));
  proof.internationalAdmission=true;proof.fees=true;
  const gallery=page.locator('[data-tum-gallery]');assert.equal(await gallery.locator('.hhba-minot-thumb').count(),3);
  await gallery.scrollIntoViewIfNeeded();
  for(const img of await gallery.locator('img').all()){
   await img.scrollIntoViewIfNeeded();
   await img.evaluate(async el=>{if(!el.complete)await new Promise((ok,bad)=>{el.addEventListener('load',ok,{once:true});el.addEventListener('error',bad,{once:true})});if(!el.naturalWidth)throw Error('Garching campus image missing: '+el.src)});
  }
  proof.realCampusPhotos=true;
  const before=await gallery.locator('.hhba-minot-photo-trigger img').getAttribute('src');
  await gallery.locator('.hhba-minot-thumb').nth(2).click();
  assert.notEqual(before,await gallery.locator('.hhba-minot-photo-trigger img').getAttribute('src'));
  assert((await gallery.locator('.hhba-minot-photo-credit').innerText()).includes('TobiasK'));
  assert.equal(await gallery.locator('.hhba-minot-photo-credit a').count(),2);
  proof.credits=true;
  await gallery.locator('.hhba-minot-photo-trigger').click();
  await page.getByRole('dialog',{name:'TUM 校园照片放大'}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'下一张照片'}).click();
  await page.getByRole('button',{name:'关闭照片放大'}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  proof.lightbox=true;
  await page.locator('#tum-faq button').nth(1).click();
  assert((await page.locator('#tum-faq').innerText()).includes('€6,000'));proof.faq=true;
  await page.screenshot({path:dir+'/tum-university-'+width+'.png',fullPage:true});
  await page.goto(base+'study-abroad/program/tum-informatics-ms',{waitUntil:'domcontentloaded'});
  await page.locator('.hhba-minot-degree-hero').waitFor({state:'visible'});
  assert((await page.locator('.hhba-minot-degree-hero').innerText()).includes('信息学理学硕士'));
  assert.equal(await page.locator('#tum-degree .hhba-minot-narrative').count(),6);
  assert((await page.locator('.hhba-minot-metadata').innerText()).includes('120 ECTS'));
  proof.degreeRoute=true;
  assert.deepEqual(errors,[],'Uncaught JavaScript error on real TUM deep school');
  if(width===1440)proof.desktop=true;else proof.mobile=true;
  await page.close();
 }
 proof.noUncaughtErrors=true;writeFileSync(dir+'/tum-browser-result.json',JSON.stringify(proof,null,2));
 console.log('HHBA_TUM_DEEP_CHROMIUM_PASS',JSON.stringify(proof));
}finally{await browser.close()}
