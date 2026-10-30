import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/preview-shkp/').replace(/\\/?$/,'/');
const out='shkp-review';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'companies/autumn/cn-autumn-010',{waitUntil:'domcontentloaded',timeout:45000});
  const root=page.locator('[data-employer-id="cn-autumn-010"]');await root.waitFor({timeout:20000});
  assert.match(await page.locator('h1').first().innerText(),/新鸿基地产/);
  const images=root.locator('.hhba-kpmg-logo img, .hhba-kpmg-photo-grid img');
  assert.equal(await images.count(),3);
  for(const img of await images.all())await img.evaluate(async el=>{
    if(!el.complete)await new Promise(resolve=>{el.onload=resolve;el.onerror=resolve});
    if(el.naturalWidth===0)throw Error('Image failed to load: '+el.src);
  });
  const all=root.locator('.hhba-kpmg-role');
  assert.equal(await all.count(),8,'8 real independent SHKP job details visible');
  const chips=root.locator('.hhba-major-quick-list');
  assert.equal(await chips.locator('input').count(),0,'Company page must not add a search field');
  await chips.getByRole('button',{name:/市场营销/}).first().click();
  const related=await all.count();
  assert(related>=1 && related<8,'Profession filtering must reduce jobs: '+related);
  await page.screenshot({path:out+'/desktop.png',fullPage:true});
  await all.first().getByRole('link',{name:/查看/}).click();
  await page.waitForURL(/\/candidate\/jobs\/cn-v2-shkp-/, {timeout:15000});
  await page.locator('.unified-detail-card').waitFor({timeout:15000});
  assert.match(await page.locator('.unified-detail-card').innerText(),/新鸿基地产/);
  await page.goto(base+'candidate/jobs',{waitUntil:'domcontentloaded',timeout:45000});
  const q=page.getByRole('textbox',{name:'自然语言搜索岗位'});
  await q.waitFor({timeout:15000});
  for(const search of ['SHKP','新鸿基地产','Sun Hung Kai Properties']){
    await q.fill(search);
    await page.waitForFunction(()=>{let cards=[...document.querySelectorAll('.unified-job-card')];return cards.length>0&&cards.every(c=>c.textContent?.includes('新鸿基地产'))},null,{timeout:20000});
  }
  await page.screenshot({path:out+'/search.png',fullPage:true});
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:2,locale:'zh-CN'});
  await mobile.goto(base+'companies/autumn/cn-autumn-010',{waitUntil:'domcontentloaded'});
  await mobile.locator('[data-employer-id="cn-autumn-010"]').waitFor({timeout:15000});
  assert.equal(await mobile.locator('.hhba-kpmg-photo-grid img').count(),2);
  assert.equal(await mobile.locator('.hhba-kpmg-role').count(),8);
  await mobile.screenshot({path:out+'/mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  writeFileSync(out+'/result.json',JSON.stringify({photos:3,jobs:8,related,search:['SHKP','新鸿基地产','Sun Hung Kai Properties'],mobile:'PASS',jobDetail:'PASS'},null,2));
  console.log('HHBA_SHKP_BROWSER_DESKTOP_MOBILE_SEARCH_JOBS_PASS');
}finally{await browser.close();}
