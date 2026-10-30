import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base='http://127.0.0.1:4173/hhba-talent/preview-svolt/';
const dir='svolt-17-proof';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'companies/autumn/cn-autumn-013',{waitUntil:'domcontentloaded',timeout:45000});
  const root=page.locator('[data-company-template="factory-v1"][data-employer-id="cn-autumn-013"]');
  await root.waitFor({timeout:17000});
  const logo=root.locator('.hhba-kpmg-logo img'),photos=root.locator('.hhba-kpmg-photo-grid img');
  assert.equal(await photos.count(),2);
  for(const img of [logo,...await photos.all()]){
   await img.evaluate(async image=>{if(!image.complete)await new Promise(r=>{image.onload=r;image.onerror=r});if(!image.naturalWidth)throw Error('Broken stored SVOLT image '+image.src)});
  }
  const consent=page.getByRole('button',{name:'暂不同意'});
  if(await consent.isVisible().catch(()=>false))await consent.click();
  const jobs=root.locator('.hhba-major-linked-jobs .hhba-kpmg-role');
  assert.equal(await jobs.count(),7,'Seven official campus recruitment role categories must render');
  for(const major of ['电气工程及其自动化','材料科学与工程']){
   await root.locator('.hhba-major-quick-list button').filter({hasText:major}).click();
   assert((await jobs.count())>=1,'Major matching failed '+major);
  }
  await root.locator('.hhba-major-quick-list button').filter({hasText:'全部专业'}).click();
  assert.equal(await jobs.count(),7);
  assert.equal(await root.locator('.hhba-kpmg-service').count(),4);
  await root.getByRole('button',{name:/查看更多业务/}).click();
  assert.equal(await root.locator('.hhba-kpmg-service').count(),6);
  await page.screenshot({path:dir+'/svolt-'+width+'.png',fullPage:true});
  if(width===1440){
   await page.goto(base+'candidate/jobs',{waitUntil:'domcontentloaded'});
   const search=page.getByRole('textbox',{name:'自然语言搜索岗位'});
   await search.waitFor({timeout:18000});
   for(const term of ['蜂','巢','蜂巢','SVOLT','SVOLT Energy']){
    await search.fill(term);
    const card=page.locator('.domestic-company-card').filter({hasText:'蜂巢能源'}).first();
    await card.waitFor({timeout:18000});
    assert((await card.getAttribute('href'))?.endsWith('/companies/autumn/cn-autumn-013'));
    const mark=card.locator('.domestic-result-brand img');await mark.waitFor();
    await mark.evaluate(async el=>{if(!el.complete)await new Promise(r=>{el.onload=r;el.onerror=r});if(!el.naturalWidth)throw Error('Search result SVOLT logo missing')});
   }
   await search.fill('SVOLT');await page.screenshot({path:dir+'/search-svolt.png',fullPage:true});
   await page.goto(base+'candidate/jobs/cn-v2-profile-cn-autumn-013-research-technical-2027',{waitUntil:'domcontentloaded'});
   await page.getByText('研发技术岗',{exact:false}).first().waitFor({timeout:17000});
  }
  assert.deepEqual(errors,[],'JavaScript errors');
  await page.close();
 }
 writeFileSync(dir+'/result.json',JSON.stringify({profile:'cn-autumn-013',roleCategories:7,assets:3,template:'factory-v1',search:['蜂','巢','蜂巢','SVOLT'],major:true,mobile:true,status:'source-backed-categories-open-state-not-verified',result:'PASS'},null,2));
 console.log('HHBA_SVOLT_17_FACTORY_3_IMAGES_7_CAMPUS_CATEGORIES_SEARCH_MAJORS_PASS');
}finally{await browser.close()}
