import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const base=process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/';
const blocked=[];mkdirSync('curated-review',{recursive:true});
function observe(page){
 page.on('request',request=>{
   const url=new URL(request.url());
   if(/(?:ashbyhq\.com|greenhouse\.io|lever\.co|railway\.app)$/.test(url.hostname))
     blocked.push(request.url());
 });
}
try{
 const page=await browser.newPage({viewport:{width:1440,height:920}});
 observe(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(base,{waitUntil:'domcontentloaded'});
 if(response?.status()!==200)throw Error('HOMEPAGE_HTTP_FAILURE');
 await page.locator('.unified-job-card').first().waitFor({timeout:20000});
 const homeText=await page.locator('body').innerText();
 if(!homeText.includes('让机会与人才，找到彼此。')||
    !homeText.includes('企业发现 · 200 家国内企业')||
    await page.locator('.unified-job-card').count()!==6)
   throw Error('ORIGINAL_HOME_STRUCTURE_CHANGED');
 await page.screenshot({path:'curated-review/original-home-desktop.png',fullPage:true});
 await page.getByRole('button',{name:/我要应聘/}).click();
 await page.locator('.unified-job-card').first().waitFor();
 await page.getByRole('textbox',{name:'自然语言搜索岗位'}).fill('OpenAI');
 await page.waitForFunction(()=>document.querySelectorAll('.unified-job-card').length===10,{timeout:15000});
 const count=await page.locator('.unified-job-card').count();
 if(count!==10)throw Error('SEARCH_EXPECTED_10 '+count);
 await page.screenshot({path:'curated-review/original-market-openai-10.png',fullPage:true});
 await page.locator('.unified-job-card h3 a').first().click();
 await page.locator('.unified-detail-card h1').waitFor({timeout:15000});
 const detail=await page.locator('.unified-detail-card').innerText();
 if(!detail.includes('工作职责')||!detail.includes('任职要求')||
    !detail.includes('历史')||!detail.includes('第三方系统架构师'))
   throw Error('OFFLINE_EDITED_DETAIL_MISSING');
 await page.screenshot({path:'curated-review/original-detail-verified.png',fullPage:true});
 await page.getByRole('button',{name:'English'}).click();
 if(!await page.locator('.unified-detail-card').innerText().then(x=>x.includes('Verified English overview')))
   throw Error('ENGLISH_TOGGLE_BROKEN');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 observe(mobile);
 await mobile.goto(base,{waitUntil:'domcontentloaded'});
 await mobile.locator('.unified-job-card').first().waitFor({timeout:15000});
 const sizes=await mobile.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
 if(sizes.page>sizes.viewport+2)throw Error('MOBILE_OVERFLOW '+JSON.stringify(sizes));
 await mobile.screenshot({path:'curated-review/original-home-mobile.png',fullPage:true});
 if(blocked.length)throw Error('OVERSEAS_JOB_NETWORK_DEPENDENCY '+blocked.slice(0,4).join(','));
 if(errors.length)throw Error('BROWSER_ERRORS '+errors.join('; '));
 console.log('HHBA_CURATED_100_ORIGINAL_HOME_BROWSER_OK',JSON.stringify({companies:10,jobs:100,
   homeOriginal:true,homeCards:6,openaiSearch:count,detailChinese:true,englishToggle:true,
   mobile:sizes,overseasJobRequests:0}));
}finally{await browser.close();}
