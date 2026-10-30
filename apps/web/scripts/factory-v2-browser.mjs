#!/usr/bin/env node
/**
 * One browser acceptance program for every company in the enterprise factory.
 * HHBA_EMPLOYER_ID=cn-autumn-018 HHBA_TEST_BASE=http://127.0.0.1:4173/hhba-talent/preview-factory-v2/
 * node scripts/factory-v2-browser.mjs
 */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const id=process.env.HHBA_EMPLOYER_ID||'cn-autumn-018';
assert(/^cn-autumn-\d{3}$/.test(id),'Unsafe employer ID');
const p=JSON.parse(readFileSync('src/data/employerProfiles/'+id+'.json','utf8'));
assert.equal(p.id,id);
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/preview-factory-v2/').replace(/\/?$/,'/');
const out='factory-v2-browser-proof';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const result={id,company:p.name,desktop:false,mobile:false,images:false,major:false,search:false,homeLogo:false,roleDetail:false,captionLayout:false};
try {
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(base+'companies/autumn/'+id+'/',{waitUntil:'domcontentloaded',timeout:45000});
  const root=page.locator('[data-company-template="factory-v1"][data-employer-id="'+id+'"]');
  await root.waitFor({timeout:30000});
  const consent=page.getByRole('button',{name:'暂不同意'});
  if(await consent.isVisible().catch(()=>false))await consent.click();
  assert((await root.locator('h1').innerText()).includes(p.name),'Wrong company profile');
  const photos=root.locator('.hhba-kpmg-photo-grid figure');
  assert.equal(await photos.count(),2,'Must display two separate company pictures');
  const imgs=root.locator('.hhba-kpmg-logo img,.hhba-kpmg-photo-grid img');
  assert.equal(await imgs.count(),3,'Must show exactly one logo and two photos');
  for(const img of await imgs.all()){
   await img.evaluate(async el=>{
    if(!el.complete)await new Promise(resolve=>{el.onload=resolve;el.onerror=resolve});
    if(!el.naturalWidth||!el.naturalHeight)throw Error('Broken company media: '+el.src);
   });
  }
  assert.equal(await root.locator('.hhba-kpmg-photo-grid a').count(),0,'Company photos cannot navigate to source websites');
  for(const caption of await root.locator('.hhba-kpmg-photo-grid figure figcaption').all()){
   const box=await caption.evaluate(el=>{
    const style=getComputedStyle(el),title=el.querySelector('span'),note=el.querySelector('small');
    const titleWidth=title?.getBoundingClientRect().width||0;
    return {width:el.getBoundingClientRect().width,titleWidth,
      vertical:style.writingMode!=='horizontal-tb',direction:style.flexDirection,
      noteWrap:note?getComputedStyle(note).whiteSpace:'',
      overflow:el.scrollWidth>el.clientWidth+2||(note?.scrollWidth||0)>(note?.clientWidth||0)+2};
   });
   assert(box.width>220&&box.titleWidth>box.width*.65,'Photo title is squeezed vertically');
   assert(!box.vertical&&box.direction==='column'&&box.noteWrap==='normal'&&!box.overflow,'Photo source caption is not wrapped');
  }
  result.images=true;result.captionLayout=true;
  const roles=root.locator('.hhba-major-linked-jobs .hhba-kpmg-role');
  const all=root.locator('.hhba-major-quick-list button').filter({hasText:'全部专业'}).first();
  await all.click();
  assert.equal(await roles.count(),p.jobs.length,'Published roles must be driven by one company JSON');
  const selected=p.preferredMajors.find(major=>p.jobs.some(j=>j.majorNames.includes(major)))||null;
  if(selected){
   const button=root.locator('.hhba-major-quick-list button').filter({hasText:selected}).first();
   await button.click();
   assert((await roles.count())>=1,'Major filter has no related role: '+selected);
   await all.click();
   assert.equal(await roles.count(),p.jobs.length,'Reset major filter must restore jobs');
  }
  result.major=true;
  assert((await root.locator('.hhba-kmpg-service,.hhba-kpmg-service').count())>=4,'Missing business cards');
  assert.deepEqual(pageErrors,[],'Company page JavaScript errors');
  await page.screenshot({path:out+'/'+id+'-'+width+'.png',fullPage:true});
  if(width===1440){
   await page.goto(base+'candidate/jobs/',{waitUntil:'domcontentloaded',timeout:45000});
   const search=page.getByRole('textbox',{name:'自然语言搜索岗位'});
   await search.waitFor({timeout:20000});
   const tests=[p.name,p.name.charAt(0),p.englishName].filter(Boolean);
   for(const keyword of tests){
    await search.fill(keyword);
    const company=page.locator('.domestic-company-card').filter({hasText:p.name}).first();
    await company.waitFor({timeout:20000});
    assert((await company.getAttribute('href'))?.endsWith('/companies/autumn/'+id),'Enterprise search route mismatch: '+keyword);
   }
   result.search=true;
   await page.goto(base,{waitUntil:'domcontentloaded'});
   const logo=page.locator('.home-company-marquee-item img[alt*="'+p.name+'"]').first();
   await logo.waitFor({timeout:20000});
   await logo.evaluate(async el=>{
    if(!el.complete)await new Promise(resolve=>{el.onload=resolve;el.onerror=resolve});
    if(!el.naturalWidth)throw Error('Home company logo could not load');
   });
   assert((await logo.getAttribute('src'))?.includes(id+'/logo.'),'Homepage logo not from target company directory');
   result.homeLogo=true;
   if(p.jobs.length){
    const first=p.jobs[0];
    await page.goto(base+'candidate/jobs/cn-v2-profile-'+id+'-'+first.id,{waitUntil:'domcontentloaded'});
    await page.getByText(first.title,{exact:false}).first().waitFor({timeout:20000});
    result.roleDetail=true;
   }
   await page.screenshot({path:out+'/'+id+'-home.png',fullPage:true});
   result.desktop=true;
  }else result.mobile=true;
  await page.close();
 }
 result.status='PASS';
 writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');
 console.log('HHBA_FACTORY_V2_BROWSER_PASS '+JSON.stringify(result));
}finally{await browser.close()}
