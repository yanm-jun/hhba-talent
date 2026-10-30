import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/preview-shkp/').replace(/\/?$/,'/');
const out='single-han-search-evidence';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},locale:'zh-CN'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Original shared recruitment search must now show both reviewed enterprise
 // cards and the SHKP source-backed job cards for just a single character.
 await page.goto(base+'candidate/jobs',{waitUntil:'domcontentloaded',timeout:45000});
 const jobInput=page.getByRole('textbox',{name:'自然语言搜索岗位'});
 await jobInput.waitFor({timeout:20000});
 await jobInput.fill('新');
 const companyCard=page.locator('.domestic-company-card').filter({hasText:'新鸿基地产'}).first();
 await companyCard.waitFor({timeout:25000});
 assert((await companyCard.getAttribute('href'))?.endsWith('/companies/autumn/cn-autumn-010'),'Correct SHKP employer detail route');
 const jobCards=page.locator('.unified-job-card').filter({hasText:'新鸿基地产'});
 await jobCards.first().waitFor({timeout:20000});
 assert(await jobCards.count()>0,'SHKP role should exist in shared search');
 await page.screenshot({path:out+'/job-market-1-han.png',fullPage:true});
 await jobInput.fill('新鸿');
 await companyCard.waitFor({timeout:20000});
 await jobInput.fill('鸿基');
 await companyCard.waitFor({timeout:20000});
 await jobInput.fill('SHKP');
 await companyCard.waitFor({timeout:20000});
 await jobInput.fill('Sun Hung Kai');
 await companyCard.waitFor({timeout:20000});
 // The standalone company discovery page is the same enterprise index.
 await page.goto(base+'companies/discover',{waitUntil:'domcontentloaded',timeout:45000});
 const discover=page.getByRole('textbox',{name:'搜索200家企业'});
 await discover.waitFor({timeout:20000});
 await discover.fill('新');
 const found=page.locator('.domestic-company-card').filter({hasText:'新鸿基地产'}).first();
 await found.waitFor({timeout:25000});
 assert((await found.getAttribute('href'))?.endsWith('/companies/autumn/cn-autumn-010'));
 await page.screenshot({path:out+'/company-discover-1-han.png',fullPage:true});
 await found.click();
 await page.locator('[data-employer-id="cn-autumn-010"]').waitFor({timeout:20000});
 assert.equal(await page.locator('.hhba-kpmg-role').count(),8);
 // Other single-character prefix must be searched by the same rules.
 await page.goto(base+'companies/discover',{waitUntil:'domcontentloaded'});
 await page.getByRole('textbox',{name:'搜索200家企业'}).fill('安');
 await page.locator('.domestic-company-card').filter({hasText:'安克创新'}).first().waitFor({timeout:25000});
 assert.deepEqual(errors,[],'No unhandled browser errors');
 writeFileSync(out+'/result.json',JSON.stringify({singleHan:'新',shkpJob:true,shkpEnterprise:true,partialNames:['新鸿','鸿基','SHKP','Sun Hung Kai'],otherSingleHan:'安',status:'PASS'},null,2));
 console.log('HHBA_SINGLE_HAN_BROWSER_SEARCH_SHKP_LINKED_JOB_AND_COMPANY_PASS');
}finally{await browser.close()}
