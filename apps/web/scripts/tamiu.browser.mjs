import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const dir='mainline-v2-browser-proof';
mkdirSync(dir,{recursive:true});
const out={desktop:false,mobile:false,realPhotos:false,photoAttribution:false,gallery:false,programLink:false,degreeDetail:false,admission:false,coas:false,faq:false,sourceLinks:false,runtime:true};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'study-abroad/university/tamiu',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('[data-tamiu="longform"]').waitFor({state:'visible',timeout:18000});
  assert(await page.getByRole('heading',{name:'德州农工国际大学',exact:true}).isVisible());
  assert.equal(await page.locator('.hhba-minot-facts>div').count(),6);
  assert.equal(await page.locator('#tamiu-admissions .hhba-minot-step').count(),8);
  assert((await page.locator('#tamiu-admissions').innerText()).includes('IELTS'));
  assert((await page.locator('#tamiu-costs').innerText()).includes('28,372'));
  out.admission=true;out.coas=true;
  const gallery=page.locator('[data-tamiu-gallery]');
  assert.equal(await gallery.locator('.hhba-minot-thumb').count(),3);
  await gallery.scrollIntoViewIfNeeded();
  for(const img of await gallery.locator('img').all()){
    await img.scrollIntoViewIfNeeded();
    await img.evaluate(async el=>{
      if(!el.complete)await new Promise((resolve,reject)=>{el.addEventListener('load',resolve,{once:true});el.addEventListener('error',reject,{once:true})});
      if(!el.naturalWidth||!el.naturalHeight)throw Error('Campus image failed to load: '+el.src);
    });
  }
  out.realPhotos=true;
  const before=await gallery.locator('.hhba-minot-photo-trigger img').getAttribute('src');
  await gallery.locator('.hhba-minot-thumb').nth(1).click();
  const after=await gallery.locator('.hhba-minot-photo-trigger img').getAttribute('src');
  assert.notEqual(before,after);
  assert((await gallery.locator('.hhba-minot-photo-credit').innerText()).includes('Billy Hathorn'));
  assert.equal(await gallery.locator('.hhba-minot-photo-credit a').count(),2);
  out.photoAttribution=true;
  await gallery.locator('.hhba-minot-photo-trigger').click();
  await page.getByRole('dialog',{name:'TAMIU 校园照片放大'}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'下一张校园照片'}).click();
  await page.getByRole('button',{name:'关闭校园照片'}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  out.gallery=true;
  await page.locator('#tamiu-faq button').nth(1).click();
  assert((await page.locator('#tamiu-faq').innerText()).includes('I-20'));
  out.faq=true;
  assert((await page.locator('#tamiu-sources .hhba-minot-source-grid a').count())>=12);
  out.sourceLinks=true;
  await page.screenshot({path:dir+'/tamiu-university-'+width+'.png',fullPage:true});
  await page.locator('#tamiu-mba .hhba-tamiu-primary-program a[href*="/program/"]').click();
  await page.locator('.hhba-minot-degree-hero').waitFor({state:'visible'});
  assert((await page.locator('.hhba-minot-degree-hero').innerText()).includes('工商管理硕士'));
  assert.equal(await page.locator('#tamiu-mba .hhba-minot-narrative').count(),4);
  assert.equal(await page.locator('#tamiu-admissions .hhba-minot-step').count(),8);
  assert((await page.locator('.hhba-minot-deadlines').innerText()).includes('6 月 1 日'));
  out.programLink=true;out.degreeDetail=true;
  assert.deepEqual(errors,[],'Uncaught JS runtime errors');
  if(width===1440)out.desktop=true;else out.mobile=true;
  await page.close();
 }
 writeFileSync(dir+'/tamiu-browser-result.json',JSON.stringify(out,null,2));
 console.log('HHBA_TAMIU_DEEP_CHROMIUM_PASS',JSON.stringify(out));
}finally{await browser.close();}
