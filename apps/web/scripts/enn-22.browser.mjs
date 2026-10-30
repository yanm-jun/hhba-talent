import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base='http://127.0.0.1:4173/hhba-talent/preview-enn/';
const dir='enn-22-proof';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'companies/autumn/cn-autumn-018/',{waitUntil:'domcontentloaded',timeout:50000});
  const root=page.locator('[data-company-template="factory-v1"][data-employer-id="cn-autumn-018"]');
  await root.waitFor({timeout:30000});
  const consent=page.getByRole('button',{name:'暂不同意'});
  if(await consent.isVisible().catch(()=>false))await consent.click();
  assert((await root.locator('h1').innerText()).includes('新奥集团'),'wrong company identity');
  const imgs=root.locator('.hhba-kpmg-logo img,.hhba-kpmg-photo-grid img');
  assert.equal(await imgs.count(),3);
  for(const img of await imgs.all())await img.evaluate(async el=>{
   if(!el.complete)await new Promise(r=>{el.onload=r;el.onerror=r});
   if(!el.naturalWidth)throw Error('Company picture failed: '+el.src);
  });
  assert.equal(await root.locator('.hhba-kpmg-photo-grid a').count(),0,'photos must not link third parties');
  // Regression: the photo title must read horizontally and its source note must wrap
  // within the card. Previous flex row + nowrap produced one-character-wide titles.
  for(const caption of await root.locator('.hhba-kmpg-photo-grid figure figcaption, .hhba-kpmg-photo-grid figure figcaption').all()){
   const actual=await caption.evaluate(el=>{
    const title=el.querySelector('span'),note=el.querySelector('small');
    const outer=el.getBoundingClientRect();
    const titleRect=title?.getBoundingClientRect();
    const noteRect=note?.getBoundingClientRect();
    const style=getComputedStyle(el);
    const sourceStyle=note?getComputedStyle(note):null;
    return {
     outerWidth:outer.width,titleWidth:titleRect?.width||0,noteWidth:noteRect?.width||0,
     outerOverflow:el.scrollWidth>el.clientWidth+2,
     noteOverflow:!!note&&note.scrollWidth>note.clientWidth+2,
     direction:style.flexDirection,sourceWrap:sourceStyle?.whiteSpace,
     writing:style.writingMode,visible:outer.height>0
    };
   });
   assert(actual.visible&&actual.outerWidth>210,'Photo caption is too narrow or hidden');
   assert.equal(actual.direction,'column','Caption must stack title and source vertically');
   assert.equal(actual.writing,'horizontal-tb','Caption writing direction must be horizontal');
   assert.equal(actual.sourceWrap,'normal','Source note must be allowed to wrap');
   assert(actual.titleWidth>actual.outerWidth*.70,'Title is still squeezed into a vertical strip');
   assert(actual.noteWidth>actual.outerWidth*.70,'Source note still overflows horizontally');
   assert(!actual.outerOverflow&&!actual.noteOverflow,'Photo caption text overflows its card');
  }

  const jobs=root.locator('.hhba-major-linked-jobs .hhba-kpmg-role');
  assert.equal(await jobs.count(),15,'should display 15 sourced professional directions');
  for(const major of ['计算机科学与技术','市场营销']){
   await root.locator('.hhba-major-quick-list button').filter({hasText:major}).first().click();
   assert((await jobs.count())>0,'major has no matched records: '+major);
  }
  await root.locator('.hhba-major-quick-list button').filter({hasText:'全部专业'}).first().click();
  assert.equal(await jobs.count(),15);
  await root.locator('.hhba-kpmg-service-more').click();
  assert.equal(await root.locator('.hhba-kpmg-service').count(),6);
  assert.equal(await root.locator('[data-hhba-recruitment-outbound="true"]').count(),1);
  await page.screenshot({path:dir+'/profile-'+width+'.png',fullPage:true});
  if(width===1440){
   await page.goto(base+'candidate/jobs/',{waitUntil:'domcontentloaded'});
   const search=page.getByRole('textbox',{name:'自然语言搜索岗位'});
   await search.waitFor({timeout:20000});
   for(const term of ['新','奥','新奥集团','ENN Group']){
    await search.fill(term);
    const card=page.locator('.domestic-company-card').filter({hasText:'新奥集团'}).first();
    await card.waitFor({timeout:18000});
    assert((await card.getAttribute('href'))?.endsWith('/companies/autumn/cn-autumn-018'));
   }
   await page.screenshot({path:dir+'/search.png',fullPage:true});
   await page.goto(base,{waitUntil:'domcontentloaded'});
   const mark=page.locator('.home-company-marquee-item:not(.is-copy) img[alt*="新奥集团"]').first();
   await mark.waitFor({timeout:18000});
   await mark.evaluate(async el=>{if(!el.complete)await new Promise(r=>{el.onload=r;el.onerror=r});if(!el.naturalWidth)throw Error('Home ENN logo failed')});
   assert((await mark.getAttribute('src'))?.includes('cn-autumn-018/logo.png'));
   await page.screenshot({path:dir+'/home.png',fullPage:true});
   await page.goto(base+'candidate/jobs/cn-v2-profile-cn-autumn-018-computing-software',{waitUntil:'domcontentloaded'});
   await page.getByText('计算机与软件类',{exact:false}).first().waitFor({timeout:18000});
  }
  assert.deepEqual(errors,[],'JavaScript runtime errors');
  await page.close();
 }
 writeFileSync(dir+'/result.json',JSON.stringify({id:'cn-autumn-018',images:3,professionalDirections:15,search:['新','奥','新奥集团','ENN Group'],homeLogo:true,majorFilter:true,mobile:true,result:'PASS'},null,2));
 console.log('HHBA_ENN_FACTORY_22_3_IMAGES_15_DIRECTIONS_SEARCH_HOME_MOBILE_PASS');
}finally{await browser.close()}
