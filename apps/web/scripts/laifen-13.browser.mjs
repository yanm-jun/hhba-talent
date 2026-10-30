import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const root=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/preview-laifen/').replace(/\/$/,'');
mkdirSync('laifen-review',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},locale:'zh-CN'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'/companies/autumn/cn-autumn-009',{waitUntil:'domcontentloaded',timeout:35000});
 const profile=page.locator('[data-employer-id="cn-autumn-009"]');
 await profile.waitFor({timeout:20000});
 const logo=profile.locator('.hhba-kpmg-logo img');
 assert((await logo.getAttribute('src')).endsWith('laifen-logo.webp'));
 const photos=profile.locator('.hhba-kpmg-photo-grid img');
 assert.equal(await photos.count(),2);
 for(const img of [logo,...await photos.all()]){
  await page.waitForFunction(el=>el.complete&&el.naturalWidth>0,await img.elementHandle(),{timeout:15000});
  assert.equal(await img.locator('xpath=..').locator('a').count(),0,'Images must not be third-party links');
 }
 const roles=profile.locator('.hhba-kpmg-role');
 assert.equal(await roles.count(),6);
 const chips=profile.locator('.hhba-major-quick-list');
 assert.equal(await chips.locator('input').count(),0);
 await chips.getByRole('button',{name:/电气工程及其自动化/}).first().click();
 const filtered=await roles.count();
 assert(filtered>0&&filtered<6,'Major filter must change visible roles');
 await page.screenshot({path:'laifen-review/desktop.png',fullPage:true});
 await roles.first().getByRole('link',{name:/查看/}).click();
 await page.waitForURL(/\/candidate\/jobs\/cn-v2-laifen-/,{timeout:15000});
 await page.waitForFunction(()=>document.body.innerText.includes('徕芬科技'),null,{timeout:15000});
 await page.goto(root+'/candidate/jobs',{waitUntil:'domcontentloaded',timeout:35000});
 const search=page.getByRole('textbox',{name:'自然语言搜索岗位'});
 await search.fill('Laifen');
 await page.waitForFunction(()=>document.querySelectorAll('.unified-job-card').length>0&&[...document.querySelectorAll('.unified-job-card')].every(e=>e.textContent.includes('徕芬科技')),{timeout:15000});
 const english=await page.locator('.unified-job-card').count();
 await search.fill('徕芬');
 await page.waitForFunction(()=>document.querySelectorAll('.unified-job-card').length>0&&[...document.querySelectorAll('.unified-job-card')].every(e=>e.textContent.includes('徕芬科技')),{timeout:15000});
 await page.screenshot({path:'laifen-review/search.png',fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,locale:'zh-CN'});
 await mobile.goto(root+'/companies/autumn/cn-autumn-009',{waitUntil:'domcontentloaded',timeout:35000});
 await mobile.locator('[data-employer-id="cn-autumn-009"]').waitFor({timeout:15000});
 assert.equal(await mobile.locator('.hhba-kpmg-role').count(),6);
 await mobile.screenshot({path:'laifen-review/mobile.png',fullPage:true});
 assert.deepEqual(errors,[],'No page errors');
 writeFileSync('laifen-review/result.json',JSON.stringify({logo:true,photos:2,allJobs:6,majorRelated:filtered,searchEnglish:english,searchChinese:true,detail:true,mobile:true},null,2));
 console.log('HHBA_LAIFEN_13_BROWSER_ALL_PASS');
}finally{await browser.close()}
