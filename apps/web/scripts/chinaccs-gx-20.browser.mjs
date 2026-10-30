import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base='http://127.0.0.1:4173/hhba-talent/preview-chinaccs-gx/';
const dir='chinaccs-gx-20-proof';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'companies/autumn/cn-autumn-016',{waitUntil:'domcontentloaded',timeout:45000});
  const root=page.locator('[data-company-template="factory-v1"][data-employer-id="cn-autumn-016"]');
  await root.waitFor({timeout:18000});
  const images=root.locator('.hhba-kpmg-logo img, .hhba-kpmg-photo-grid img');
  assert.equal(await images.count(),3,'Parent group brand plus 2 separate group gallery images');
  for(const img of await images.all()){
   await img.evaluate(async el=>{if(!el.complete)await new Promise(r=>{el.onload=r;el.onerror=r});if(!el.naturalWidth)throw Error('Official group image cannot load: '+el.src)});
  }
  const consent=page.getByRole('button',{name:'暂不同意'});
  if(await consent.isVisible().catch(()=>false))await consent.click();
  const jobs=root.locator('.hhba-major-linked-jobs .hhba-kpmg-role');
  assert.equal(await jobs.count(),12,'12 published 2027 campus recruitment directions');
  for(const major of ['通信工程','计算机科学与技术']){
   await root.locator('.hhba-major-quick-list button').filter({hasText:major}).click();
   assert((await jobs.count())>=1,'Major matching broken: '+major);
  }
  await root.locator('.hhba-major-quick-list button').filter({hasText:'全部专业'}).click();
  assert.equal(await jobs.count(),12);
  assert.equal(await root.locator('.hhba-kpmg-service').count(),4);
  await root.getByRole('button',{name:/查看更多业务/}).click();
  assert.equal(await root.locator('.hhba-kpmg-service').count(),6);
  await page.screenshot({path:dir+'/company-'+width+'.png',fullPage:true});
  if(width===1440){
   await page.goto(base+'candidate/jobs',{waitUntil:'domcontentloaded'});
   const search=page.getByRole('textbox',{name:'自然语言搜索岗位'});await search.waitFor({timeout:18000});
   for(const term of ['通','服','广西通服','中国通服广西公司','China Comservice']){
    await search.fill(term);
    const card=page.locator('.domestic-company-card').filter({hasText:'中国通服广西公司'}).first();
    await card.waitFor({timeout:18000});
    assert((await card.getAttribute('href'))?.endsWith('/companies/autumn/cn-autumn-016'));
    const mark=card.locator('.domestic-result-brand img');await mark.waitFor();
    await mark.evaluate(async el=>{if(!el.complete)await new Promise(r=>{el.onload=r;el.onerror=r});if(!el.naturalWidth)throw Error('Search Logo missing')});
   }
   await page.screenshot({path:dir+'/search.png',fullPage:true});
   await page.goto(base+'candidate/jobs/cn-v2-profile-cn-autumn-016-ai-bigdata-rd-2027',{waitUntil:'domcontentloaded'});
   await page.getByText('AI大数据研发',{exact:false}).first().waitFor({timeout:17000});
  }
  assert.deepEqual(errors,[],'JavaScript errors');
  await page.close();
 }
 writeFileSync(dir+'/result.json',JSON.stringify({profile:'cn-autumn-016',roleCategories:12,images:3,search:['通','服','广西通服','China Comservice'],major:true,mobile:true,source:'2027 third-party summarized directions',result:'PASS'},null,2));
 console.log('HHBA_CHINACCS_GX_20_FACTORY_3_IMAGES_12_CATEGORIES_SEARCH_MAJORS_PASS');
}finally{await browser.close()}
