// HHBA official-jobs-first home acceptance. Every job card must match a fresh ATS record.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile,mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const ROOT='http://127.0.0.1:4179/hhba-talent/ai-company-preview/';
const source=JSON.parse(await readFile('dist/data/featured-live.json','utf8'));
assert.equal(source.kind,'HHBA_3_EMPLOYER_OFFICIAL_BOARD_V1');
assert(source.jobs.length<=6);
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
  if(server.exitCode!==null)throw Error('Vite preview server exited');
  try{ready=(await fetch(ROOT)).ok;if(ready)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,350));
 }
 assert(ready);
 browser=await chromium.launch({headless:true});
 const desktop=await browser.newPage({viewport:{width:1280,height:900}});
 desktop.on('pageerror',e=>errors.push('desktop '+e.message));
 await desktop.goto(ROOT,{waitUntil:'domcontentloaded'});
 await desktop.getByRole('heading',{name:'招聘市场'}).waitFor({timeout:15000});
 try {await desktop.locator('.unified-job-search input').waitFor({timeout:11000});}
 catch(error){
  console.error('URL',desktop.url());
  console.error('SCRIPT_ERRORS',JSON.stringify(errors));
  console.error('BODY', (await desktop.locator('body').innerText()).slice(0,4500));
  console.error('HTML', (await desktop.content()).slice(0,1100));
  throw error;
 }
 assert.equal(await desktop.locator('.unified-job-search input').count(),1);
 assert.equal(await desktop.locator('.ai-company-single-search,.hhba-featured-card,.ai-company-demo-banner').count(),0);
 await desktop.locator('.unified-job-controls select').first().waitFor();
 for(const company of ['OpenAI','Anthropic','SpaceX']){
  await desktop.locator('.home-company-marquee-run:not(.is-copy) .home-company-marquee-link').filter({hasText:company}).waitFor();
 }
 const expected=source.jobs.length;
 if(expected>0){
  await desktop.locator('.unified-job-card').first().waitFor({timeout:12000});
  assert.equal(await desktop.locator('.unified-job-card').count(),expected,'Only currently listed public ATS jobs should display');
  const text=await desktop.locator('.unified-job-grid').innerText();
  for(const job of source.jobs){
   assert(text.includes(job.company),'Company source must be printed');
  }
 }else{
  assert.equal(await desktop.locator('.unified-job-card').count(),0);
  await desktop.locator('.unified-job-state').first().waitFor();
 }
 assert.equal(await desktop.getByText('小米集团',{exact:true}).count(),0,'No domestic archive cards on home');
 await mkdir('preview-screenshots',{recursive:true});
 await desktop.screenshot({path:'preview-screenshots/desktop.png',fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 mobile.on('pageerror',e=>errors.push('mobile '+e.message));
 await mobile.goto(ROOT,{waitUntil:'domcontentloaded'});
 await mobile.getByRole('heading',{name:'招聘市场'}).waitFor();
 await mobile.locator('.unified-job-search input').fill('软件');
 await mobile.locator('.unified-job-controls select').first().selectOption('global');
 assert.equal(await mobile.locator('.unified-job-search input').count(),1);
 assert.equal(await mobile.getByText('小米集团',{exact:true}).count(),0);
 await mobile.screenshot({path:'preview-screenshots/mobile.png',fullPage:true});
 await desktop.goto(ROOT);
 await desktop.locator('.unified-job-browse-links').getByRole('link',{name:/查看完整招聘市场/}).click();
 assert.match(desktop.url(),/\/candidate\/jobs$/);
 await desktop.locator('.unified-job-search input').waitFor();
 // Verify real company graph routes through HHBA pages, not directly to an ATS.
 await desktop.locator('.unified-job-search input').fill('华域视觉');
 await desktop.locator('.domestic-company-card').filter({hasText:'华域视觉'}).first().waitFor({timeout:12000});
 await desktop.locator('.domestic-company-card').filter({hasText:'华域视觉'}).first().click();
 await desktop.getByRole('heading',{name:'华域视觉科技（上海）有限公司'}).waitFor();
 assert.match(desktop.url(),/\/companies\/domestic\//);
 await desktop.locator('.domestic-parent-link').filter({hasText:'华域汽车'}).click();
 await desktop.getByRole('heading',{name:'华域汽车',exact:true}).waitFor();
 await desktop.locator('.domestic-related-card').filter({hasText:'华域视觉'}).first().waitFor();
 await desktop.locator('.domestic-parent-link').filter({hasText:'上汽集团'}).click();
 await desktop.getByRole('heading',{name:'上汽集团',exact:true}).waitFor();
 await desktop.locator('.domestic-relations-search input').fill('华域视觉');
 await desktop.locator('.domestic-related-card').filter({hasText:'华域视觉'}).first().waitFor();
 assert.equal(await desktop.locator('.domestic-related-card').count(),1);
 assert.deepEqual(errors,[]);
 console.log('HHBA_REAL_ATS_MARKET_AND_ORIGINAL_LAYOUT_BROWSER_PASS',expected);
}finally{await browser?.close();server.kill('SIGTERM');}
