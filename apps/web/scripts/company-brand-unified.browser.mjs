import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/preview-shkp/').replace(/\/?$/,'/');
const out='brand-unified-review';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},locale:'zh-CN'});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto(base+'candidate/jobs',{waitUntil:'domcontentloaded',timeout:45000});
 const q=page.getByRole('textbox',{name:'自然语言搜索岗位'});
 await q.waitFor({timeout:20000});
 const expectations=[
  ['新','新鸿基地产','shkp-user/shkp-logo.webp','cn-autumn-010','8'],
  ['安克','安克创新','autumn-real-logos/cn-autumn-008.svg','cn-autumn-008','24'],
  ['徕芬','徕芬科技','laifen-user/laifen-logo.webp','cn-autumn-009','6']
 ];
 for(const [term,name,path,route,count] of expectations){
  await q.fill(term);
  const result=page.locator('.domestic-company-card').filter({hasText:name}).first();
  await result.waitFor({timeout:25000});
  assert((await result.getAttribute('href'))?.endsWith(route),'Wrong employer route: '+name);
  const mark=result.locator('.domestic-result-brand img');
  await mark.waitFor({timeout:10000});
  assert((await mark.getAttribute('src'))?.includes(path),'Wrong logo asset: '+name);
  await mark.evaluate(async img=>{
   if(!img.complete)await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve});
   if(!img.naturalWidth)throw Error('Logo broken: '+img.src);
  });
  const info=await result.innerText();
  assert(info.includes('已整理企业详情'), 'Reviewed status missing: '+name);
  assert(info.includes('整理 '+count+' 条'), 'Reviewed job record count mismatch: '+name);
  assert(!info.includes('仅名录信息')&&!info.includes('国内企业档案'),'Stale listing-only status: '+name);
  await page.screenshot({path:out+'/'+route+'.png',fullPage:true});
 }
 await q.fill('新');
 const shkp=page.locator('.domestic-company-card').filter({hasText:'新鸿基地产'}).first();
 await shkp.click();
 await page.locator('[data-employer-id="cn-autumn-010"]').waitFor({timeout:18000});
 await page.locator('.hhba-kpmg-logo img').evaluate(img=>{if(!img.complete||img.naturalWidth===0)throw Error('Detail logo missing')});
 await page.goto(base+'companies/discover',{waitUntil:'domcontentloaded'});
 const companyInput=page.getByRole('textbox',{name:'搜索200家企业'});
 await companyInput.fill('新');
 const card=page.locator('.domestic-company-card').filter({hasText:'新鸿基地产'}).first();
 await card.waitFor({timeout:20000});
 await card.locator('.domestic-result-brand img').evaluate(async img=>{if(!img.complete)await new Promise(r=>{img.onload=r;img.onerror=r});if(!img.naturalWidth)throw Error('Discovery logo broken')});
 await page.screenshot({path:out+'/discovery-new.png',fullPage:true});
 assert.deepEqual(errors,[],'No uncaught script errors');
 writeFileSync(out+'/result.json',JSON.stringify({logoSource:'shared-registry',verified:['新鸿基地产','安克创新','徕芬科技'],paths:3,legacyStatusGone:true,status:'PASS'},null,2));
 console.log('HHBA_UNIFIED_BRANDS_SEARCH_DISCOVERY_JOB_STATUS_BROWSER_PASS');
}finally{await browser.close()}
