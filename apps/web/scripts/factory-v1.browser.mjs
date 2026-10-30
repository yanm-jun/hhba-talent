import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base='http://127.0.0.1:4173/hhba-talent/preview-factory/';
const dir='factory-proof';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'companies/autumn/cn-autumn-011',{waitUntil:'domcontentloaded',timeout:45000});
  const profile=page.locator('[data-company-template="factory-v1"][data-employer-id="cn-autumn-011"]');
  await profile.waitFor({timeout:20000});
  // Public site shows an optional anonymous-analytics consent sheet on
  // first visit. Close it before checking real user interactions.
  const consent=page.getByRole('button',{name:'暂不同意'});
  if(await consent.isVisible().catch(()=>false))await consent.click();

  const all=profile.locator('.hhba-kpmg-logo img, .hhba-kpmg-photo-grid img');
  assert.equal(await all.count(),3);
  for(const img of await all.all())await img.evaluate(async e=>{
   if(!e.complete)await new Promise(r=>{e.onload=r;e.onerror=r});
   if(!e.naturalWidth)throw Error('Broken media '+e.src);
  });
  assert.equal(await profile.locator('.hhba-major-linked-jobs .hhba-kpmg-role').count(),2);
  await profile.locator('.hhba-major-quick-list button').filter({hasText:'酒店管理'}).click();
  assert((await profile.locator('.hhba-major-linked-jobs .hhba-kpmg-role').count())>=1);
  assert.equal(await profile.locator('.hhba-kpmg-service').count(),4);
  await profile.getByRole('button',{name:/查看更多业务/}).click();
  assert.equal(await profile.locator('.hhba-kpmg-service').count(),6);
  await page.screenshot({path:dir+'/boyu-factory-'+width+'.png',fullPage:true});
  if(width===1440){
   await page.goto(base+'candidate/jobs',{waitUntil:'domcontentloaded'});
   const box=page.getByRole('textbox',{name:'自然语言搜索岗位'});
   await box.waitFor({timeout:15000});
   for(const q of ['泊','寓','PORT','PORT APARTMENT']){
    await box.fill(q);
    const company=page.locator('.domestic-company-card').filter({hasText:'万科泊寓'}).first();
    await company.waitFor({timeout:16000});
    const logo=company.locator('.domestic-result-brand img');
    await logo.evaluate(async img=>{
     if(!img.complete)await new Promise(r=>{img.onload=r;img.onerror=r});
     if(!img.naturalWidth)throw Error('Search logo missing');
    });
    assert((await company.getAttribute('href'))?.endsWith('/companies/autumn/cn-autumn-011'));
   }
   await page.screenshot({path:dir+'/search-PORT.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);
  await page.close();
 }
 writeFileSync(dir+'/summary.json',JSON.stringify({template:'factory-v1',pilot:'cn-autumn-011',oldJobs:2,images:3,mobile:true,search:['泊','寓','PORT','PORT APARTMENT'],result:'PASS'},null,2));
 console.log('EMPLOYER_FACTORY_BROWSER_PILOT_PASS');
}finally{await browser.close()}
