import assert from 'node:assert/strict';import {chromium} from 'playwright';import {mkdirSync,writeFileSync} from 'node:fs';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const dir='mainline-v2-browser-proof';mkdirSync(dir,{recursive:true});
const proof={desktop:false,mobile:false,threeRealPhotos:false,credits:false,lightbox:false,programRoutes:false,fees:false,admissions:false,faq:false,cleanJs:false};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'study-abroad/university/monash',{waitUntil:'domcontentloaded',timeout:55000});
  await page.locator('[data-monash-detail="deep"]').waitFor({state:'visible',timeout:18000});
  assert(await page.getByRole('heading',{name:'蒙纳士大学',exact:true}).isVisible());
  assert.equal(await page.locator('.hhba-minot-facts>div').count(),6);
  assert.equal(await page.locator('#monash-programs .hhba-minot-program-card').count(),2);
  assert.equal(await page.locator('#monash-admission .hhba-minot-step').count(),10);
  assert((await page.locator('#monash-costs').innerText()).includes('A$57,540'));
  proof.fees=true;proof.admissions=true;
  const gallery=page.locator('[data-monash-gallery]');assert.equal(await gallery.locator('.hhba-minot-thumb').count(),3);
  await gallery.scrollIntoViewIfNeeded();
  for(const img of await gallery.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(async el=>{if(!el.complete)await new Promise((r,j)=>{el.addEventListener('load',r,{once:true});el.addEventListener('error',j,{once:true})});if(!el.naturalWidth)throw Error('Real Monash campus photo not available: '+el.src);});}
  proof.threeRealPhotos=true;
  await gallery.locator('.hhba-minot-thumb').nth(1).click();
  assert((await gallery.locator('.hhba-minot-photo-credit').innerText()).includes('Melburnian'));
  assert.equal(await gallery.locator('.hhba-minot-photo-credit a').count(),2);
  proof.credits=true;
  await gallery.locator('.hhba-minot-photo-trigger').click();
  await page.getByRole('dialog',{name:'蒙纳士大学校园照片放大'}).waitFor();
  await page.getByRole('button',{name:'下一张校园照片'}).click();
  await page.getByRole('button',{name:'关闭校园照片'}).click();
  proof.lightbox=true;
  await page.locator('#monash-faq button').nth(3).click();
  assert((await page.locator('#monash-faq').innerText()).includes('20%'));proof.faq=true;
  await page.screenshot({path:dir+'/monash-university-'+width+'.png',fullPage:true});
  for(const [id,name] of [['monash-it-master','信息技术硕士'],['monash-bis-master','商业信息系统硕士']]){
   await page.goto(base+'study-abroad/program/'+id,{waitUntil:'domcontentloaded'});
   await page.locator('.hhba-minot-degree-hero').waitFor();
   assert((await page.locator('.hhba-minot-degree-hero').innerText()).includes(name));
   assert.equal(await page.locator('#monash-curriculum .hhba-minot-narrative').count(),6);
   assert((await page.locator('.hhba-minot-metadata').innerText()).includes('96 学分'));
  }
  proof.programRoutes=true;
  assert.deepEqual(errors,[],'JavaScript crash on clicked-in Monash page');
  if(width===1440)proof.desktop=true;else proof.mobile=true;
  await page.close();
 }
 proof.cleanJs=true;
 writeFileSync(dir+'/monash-browser-result.json',JSON.stringify(proof,null,2));
 console.log('HHBA_MONASH_DEEP_BROWSER_PASS',JSON.stringify(proof));
}finally{await browser.close();}
