import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const dir='mainline-v2-browser-proof';
mkdirSync(dir,{recursive:true});
const out={desktop:false,mobile:false,realPhotos:false,photoCredits:false,lightbox:false,programs:false,programDates:false,admissions:false,tuition:false,faq:false,links:false,noJavascriptErrors:false};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];const requests=[];const consoleWarnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleWarnings.push(m.text())});page.on('response',r=>{if(r.status()>=400)requests.push(r.status()+' '+r.url())});
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:50000});
  await page.waitForTimeout(500);
  console.log('HHBA_USD_HOME_CHECK',JSON.stringify({url:page.url(),body:(await page.locator('body').innerText()).slice(0,260),scripts:await page.locator('script[src]').evaluateAll(xs=>xs.map(x=>x.src)),errors,consoleWarnings,requests}));
  await page.goto(base+'study-abroad/university/south-dakota',{waitUntil:'domcontentloaded',timeout:50000});
  const consent=page.getByRole('button',{name:'暂不同意'});if(await consent.isVisible().catch(()=>false))await consent.click();
  await page.waitForTimeout(1200);
  console.log('HHBA_USD_BROWSER_DIAGNOSTIC',JSON.stringify({url:page.url(),body:(await page.locator('body').innerText()).slice(0,850),root:(await page.locator('#root').innerHTML().catch(()=>'' )).slice(0,550),title:await page.title(),scripts:await page.locator('script[src]').evaluateAll(xs=>xs.map(x=>x.src)),errors,consoleWarnings,requests}));
  await page.locator('[data-usd="longform"]').waitFor({state:'visible'});
  assert(await page.getByRole('heading',{name:'南达科他大学',exact:true}).isVisible());
  assert.equal(await page.locator('.hhba-minot-facts>div').count(),6);
  assert.equal(await page.locator('.hhba-minot-program-card').count(),3);
  assert.equal(await page.locator('.hhba-minot-step').count(),7);
  assert((await page.locator('#usd-admissions').innerText()).includes('IELTS'));
  assert((await page.locator('#usd-costs').innerText()).includes('US$689.15'));
  out.admissions=true;out.tuition=true;
  const gallery=page.locator('[data-usd-gallery]');
  assert.equal(await gallery.locator('.hhba-minot-thumb').count(),3);
  await gallery.scrollIntoViewIfNeeded();
  for(const img of await gallery.locator('img').all()){
   await img.scrollIntoViewIfNeeded();
   await img.evaluate(async el=>{if(!el.complete)await new Promise((resolve,reject)=>{el.addEventListener('load',resolve,{once:true});el.addEventListener('error',reject,{once:true})});if(!el.naturalWidth||!el.naturalHeight)throw Error('real school photo 404: '+el.src);});
  }
  out.realPhotos=true;
  const original=await gallery.locator('.hhba-minot-photo-trigger img').getAttribute('src');
  await gallery.locator('.hhba-minot-thumb').nth(2).click();
  assert.notEqual(original,await gallery.locator('.hhba-minot-photo-trigger img').getAttribute('src'));
  assert((await gallery.locator('.hhba-minot-photo-credit').innerText()).includes('Ammodramus'));
  assert.equal(await gallery.locator('.hhba-minot-photo-credit a').count(),2);
  out.photoCredits=true;
  await gallery.locator('.hhba-minot-photo-trigger').click();
  await page.getByRole('dialog',{name:'南达科他大学照片放大'}).waitFor();
  await page.getByRole('button',{name:'下一张照片'}).click();
  await page.getByRole('button',{name:'关闭放大照片'}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  out.lightbox=true;
  const cards=page.locator('.hhba-minot-program-card');
  assert.equal(await cards.count(),3);
  await page.locator('#usd-faq .hhba-minot-faq-item button').nth(5).click();
  assert((await page.locator('#usd-faq').innerText()).includes('OPT'));
  out.faq=true;
  assert((await page.locator('#usd-sources a').count())>=12);
  out.links=true;
  await page.screenshot({path:dir+'/south-dakota-university-'+width+'.png',fullPage:true});
  for(const [id,label] of [['usd-business-analytics-ms','商业分析理学硕士'],['usd-mba','工商管理硕士'],['usd-cs-ms','计算机科学理学硕士']]){
   await page.goto(base+'study-abroad/program/'+id,{waitUntil:'domcontentloaded'});
   await page.locator('.hhba-minot-degree-hero').waitFor();
   assert((await page.locator('.hhba-minot-degree-hero').innerText()).includes(label));
   assert.equal(await page.locator('.hhba-minot-narrative').count(),4);
   assert.equal(await page.locator('.hhba-minot-deadlines>div').count(),2);
   assert((await page.locator('.hhba-minot-deadlines').innerText()).includes('2027'));
  }
  out.programs=true;out.programDates=true;
  assert.deepEqual(errors,[],'Uncaught browser errors');
  if(width===1440)out.desktop=true;else out.mobile=true;
  await page.close();
 }
 out.noJavascriptErrors=true;
 writeFileSync(dir+'/south-dakota-browser-result.json',JSON.stringify(out,null,2));
 console.log('HHBA_SOUTH_DAKOTA_CHROMIUM_PASS',JSON.stringify(out));
}finally{await browser.close();}
