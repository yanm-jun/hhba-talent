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
 // Searchable, keyboard-accessible academic-major filter is part of the original filter row.
 const majorCombo=desktop.getByRole('combobox',{name:'搜索或选择所学专业'});
 await majorCombo.waitFor();
 await majorCombo.fill('具身');
 await desktop.getByRole('option',{name:/具身智能/}).first().waitFor({timeout:3500});
 await majorCombo.fill('机电一体化');
 await desktop.getByRole('option',{name:/机电一体化技术/}).first().waitFor({timeout:3500});
 await majorCombo.fill('舞蹈学');
 await desktop.getByRole('option',{name:/舞蹈学/}).first().waitFor({timeout:3500});
 await majorCombo.fill('电气');
 await desktop.getByRole('option',{name:'电气工程及其自动化'}).click();
 await desktop.locator('.domestic-major-filter-active').getByText('电气工程及其自动化').waitFor();
 await desktop.locator('.domestic-company-card').filter({hasText:'汇川技术'}).first().waitFor();
 await majorCombo.fill('机械');
 await desktop.getByRole('option',{name:'机械设计制造及其自动化'}).click();
 await desktop.locator('.domestic-major-filter-active').getByText('机械设计制造及其自动化').waitFor();
 await desktop.getByRole('button',{name:'清除所学专业'}).click();
 // Search-to-detail integrity: check every deep-profile employer, not only hand-picked examples.
 const deepProfiles=JSON.parse(await readFile('src/data/domesticCareerProfiles.json','utf8'));
 const searchBox=desktop.locator('.unified-job-search input');
 const results=[];
 for(const name of Object.keys(deepProfiles)){
   await searchBox.fill(name);
   const card=desktop.locator('.domestic-company-card').filter({hasText:name}).first();
   try{await card.waitFor({timeout:5000})}
   catch(e){
    console.error('HHBA_EMPLOYER_CARD_NOT_FOUND',name);
    console.error('SEARCH_VALUE',await searchBox.inputValue());
    console.error('VISIBLE_CARD_TEXT',JSON.stringify((await desktop.locator('.domestic-company-card').allInnerTexts()).slice(0,8)));
    console.error('RESULT_NOTE',(await desktop.locator('.domestic-company-result').allInnerTexts()).join(' ').slice(0,350));
    throw e;
   }
   const href=await card.getAttribute('href');
   assert(href?.includes('/companies/domestic/'),'Company should route through HHBA: '+name);
   assert(!href.startsWith('https://'),'Company card must not bypass HHBA details: '+name);
   results.push({name,href});
 }
 assert.equal(results.length,Object.keys(deepProfiles).length);
 console.log('HHBA_DEEP_EMPLOYER_SEARCH_LINKAGE_PASS',results.length);
 // First verified batch must be directly findable and readable, without faking job openings.
 for(const name of ['比亚迪','中国平安','浦发银行','招商银行','贵州茅台','海天味业','中国建筑','伊利股份']){
  await searchBox.fill(name);
  const card=desktop.locator('.domestic-company-card').filter({hasText:name}).first();
  await card.waitFor({timeout:7000});
  await card.click();
  await desktop.getByRole('heading',{name,exact:true}).waitFor();
  const body=await desktop.locator('.domestic-editorial-body').innerText();
  assert(body.length>=280,'Real long-form description missing for '+name);
  assert((await desktop.locator('.domestic-editorial-business').locator('strong').count())>=3,
    'Real business lines missing for '+name);
  assert((await desktop.locator('.domestic-major-tag').count())>=4,'Business-major mapping missing for '+name);
  await desktop.goto(ROOT);
  await desktop.locator('.unified-job-browse-links').getByRole('link',{name:/查看完整招聘市场/}).click();
 }
 // Newly verified employer-specific recruiting pages, industry and major labels.
 for(const [name,expected] of [
  ['雷赛智能','https://www.leisai.com/recruitment/index.html'],
  ['英威腾','https://www.invt.com.cn/careers'],
  ['兆易创新','https://www.gigadevice.com.cn/about/career'],
  ['埃斯顿','https://estun1.zhiye.com/'],
  ['海康机器人','https://job.hikrobotics.com/']
 ]){
  await searchBox.fill(name);
  await desktop.locator('.domestic-company-card').filter({hasText:name}).first().click();
  await desktop.getByRole('heading',{name,exact:true}).waitFor();
  const actual=await desktop.locator('.domestic-careers .domestic-careers-link').first().getAttribute('href');
  assert.equal(actual,expected,'Wrong exact recruiting employer link: '+name);
  await desktop.locator('.domestic-category-breadcrumb').first().waitFor();
  assert((await desktop.locator('.domestic-major-tag').count())>=4,'Professional association missing: '+name);
  await desktop.goto(ROOT);
  await desktop.locator('.unified-job-browse-links').getByRole('link',{name:/查看完整招聘市场/}).click();
 }
  await searchBox.fill('华安证券');
 await desktop.locator('.domestic-company-card').filter({hasText:'华安证券'}).first().click();
 await desktop.getByRole('heading',{name:'华安证券'}).waitFor();
 await desktop.getByText('安徽省合肥市滨湖新区紫云路1018号').first().waitFor();
 assert((await desktop.locator('.domestic-editorial-body').innerText()).length>300);
 assert.equal(await desktop.locator('.domestic-major-tag').count()>0,true);
 assert.equal(await desktop.locator('.domestic-careers .domestic-careers-link').count(),0,
   'Do not invent recruitment portal for the repaired 华安证券 profile');
 // Nonreviewed entities remain searchable but show truthful directory facts instead of template prose.
 await desktop.goto(ROOT);
 await desktop.locator('.unified-job-browse-links').getByRole('link',{name:/查看完整招聘市场/}).click();
 await desktop.locator('.unified-job-search input').fill('白云机场');
 await desktop.locator('.domestic-company-card').filter({hasText:'白云机场'}).first().click();
 await desktop.getByRole('heading',{name:'白云机场'}).waitFor();
 await desktop.getByRole('heading',{name:'上市主体基本信息'}).waitFor();
 assert.equal(await desktop.getByRole('heading',{name:'企业介绍'}).count(),0);
 assert.equal(await desktop.getByRole('heading',{name:'适合哪些专业背景？'}).count(),0);
 assert.equal(await desktop.getByRole('heading',{name:'官方招聘渠道'}).count(),0);
 assert.equal(await desktop.locator('body').innerText().then(s=>s.includes('已收录至 HHBA 企业资料库')),false);
 assert.equal(await desktop.locator('body').innerText().then(s=>/\bsvg\b/i.test(s)),false);
 await desktop.goto(ROOT);
 await desktop.locator('.unified-job-browse-links').getByRole('link',{name:/查看完整招聘市场/}).click();
 await searchBox.fill('京东方');
 await desktop.locator('.domestic-company-card').filter({hasText:'京东方'}).first().click();
 await desktop.getByRole('heading',{name:'京东方'}).waitFor();
 assert.equal(await desktop.locator('.domestic-official-photo').count(),2,'Official BOE event photos should be present');
 const sourced=await desktop.locator('.domestic-official-photo a').evaluateAll(els=>els.every(el=>
  el.href.startsWith('https://www.boe.com/innovativeTechnologies/creativeSpace')));
 assert(sourced,'All enterprise photos need explicit official source links');
 await desktop.goto(ROOT);
 await desktop.locator('.unified-job-browse-links').getByRole('link',{name:/查看完整招聘市场/}).click();
 await desktop.locator('.unified-job-search input').waitFor();
 // Original company and jobs search still works after major selection/clear.
 // Verified company page and major → companies reverse lookup.
 // Confirm newly indexed company and its professional detail page are navigable.
 await desktop.locator('.unified-job-search input').fill('平高');
 await desktop.locator('.domestic-company-card').filter({hasText:'平高电气'}).first().waitFor();
 await desktop.locator('.domestic-company-card').filter({hasText:'平高电气'}).first().click();
 await desktop.getByRole('heading',{name:'平高电气'}).waitFor();
 assert((await desktop.locator('.domestic-editorial-body').innerText()).length>180);
 assert.equal(await desktop.locator('.domestic-careers .domestic-careers-link').count(),0,
   'No unverified careers portal should be displayed');
 await desktop.goto(ROOT);
 await desktop.locator('.unified-job-browse-links').getByRole('link',{name:/查看完整招聘市场/}).click();
 await desktop.locator('.unified-job-search input').fill('宁德时代');
 await desktop.locator('.domestic-company-card').filter({hasText:'宁德时代'}).first().click();
 await desktop.getByRole('heading',{name:'宁德时代'}).waitFor();
 assert.equal(await desktop.locator('.domestic-careers-link[href="https://talent.catl.com/social-recruitment/catlhr/96144/"]').count(),1);
 await desktop.goto(ROOT);
 await desktop.locator('.unified-job-browse-links').getByRole('link',{name:/查看完整招聘市场/}).click();
 await desktop.locator('.unified-job-search input').fill('华');
 await desktop.locator('.domestic-company-card').filter({hasText:'华域视觉'}).first().waitFor({timeout:2500});
 await desktop.locator('.domestic-company-card').filter({hasText:'华域汽车'}).first().waitFor({timeout:2500});
 assert((await desktop.locator('.domestic-company-card').count())<=16,'Single-character result list should remain compact');
 await desktop.locator('.unified-job-search input').fill('华域视觉');
 await desktop.locator('.domestic-company-card').filter({hasText:'华域视觉'}).first().waitFor({timeout:4500});
 assert(!((await desktop.locator('.domestic-company-result').innerText()).includes('载入企业名录中')));
 await desktop.locator('.domestic-company-card').filter({hasText:'华域视觉'}).first().click();
 await desktop.getByRole('heading',{name:'华域视觉科技'}).waitFor();
 assert.equal(await desktop.locator('.domestic-major-tag').count(),8);
 assert((await desktop.locator('.domestic-editorial-body').innerText()).length>200);
 await desktop.getByText('上海市嘉定区叶城路767号').first().waitFor();
 assert((await desktop.locator('.domestic-official-photo').count())>=2,'Official employer photo gallery must preserve verified images and allow new factory images');
 assert.equal(await desktop.locator('.domestic-careers-link[href="https://hascovision.zhiye.com/social"]').count(),1);
 assert.equal(await desktop.locator('.domestic-profile-relations details[open]').count(),0,
  'Company relations must be collapsed by default');
 await desktop.getByRole('link',{name:/查看与电气工程及其自动化相关的企业/}).click();
 await desktop.getByRole('heading',{name:'电气工程及其自动化'}).waitFor();
 assert.match(desktop.url(),/\/majors\/electrical-engineering$/);
 await desktop.locator('.domestic-major-company').filter({hasText:'华域视觉'}).first().waitFor();
 const majorCard=desktop.locator('.domestic-major-company').filter({hasText:'华域视觉'}).first();
 assert.equal(await majorCard.locator('a[href="https://hascovision.zhiye.com/social"]').count(),1);
 await majorCard.getByRole('link',{name:/了解企业/}).click();
 await desktop.getByRole('heading',{name:'华域视觉科技'}).waitFor();
 await desktop.locator('.domestic-profile-relations summary').click();
 await desktop.locator('.domestic-relations-inside').getByRole('link',{name:/华域汽车/}).click();
 await desktop.getByRole('heading',{name:'华域汽车'}).waitFor();
 assert.equal(await desktop.locator('.domestic-careers-link[href="https://www.hasco-group.com/join/"]').count(),1);
 assert.equal(await desktop.locator('.domestic-careers-link[href="https://saic-recruit.saicmotor.com/"]').count(),0);
 // Each new employer page must begin with a collapsed relation list, never carry prior disclosure state.
 assert.equal(await desktop.locator('.domestic-profile-relations details[open]').count(),0);
 await desktop.locator('.domestic-profile-relations summary').click();
 await desktop.locator('.domestic-relations-inside').getByRole('link',{name:/上汽集团/}).click();
 await desktop.getByRole('heading',{name:'上汽集团'}).waitFor();
 assert.equal(await desktop.locator('.domestic-profile-relations details[open]').count(),0);
 assert.deepEqual(errors,[]);
 console.log('HHBA_REAL_ATS_MARKET_AND_ORIGINAL_LAYOUT_BROWSER_PASS',expected);
}finally{await browser?.close();server.kill('SIGTERM');}
