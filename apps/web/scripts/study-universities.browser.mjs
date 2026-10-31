#!/usr/bin/env node
// Browser acceptance of the REAL compiled HHBA Pages app, desktop + mobile.
// Checks verified school/program navigation through the existing Study Abroad V1 UI.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const out='mainline-v2-browser-proof';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const proof={base,desktop:false,mobile:false,search:false,countryFilter:false,universityDetails:false,programDetails:false,sourceLinks:false,noFakeResults:false};
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'study-abroad',{waitUntil:'domcontentloaded',timeout:45000});
  const consent=page.getByRole('button',{name:'暂不同意'});
  if(await consent.isVisible().catch(()=>false))await consent.click();
  const catalog=page.locator('[data-study-module="university-program-registry"]');
  await catalog.waitFor({state:'visible',timeout:18000});
  const cards=page.locator('.hhba-uni-school-card');
  assert.equal(await cards.count(),8,'8 official university cards must be visible');
  assert.equal(await page.locator('.hhba-uni-program-link').count(),15,'15 distinct, directly linked programs must be present');
  await page.screenshot({path:out+'/study-module01-overview-'+width+'.png',fullPage:true});
  await page.getByRole('textbox',{name:'搜索国家或留学方向'}).fill('网络安全');
  await page.getByRole('button',{name:/搜索留学机会/}).click();
  assert.equal(await cards.count(),1,'Professional query shows only its university');
  assert.equal(await page.locator('.hhba-uni-program-link').count(),1,'Professional query must not show unrelated programs');
  assert((await page.locator('.hhba-uni-program-link').innerText()).includes('网络安全'));
  proof.search=true;
  await page.locator('.hhba-uni-clear').click();
  await page.getByRole('combobox',{name:'筛选国家'}).selectOption('uk');
  assert.equal(await cards.count(),1,'UK select must filter university results');
  assert.equal(await page.locator('.hhba-uni-program-link').count(),2,'UK must list 2 evidence-backed conversion programs');
  proof.countryFilter=true;
  await cards.getByRole('link',{name:'伯明翰大学'}).click();
  // Birmingham is a full-length University 04 profile now. Verify that the
  // actual country-filter result opens its new rich page, not the former short template.
  await page.locator('[data-bham-detail="verified-longform"]').waitFor({state:'visible',timeout:12000});
  assert((await page.locator('.hhba-minot-hero').innerText()).includes('University of Birmingham'));
  assert.equal(await page.locator('#bham-programs .hhba-minot-program-card').count(),2);
  assert.equal(await page.locator('#bham-photos .hhba-minot-thumb').count(),3);
  proof.universityDetails=true;
  await page.locator('#bham-programs .hhba-minot-program-card a[href*="/program/"]').first().click();
  await page.locator('#bham-curriculum .hhba-minot-narrative').first().waitFor({state:'visible',timeout:12000});
  assert.equal(await page.locator('#bham-curriculum .hhba-minot-narrative').count(),6);
  const actualSource=page.locator('.hhba-minot-degree-hero .hhba-study-btn[href^="https://"]');
  assert.equal(await actualSource.count(),1);
  assert((await actualSource.getAttribute('href')).includes('birmingham.ac.uk'));
  assert.equal(await actualSource.getAttribute('target'),'_blank');
  assert.equal(await actualSource.getAttribute('rel'),'noopener noreferrer');
  assert((await page.locator('#bham-fees').innerText()).includes('£36,000'));
  proof.programDetails=true;
  proof.sourceLinks=true;
  await page.goto(base+'study-abroad',{waitUntil:'domcontentloaded'});
  await page.locator('[data-study-module="university-program-registry"]').waitFor();
  await page.getByRole('textbox',{name:'搜索国家或留学方向'}).fill('机械');
  await page.getByRole('button',{name:/搜索留学机会/}).click();
  assert.equal(await cards.count(),0,'Unlisted mechanical program should not return arbitrary universities');
  assert(await page.getByText('没有匹配的具体专业').isVisible());
  proof.noFakeResults=true;
  await page.screenshot({path:out+'/study-module01-precise-empty-'+width+'.png',fullPage:true});
  assert.deepEqual(errors,[],'No uncaught browser errors');
  if(width===1440)proof.desktop=true;else proof.mobile=true;
  await page.close();
 }
 writeFileSync(out+'/study-module01-result.json',JSON.stringify(proof,null,2));
 console.log('HHBA_STUDY_MODULE01_LIVE_CHROMIUM_PASS',JSON.stringify(proof));
}finally{await browser.close();}
