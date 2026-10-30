import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base='http://127.0.0.1:4173/hhba-talent/preview-ccteg/';
const dir='ccteg-19-proof';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'companies/autumn/cn-autumn-015',{waitUntil:'domcontentloaded',timeout:45000});
  const root=page.locator('[data-company-template="factory-v1"][data-employer-id="cn-autumn-015"]');
  await root.waitFor({timeout:17000});
  const logo=root.locator('.hhba-kpmg-logo img'),photos=root.locator('.hhba-kpmg-photo-grid img');
  assert.equal(await photos.count(),2);
  for(const img of [logo,...await photos.all()]){
   await img.evaluate(async image=>{if(!image.complete)await new Promise(r=>{image.onload=r;image.onerror=r});if(!image.naturalWidth)throw Error('Broken stored CCTEG image '+image.src)});
  }
  const consent=page.getByRole('button',{name:'暂不同意'});
  if(await consent.isVisible().catch(()=>false))await consent.click();
  const jobs=root.locator('.hhba-major-linked-jobs .hhba-kpmg-role');
  assert.equal(await jobs.count(),8,'Eight documented 2027 Shanghai subsidiary campus role categories must render');
  for(const major of ['机械设计制造及其自动化','电气工程及其自动化']){
   await root.locator('.hhba-major-quick-list button').filter({hasText:major}).click();
   assert((await jobs.count())>=1,'Major matching failed '+major);
  }
  await root.locator('.hhba-major-quick-list button').filter({hasText:'全部专业'}).click();
  assert.equal(await jobs.count(),8);
  assert.equal(await root.locator('.hhba-kpmg-service').count(),4);
  await root.getByRole('button',{name:/查看更多业务/}).click();
  assert.equal(await root.locator('.hhba-kpmg-service').count(),6);
  await page.screenshot({path:dir+'/ccteg-'+width+'.png',fullPage:true});
  if(width===1440){
   await page.goto(base+'candidate/jobs',{waitUntil:'domcontentloaded'});
   const search=page.getByRole('textbox',{name:'自然语言搜索岗位'});
   await search.waitFor({timeout:18000});
   for(const term of ['煤','科','中国煤科','CCTEG','China Coal']){
    await search.fill(term);
    const card=page.locator('.domestic-company-card').filter({hasText:'中国煤炭科工'}).first();
    await card.waitFor({timeout:18000});
    assert((await card.getAttribute('href'))?.endsWith('/companies/autumn/cn-autumn-015'));
    const mark=card.locator('.domestic-result-brand img');await mark.waitFor();
    await mark.evaluate(async el=>{if(!el.complete)await new Promise(r=>{el.onload=r;el.onerror=r});if(!el.naturalWidth)throw Error('Search result CCTEG logo missing')});
   }
   await search.fill('CCTEG');await page.screenshot({path:dir+'/search-ceec.png',fullPage:true});
   await page.goto(base+'candidate/jobs/cn-v2-profile-cn-autumn-015-mechanical-engineer',{waitUntil:'domcontentloaded'});
   await page.getByText('机械工程师',{exact:false}).first().waitFor({timeout:17000});
  }
  assert.deepEqual(errors,[],'JavaScript errors');
  await page.close();
 }
 writeFileSync(dir+'/result.json',JSON.stringify({profile:'cn-autumn-015',roleCategories:8,assets:3,template:'factory-v1',search:['煤','中国煤炭科工','CCTEG'],major:true,mobile:true,status:'source-backed-categories-open-state-not-verified',result:'PASS'},null,2));
 console.log('HHBA_CCTEG_19_FACTORY_3_IMAGES_8_CAMPUS_CATEGORIES_SEARCH_MAJORS_PASS');
}finally{await browser.close()}
