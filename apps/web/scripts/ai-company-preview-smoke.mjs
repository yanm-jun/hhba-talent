// HHBA Phase 1.3: one-search homepage and preservation of curated employers.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const ROOT='http://127.0.0.1:4179/hhba-talent/ai-company-preview/';
const server=spawn(process.execPath,['./node_modules/vite/bin/vite.js','preview',
 '--host','127.0.0.1','--port','4179','--strictPort'],{
 stdio:'pipe',env:{...process.env,HHBA_GITHUB_PAGES:'1',
 HHBA_PAGES_BASE:'/hhba-talent/ai-company-preview/'}
});
let browser;
const errors=[];
try{
 let ready=false;
 for(let i=0;i<60;i++){
  if(server.exitCode!==null)throw Error('Vite preview exited');
  try{ready=(await fetch(ROOT)).ok;if(ready)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,350));
 }
 assert(ready,'Vite preview should respond');
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',e=>errors.push('script: '+e.message));
 page.on('requestfailed',req=>{
  if(/\.(?:js|css)(?:\?|$)/i.test(req.url()))errors.push('asset: '+req.url());
 });
 await page.goto(ROOT,{waitUntil:'domcontentloaded'});
 await page.locator('.ai-company-single-search input').waitFor({timeout:12000});
 assert.equal(await page.locator('.ai-company-single-search input').count(),1,'one main enterprise search');
 assert.equal(await page.locator('.unified-job-search input').count(),0,'no duplicate job input on homepage');
 assert.equal(await page.locator('.ai-company-demo-banner,.hhba-search-mode,.ai-company-browse').count(),0,'no old AI panel or mode switch');
 for(const company of ['OpenAI','Anthropic','SpaceX']){
  await page.locator('.ai-company-quick-links a').filter({hasText:company}).first().waitFor();
  await page.locator('.home-company-marquee-link').filter({hasText:company}).first().waitFor();
 }
 await page.locator('.unified-market').waitFor();
 await page.locator('.unified-job-card').first().waitFor({timeout:12000});
 await page.getByRole('search').locator('input').fill('有汽车行业工作经验，想了解汽车企业');
 await page.getByRole('button',{name:'搜索企业'}).click();
 const results=page.getByTestId('company-results');
 await results.waitFor();
 assert.match(await results.innerText(),/长城汽车/);
 assert.match(await results.innerText(),/非 AI 推荐/);
 await mkdir('preview-screenshots',{recursive:true});
 await page.screenshot({path:'preview-screenshots/desktop.png',fullPage:true});
 await page.getByRole('search').locator('input').fill('OpenAI');
 await page.getByRole('button',{name:'搜索企业'}).click();
 await results.getByRole('link',{name:/企业介绍/}).first().click();
 assert.match(page.url(),/\/companies\/openai$/);
 await page.getByText('OpenAI',{exact:true}).first().waitFor();
 await page.goto(ROOT);
 await page.getByRole('link',{name:/查看完整招聘市场/}).first().click();
 assert.match(page.url(),/\/candidate\/jobs$/);
 await page.locator('.unified-job-search input').waitFor({timeout:12000});
 assert.equal(await page.locator('.ai-company-single-search').count(),0,'job-market route remains legacy');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
 mobile.on('pageerror',e=>errors.push('mobile: '+e.message));
 await mobile.goto(ROOT,{waitUntil:'domcontentloaded'});
 await mobile.locator('.ai-company-single-search input').fill('比亚迪');
 await mobile.getByRole('button',{name:'搜索企业'}).click();
 assert.match(await mobile.getByTestId('company-results').innerText(),/比亚迪/);
 await mobile.screenshot({path:'preview-screenshots/mobile.png',fullPage:true});
 assert.deepEqual(errors,[],'no client script or asset errors');
 console.log('HHBA_ONE_SEARCH_AND_FEATURED_BRANDS_BROWSER_PASS');
}finally{
 await browser?.close();
 server.kill('SIGTERM');
}
