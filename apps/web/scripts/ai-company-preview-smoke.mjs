// HHBA Phase 1.4: enterprise-first homepage, no domestic historical job cards.
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
 assert(ready,'Vite preview must respond');
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',e=>errors.push('script: '+e.message));
 page.on('requestfailed',req=>{
  if(/\.(?:js|css)(?:\?|$)/i.test(req.url()))errors.push('asset: '+req.url());
 });
 await page.goto(ROOT,{waitUntil:'domcontentloaded'});
 await page.locator('.ai-company-single-search input').waitFor({timeout:12000});
 assert.equal(await page.locator('.ai-company-single-search input').count(),1);
 assert.equal(await page.locator('.unified-job-search input').count(),0);
 assert.equal(await page.locator('.unified-market,.unified-job-card,.home-match-promo,.ai-company-demo-banner,.hhba-search-mode').count(),0,
   'Home must not render historical job cards, duplicate search controls or AI panels');
 const cards=page.locator('.hhba-featured-card');
 assert.equal(await cards.count(),3,'Only three featured employers');
 for(const name of ['OpenAI','Anthropic','SpaceX']){
  await cards.filter({hasText:name}).first().waitFor();
  const card=cards.filter({hasText:name}).first();
  assert.equal(await card.locator('img').count(),1,'Approved brand asset should exist');
  const logoStatus=await card.locator('img').evaluate(el=>el instanceof HTMLImageElement&&el.complete&&el.naturalWidth>0);
  assert(logoStatus,'Logo must load');
  assert.equal(await card.getByRole('link',{name:/官方招聘/}).count(),1);
  await page.locator('.home-company-marquee-link').filter({hasText:name}).first().waitFor();
 }
 assert.equal(await page.locator('.home-company-marquee-run:not(.is-copy) .home-company-marquee-item').count(),3,
  'Bottom logo strip is still present and limited to the original three');
 assert.equal(await page.getByText('小米集团',{exact:true}).count(),0,'Historical domestic employers not on home');
 await page.getByRole('search').locator('input').fill('汽车');
 await page.getByRole('button',{name:'搜索企业'}).click();
 const results=page.getByTestId('company-results');
 await results.waitFor();
 assert.match(await results.innerText(),/长城汽车/);
 assert.match(await results.innerText(),/非 AI 推荐/);
 assert.equal(await page.locator('.unified-job-card').count(),0);
 await mkdir('preview-screenshots',{recursive:true});
 await page.screenshot({path:'preview-screenshots/desktop.png',fullPage:true});
 await page.getByRole('search').locator('input').fill('小米');
 await page.getByRole('button',{name:'搜索企业'}).click();
 assert.match(await results.innerText(),/小米/);
 assert.match(await results.innerText(),/官方招聘/);
 assert.equal(await page.locator('.unified-job-card').count(),0);
 await page.getByRole('search').locator('input').fill('OpenAI');
 await page.getByRole('button',{name:'搜索企业'}).click();
 await results.getByRole('link',{name:/企业介绍/}).first().click();
 assert.match(page.url(),/\/companies\/openai$/);
 await page.getByText('OpenAI',{exact:true}).first().waitFor();
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
 mobile.on('pageerror',e=>errors.push('mobile: '+e.message));
 await mobile.goto(ROOT,{waitUntil:'domcontentloaded'});
 await mobile.locator('.hhba-featured-card').first().waitFor();
 assert.equal(await mobile.locator('.hhba-featured-card').count(),3);
 await mobile.locator('.ai-company-single-search input').fill('比亚迪');
 await mobile.getByRole('button',{name:'搜索企业'}).click();
 assert.match(await mobile.getByTestId('company-results').innerText(),/比亚迪/);
 assert.equal(await mobile.locator('.unified-job-card').count(),0);
 await mobile.screenshot({path:'preview-screenshots/mobile.png',fullPage:true});
 assert.deepEqual(errors,[],'no browser script or asset errors');
 console.log('HHBA_ENTERPRISE_FIRST_THREE_FEATURED_NO_DOMESTIC_ARCHIVE_PASS');
} finally{await browser?.close();server.kill('SIGTERM');}
