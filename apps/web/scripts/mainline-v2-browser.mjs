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
const result={base,desktop:false,mobile:false,southern:false,guangzhilv:false,shortSearch:false,details:false,images:false};
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
  await input.waitFor({timeout:20000});
  const checks=[
    ['南方传媒','cn-autumn-026',6],
    ['南方','cn-autumn-026',6],
    ['广之','cn-autumn-027',8],
    ['广之旅','cn-autumn-027',8],
    ['GZL','cn-autumn-027',8],
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
   if(query==='广之旅'||query==='南方传媒'){
    await page.screenshot({path:out+'/'+id+'-'+width+'-search.png',fullPage:true});
    await link.click();
    const detail=page.locator('[data-company-template="unified-v2"][data-employer-id="'+id+'"]');
    await detail.waitFor({state:'visible',timeout:25000});
    assert((await detail.locator('h1').innerText()).includes(id==='cn-autumn-026'?'南方传媒':'广之旅'));
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
  assert.deepEqual(pageErrors,[],'Uncaught browser JavaScript errors');
  if(width===390)result.mobile=true;else result.desktop=true;
  await page.close();
 }
 assert(result.desktop&&result.mobile&&result.southern&&result.guangzhilv&&result.shortSearch&&result.details&&result.images);
 result.status='PASS';
 writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n');
 console.log('HHBA_ONE_MAIN_BROWSER_SEARCH_AND_DETAILS_PASS',JSON.stringify(result));
}finally{await browser.close()}
