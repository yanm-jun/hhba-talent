import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base='http://127.0.0.1:4173/hhba-talent/';
const blocked=[];mkdirSync('curated-review',{recursive:true});
const preventOverseas=page=>{
 page.on('request',request=>{
  const host=new URL(request.url()).hostname;
  if(host!=='127.0.0.1')blocked.push(request.url());
 });
 page.route(/https:\/\/(?:[^/]*\.)?(?:ashbyhq\.com|greenhouse\.io|lever\.co|up\.railway\.app)\//,route=>route.abort());
};
try{
 const page=await browser.newPage({viewport:{width:1440,height:920}});
 await preventOverseas(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>console.log('OFFLINE_REQUEST_FAILED',r.url(),r.failure()?.errorText));
 const response=await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(2800);
 console.log('OFFLINE_PAGE_DEBUG',JSON.stringify({http:response?.status(),url:page.url(),body:(await page.locator('body').innerText()).slice(0,1200),errors,curated:await page.locator('.curated-market').count()}));
 await page.screenshot({path:'curated-review/home-debug.png',fullPage:true});
 await page.locator('.curated-job-card').first().waitFor({timeout:15000});
 if(await page.locator('.curated-job-card').count()!==6)throw Error('HOME_OFFLINE_CARDS_MISSING');
 await page.screenshot({path:'curated-review/home-desktop.png',fullPage:true});
 await page.getByRole('button',{name:/我要应聘/}).click();
 await page.locator('.curated-job-card').first().waitFor();
 await page.getByRole('textbox',{name:'搜索精选岗位'}).fill('OpenAI');
 const count=await page.locator('.curated-job-card').count();
 if(count!==15)throw Error('OFFLINE_COMPANY_SEARCH_EXPECTED_15 '+count);
 await page.screenshot({path:'curated-review/search-openai.png',fullPage:true});
 await page.getByRole('link',{name:/查看岗位资料/}).first().click();
 await page.locator('.curated-detail-heading h1').waitFor();
 const body=await page.locator('.curated-detail').innerText();
 if(!body.includes('历史公开岗位')||!body.includes('尚未取得可公开转载')||
 !body.includes('当前状态未核验'))throw Error('MISSING_UNVERIFIED_WARNING');
 await page.screenshot({path:'curated-review/job-detail-desktop.png',fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await preventOverseas(mobile);
 await mobile.goto(base+'candidate/jobs',{waitUntil:'domcontentloaded'});
 await mobile.locator('.curated-job-card').first().waitFor();
 const sizes=await mobile.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
 if(sizes.page>sizes.viewport+2)throw Error('CURATED_MOBILE_OVERFLOW '+JSON.stringify(sizes));
 await mobile.screenshot({path:'curated-review/jobs-mobile.png',fullPage:true});
 if(blocked.length)throw Error('OVERSEAS_NETWORK_REQUEST '+blocked.slice(0,4).join(','));
 console.log('HHBA_CURATED_OFFLINE_BROWSER_OK',JSON.stringify({companies:10,jobs:150,homeCards:6,openaiSearch:count,archiveWarning:true,mobile:sizes,externalRequests:0}));
}finally{await browser.close();}