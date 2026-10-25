import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/preview-employer/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900},locale:'zh-CN'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
mkdirSync('scoring-review',{recursive:true});
try{
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:35000});
 await page.getByRole('button',{name:/我要招人/}).click();
 await page.getByRole('link',{name:/进入企业工作台/}).click();
 await page.getByRole('link',{name:'信誉与善待'}).click();
 await page.getByRole('link',{name:/查看双评分规则/}).click();
 await page.getByRole('heading',{name:/企业双评分/}).waitFor();
 await page.getByRole('heading',{name:'企业信誉值'}).waitFor();
 await page.getByRole('heading',{name:'员工善待值'}).waitFor();
 await page.getByText('正式评分尚未公开').waitFor();
 await page.getByText('30%',{exact:true}).waitFor();
 await page.screenshot({path:'scoring-review/public-scoring-rules.png',fullPage:true});
 const pageText=await page.locator('.es-page').innerText();
 if(/\b88\b|\b92\b/.test(pageText))throw Error('FABRICATED_SCORE');
 await page.goto(base+'/employer/scoring/',{waitUntil:'domcontentloaded',timeout:35000});
 await page.getByText('正式评分尚未公开').waitFor();
 await page.goto(base+'/admin/employer-scoring/',{waitUntil:'domcontentloaded',timeout:35000});
 await page.getByRole('heading',{name:'评分候选值与复核'}).waitFor();
 await page.getByText('独立评分服务尚未开放').waitFor();
 if(await page.getByRole('button',{name:'待独立评分服务接入'}).isEnabled())
   throw Error('UNTRUSTED_REVIEW_ENABLED');
 if(await page.getByRole('button',{name:'未开放真实计算'}).isEnabled())
   throw Error('UNTRUSTED_SCORE_CALCULATION_ENABLED');
 await page.screenshot({path:'scoring-review/admin-scoring-disabled.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/employer/scoring/',{waitUntil:'domcontentloaded',timeout:35000});
 await page.getByRole('heading',{name:/企业双评分/}).waitFor();
 const overflowing=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+3);
 if(overflowing)throw Error('MOBILE_HORIZONTAL_OVERFLOW');
 await page.screenshot({path:'scoring-review/mobile-scoring-rules.png',fullPage:true});
 if(errors.length)throw Error('BROWSER_ERRORS '+JSON.stringify(errors));
 console.log('HHBA_SCORING_BROWSER_OK',JSON.stringify({twoIndependentScores:true,noFakeNumbers:true,adminClosed:true,deepLinks:true,mobile:true}));
}finally{await browser.close()}
