#!/usr/bin/env node
// Real Chromium smoke check against the EXACT compiled single-main HHBA site.
// No mock data and no separate enterprise preview subdomains.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const out='mainline-v2-browser-proof';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const result={base,desktop:false,mobile:false,southern:false,guangzhilv:false,shortSearch:false,details:false,images:false,qingdaoCaptions:false,mechanicalRoleFilter:false,roadBridgeMajor:false};
async function dismiss(page){
 const btn=page.getByRole('button',{name:'暂不同意'});
 if(await btn.isVisible().catch(()=>false))await btn.click();
}
async function loaded(img){
 await img.evaluate(async element=>{
  if(!element.complete)await new Promise(resolve=>{element.addEventListener('load',resolve,{once:true});element.addEventListener('error',resolve,{once:true})});
  if(!element.naturalWidth||!element.naturalHeight)throw Error('Broken image: '+element.src);
 });
}
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(base+'candidate/jobs/',{waitUntil:'domcontentloaded',timeout:60000});
  await dismiss(page);
  const input=page.getByRole('textbox',{name:'自然语言搜索岗位'});
  try{
   await input.waitFor({timeout:9000});
  }catch(err){
   const debug={
    url:page.url(),title:await page.title(),errors:pageErrors,
    bodyText:(await page.locator('body').innerText().catch(()=>'' )).slice(0,2500),
    inputCount:await page.locator('input').count(),
    htmlHead:(await page.locator('body').innerHTML().catch(()=>'' )).slice(0,1800)
   };
   console.error('HHBA_V2_MAIN_BROWSER_DEBUG',JSON.stringify(debug));
   await page.screenshot({path:out+'/DEBUG-main-'+width+'.png',fullPage:true});
   throw err;
  }
  // One market search: query a profession, not an employer name.
  // The Envision company has six sourced directions, but only a subset
  // has explicit mechanical-major evidence.
  await input.fill('机械');
  const mechanicalCard=page.locator('[data-v2-search-company="cn-autumn-012"]');
  await mechanicalCard.waitFor({state:'visible',timeout:20000});
  assert.equal(await mechanicalCard.getAttribute('data-v2-match-kind'),'major');
  const mechanicalJobs=mechanicalCard.locator('.hhba-v2-job-result');
  const mechanicalCount=await mechanicalJobs.count();
  assert(mechanicalCount>0&&mechanicalCount<6,'Mechanical search must show subset of Envision six roles');
  const mechanicalTitles=await mechanicalJobs.locator('b').allTextContents();
  assert(!mechanicalTitles.some(t=>/IT开发/i.test(t)),
   'Unrelated IT role must never show under mechanical-major search');
  for(const employerCard of await page.locator('[data-v2-search-company]').all()){
   assert((await employerCard.locator('.hhba-v2-job-result').count())>0,'No empty employer should be displayed');
   assert.equal(await employerCard.getAttribute('data-v2-match-kind'),'major');
  }
  await page.screenshot({path:out+'/mechanical-'+width+'-only-related-jobs.png',fullPage:true});
  await input.fill('远景科技集团');
  await mechanicalCard.waitFor({state:'visible',timeout:20000});
  assert.equal(await mechanicalCard.locator('.hhba-v2-job-result').count(),6,
   'Full employer-name search must still display all six reviewed directions');
  // The next reviewed enterprise must join the SAME search and only expose
  // its mechanical equipment job when the profession '机械' is queried.
  await input.fill('机械');
  const roadCard=page.locator('[data-v2-search-company="cn-autumn-028"]');
  await roadCard.waitFor({state:'visible',timeout:20000});
  assert.equal(await roadCard.getAttribute('data-v2-match-kind'),'major');
  assert.equal(await roadCard.locator('.hhba-v2-job-result').count(),1,
    'Zhongjian Road & Bridge must show exactly its mechanical-equipment role');
  assert((await roadCard.locator('.hhba-v2-job-result').innerText()).includes('机械责任师'));
  await page.screenshot({path:out+'/cn-autumn-028-mechanical-'+width+'.png',fullPage:true});
  result.roadBridgeMajor=true;
  result.mechanicalRoleFilter=true;
  const checks=[
    ['南方传媒','cn-autumn-026',6],
    ['南方','cn-autumn-026',6],
    ['广之','cn-autumn-027',8],
    ['广之旅','cn-autumn-027',8],
    ['GZL','cn-autumn-027',8],
    ['中建路桥','cn-autumn-028',12],
    ['中建路','cn-autumn-028',12],
  ];
  for(const [query,id,count] of checks){
   await input.fill(query);
   const card=page.locator('[data-v2-search-company="'+id+'"]');
   await card.waitFor({state:'visible',timeout:20000});
   assert.equal(await card.locator('.hhba-v2-job-result').count(),count,'Missing sourced role directions '+id+' after '+query);
   const link=card.getByRole('link',{name:/查看企业详情/}).first();
   const href=await link.getAttribute('href');
   assert(href.includes('/hhba-talent/companies/autumn/'+id+'/'),'Not using ONE canonical HHBA company route: '+href);
   await loaded(card.locator('.hhba-v2-employer-logo img'));
   if(query==='南方传媒')result.southern=true;
   if(query==='广之')result.shortSearch=true;
   if(query==='广之旅')result.guangzhilv=true;
   if(query==='广之旅'||query==='南方传媒'||query==='中建路桥'){
    await page.screenshot({path:out+'/'+id+'-'+width+'-search.png',fullPage:true});
    await link.click();
    const detail=page.locator('[data-company-template="unified-v2"][data-employer-id="'+id+'"]');
    await detail.waitFor({state:'visible',timeout:25000});
    assert((await detail.locator('h1').innerText()).includes(id==='cn-autumn-026'?'南方传媒':id==='cn-autumn-028'?'中建路桥':'广之旅'));
    assert.equal(await detail.locator('.hhba-v2-company-role').count(),count);
    await loaded(detail.locator('.hhba-kpmg-logo img'));
    const pics=detail.locator('.hhba-kpmg-photo-grid img');
    assert.equal(await pics.count(),2);
    for(const image of await pics.all())await loaded(image);
    assert.equal(await detail.locator('.hhba-kpmg-photo-grid a').count(),0,'Company photos must not navigate offsite');
    result.images=true;result.details=true;
    await page.screenshot({path:out+'/'+id+'-'+width+'-detail.png',fullPage:true});
    await page.goto(base+'candidate/jobs/',{waitUntil:'domcontentloaded'});
    await input.waitFor({state:'visible'});
   }
  }
  // Qingdao Bank regression: the previously horizontal flex caption squeezed
  // a Chinese title into vertical characters and forced its source note off-card.
  await page.goto(base+'companies/autumn/cn-autumn-025/',{waitUntil:'domcontentloaded',timeout:45000});
  const qingdao=page.locator('[data-company-template="unified-v2"][data-employer-id="cn-autumn-025"]');
  await qingdao.waitFor({state:'visible',timeout:25000});
  assert((await qingdao.locator('h1').innerText()).includes('青岛银行'),'Wrong Qingdao bank profile');
  const captions=qingdao.locator('.hhba-kpmg-photo-grid figcaption');
  assert.equal(await captions.count(),2,'Qingdao Bank must keep two independent photos with captions');
  for(const caption of await captions.all()){
   const layout=await caption.evaluate(el=>{
    const title=el.querySelector('span');
    const note=el.querySelector('small');
    const cs=getComputedStyle(el), ts=title&&getComputedStyle(title), ns=note&&getComputedStyle(note);
    return {
     direction:cs.flexDirection,alignment:cs.alignItems,writing:cs.writingMode,
     cardWidth:el.clientWidth,titleWidth:title?.getBoundingClientRect().width||0,
     noteWrap:ns?.whiteSpace,captionOverflow:el.scrollWidth>el.clientWidth+2,
     titleOverflow:!!title&&title.scrollWidth>title.clientWidth+2,
     noteOverflow:!!note&&note.scrollWidth>note.clientWidth+2,
     titleWriting:ts?.writingMode,noteWriting:ns?.writingMode
    };
   });
   assert.equal(layout.direction,'column','Qingdao photo title and source must stack vertically');
   assert.equal(layout.writing,'horizontal-tb','Captions must use horizontal text');
   assert.equal(layout.titleWriting,'horizontal-tb','Title must not render as a vertical line');
   assert.equal(layout.noteWriting,'horizontal-tb','Source note must be horizontally written');
   assert.equal(layout.noteWrap,'normal','Long source notes must wrap naturally');
   assert(layout.titleWidth>layout.cardWidth*0.75,'Photo title was squeezed into a one-character column');
   assert(!layout.captionOverflow&&!layout.titleOverflow&&!layout.noteOverflow,
    'Qingdao source note overflows photo card: '+JSON.stringify(layout));
  }
  await page.screenshot({path:out+'/qingdao-bank-'+width+'-captions.png',fullPage:true});
  result.qingdaoCaptions=true;
  assert.deepEqual(pageErrors,[],'Uncaught browser JavaScript errors');
  if(width===390)result.mobile=true;else result.desktop=true;
  await page.close();
 }
 assert(result.desktop&&result.mobile&&result.southern&&result.guangzhilv&&result.shortSearch&&result.details&&result.images&&result.qingdaoCaptions&&result.mechanicalRoleFilter&&result.roadBridgeMajor);
 result.status='PASS';
 writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');
 console.log('HHBA_ONE_MAIN_BROWSER_SEARCH_AND_DETAILS_PASS',JSON.stringify(result));
}finally{await browser.close()}
