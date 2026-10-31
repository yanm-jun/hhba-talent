import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';import {chromium} from 'playwright';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const dir='mainline-v2-browser-proof';mkdirSync(dir,{recursive:true});
const out={desktop:false,mobile:false,threePhotos:false,photoLicense:false,lightbox:false,twoDegrees:false,courseModules:false,accurateTuition:false,application:false,deadlines:false,faq:false,runtime:false};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto(base+'study-abroad/university/birmingham',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('[data-bham-detail="verified-longform"]').waitFor({state:'visible',timeout:18000});
 assert(await page.getByRole('heading',{name:'伯明翰大学',exact:true}).isVisible());
 assert.equal(await page.locator('.hhba-minot-facts>div').count(),6);
 assert.equal(await page.locator('#bham-programs .hhba-minot-program-card').count(),2);
 assert.equal(await page.locator('#bham-admission .hhba-minot-step').count(),10);
 assert((await page.locator('#bham-fees').innerText()).includes('£36,000'));
 assert((await page.locator('#bham-fees').innerText()).includes('待独立核验'));
 out.accurateTuition=true;out.application=true;
 const gallery=page.locator('[data-bham-gallery]');assert.equal(await gallery.locator('.hhba-minot-thumb').count(),3);
 await gallery.scrollIntoViewIfNeeded();
 for(const img of await gallery.locator('img').all()){
  await img.scrollIntoViewIfNeeded();
  await img.evaluate(async el=>{if(!el.complete)await new Promise((r,j)=>{el.addEventListener('load',r,{once:true});el.addEventListener('error',j,{once:true})});if(!el.naturalWidth||!el.naturalHeight)throw Error('Missing real campus JPEG '+el.src);});
 }
 out.threePhotos=true;
 const before=await gallery.locator('.hhba-minot-photo-trigger img').getAttribute('src');
 await gallery.locator('.hhba-minot-thumb').nth(2).click();
 assert.notEqual(before,await gallery.locator('.hhba-minot-photo-trigger img').getAttribute('src'));
 assert((await gallery.locator('.hhba-minot-photo-credit').innerText()).includes('Athikhun.suw'));
 assert.equal(await gallery.locator('.hhba-minot-photo-credit a').count(),2);
 out.photoLicense=true;
 await gallery.locator('.hhba-minot-photo-trigger').click();
 await page.getByRole('dialog',{name:'伯明翰大学真实照片放大'}).waitFor();
 await page.getByRole('button',{name:'下一张真实照片'}).click();
 await page.getByRole('button',{name:'关闭放大照片'}).click();
 assert.equal(await page.getByRole('dialog').count(),0);out.lightbox=true;
 await page.locator('#bham-faq button').nth(3).click();
 assert((await page.locator('#bham-faq').innerText()).includes('£34,740'));
 out.faq=true;
 await page.screenshot({path:dir+'/birmingham-university-'+width+'.png',fullPage:true});
 for(const [id,title] of [['birmingham-cs-conversion','计算机科学转换型硕士'],['birmingham-ai-conversion','人工智能与计算机科学转换型硕士']]){
  await page.goto(base+'study-abroad/program/'+id,{waitUntil:'domcontentloaded'});
  await page.locator('.hhba-minot-degree-hero').waitFor({state:'visible'});
  assert((await page.locator('.hhba-minot-degree-hero').innerText()).includes(title));
  assert.equal(await page.locator('#bham-curriculum .hhba-minot-narrative').count(),6);
  assert.equal(await page.locator('#bham-deadlines .hhba-minot-deadlines>div').count(),2);
  assert((await page.locator('#bham-fees').innerText()).includes('£3,000'));
 }
 out.courseModules=true;out.twoDegrees=true;out.deadlines=true;
 assert.deepEqual(errs,[],'Page failed with an uncaught Javascript error');
 await page.close();
 if(width===1440)out.desktop=true;else out.mobile=true;
}
out.runtime=true;writeFileSync(dir+'/birmingham-acceptance.json',JSON.stringify(out,null,2));console.log('HHBA_BIRMINGHAM_BROWSER_PASS',JSON.stringify(out));
}finally{await browser.close();}
