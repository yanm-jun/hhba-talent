import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/preview-boyu/').replace(/\/?$/,'/');
const dir='boyu-15-review';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:930},locale:'zh-CN'});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto(base+'companies/autumn/cn-autumn-011',{waitUntil:'domcontentloaded',timeout:45000});
 const root=page.locator('[data-employer-id="cn-autumn-011"]');await root.waitFor({timeout:25000});
 const img=root.locator('.hhba-kpmg-logo img,.hhba-kpmg-photo-grid img');
 assert.equal(await img.count(),3,'Three distinct user images');
 for(const image of await img.all())await image.evaluate(async el=>{if(!el.complete)await new Promise(resolve=>{el.onload=resolve;el.onerror=resolve});if(!el.naturalWidth)throw Error('Image missing: '+el.src)});
 assert.equal(await root.locator('.hhba-kpmg-role').count(),2,'Two real dated source-backed roles');
 assert.equal(await root.locator('.hhba-major-quick-list input').count(),0,'Profession selection must not add search boxes');
 const chips=root.locator('.hhba-major-quick-list');
 await chips.getByRole('button',{name:/酒店管理/}).first().click();
 const filtered=await root.locator('.hhba-kpmg-role').count();
 assert(filtered>=1&&filtered<=2,'Major chip must retain related or unrestricted roles');
 await page.screenshot({path:dir+'/desktop.png',fullPage:true});
 await root.locator('.hhba-kpmg-role a').first().click();
 await page.waitForURL(/\/candidate\/jobs\/cn-v2-boyu-/, {timeout:15000});
 await page.locator('.unified-detail-card').waitFor({timeout:20000});
 await page.goto(base+'candidate/jobs',{waitUntil:'domcontentloaded',timeout:45000});
 const input=page.getByRole('textbox',{name:'自然语言搜索岗位'});await input.waitFor({timeout:15000});
 for(const term of ['泊','泊寓','PORT','PORT APARTMENT']){
  await input.fill(term);
  const card=page.locator('.domestic-company-card').filter({hasText:'万科泊寓'}).first();
  await card.waitFor({timeout:20000});
  assert((await card.getAttribute('href'))?.endsWith('/companies/autumn/cn-autumn-011'),'Brand company route '+term);
  const logo=card.locator('.domestic-result-brand img');await logo.waitFor({timeout:10000});
  assert((await logo.getAttribute('src'))?.includes('/images/boyu-user/boyu-logo.webp'));
  await logo.evaluate(async el=>{if(!el.complete)await new Promise(resolve=>{el.onload=resolve;el.onerror=resolve});if(!el.naturalWidth)throw Error('Brand logo broken')});
  assert((await card.innerText()).includes('已整理企业详情'));
 }
 await page.screenshot({path:dir+'/search.png',fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,locale:'zh-CN'});
 await mobile.goto(base+'companies/autumn/cn-autumn-011',{waitUntil:'domcontentloaded'});
 await mobile.locator('[data-employer-id="cn-autumn-011"]').waitFor();
 assert.equal(await mobile.locator('.hhba-kpmg-photo-grid img').count(),2);
 await mobile.screenshot({path:dir+'/mobile.png',fullPage:true});
 assert.deepEqual(errors,[],'No uncaught page errors');
 writeFileSync(dir+'/result.json',JSON.stringify({logo:true,images:3,roles:2,majorFilter:filtered,search:['泊','泊寓','PORT','PORT APARTMENT'],mobile:true,status:'PASS'},null,2));
 console.log('HHBA_BOYU_REAL_IMAGES_TWO_JOBS_MAJORS_SEARCH_MOBILE_PASS');
}finally{await browser.close()}
