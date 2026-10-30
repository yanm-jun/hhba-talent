#!/usr/bin/env node
/**
 * Check the *published* GitHub Pages URL, not a local vite preview.
 * This catches old GitHub Pages bundles and missing search results after deploy.
 * Env:
 *   HHBA_PUBLIC_BASE=https://yanm-jun.github.io/hhba-talent/preview-factory-v2/
 *   HHBA_EMPLOYER_ID=cn-autumn-025
 *   HHBA_PUBLIC_SEARCH=青岛
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const base=(process.env.HHBA_PUBLIC_BASE||'https://yanm-jun.github.io/hhba-talent/preview-factory-v2/').replace(/\/?$/,'/');
const id=process.env.HHBA_EMPLOYER_ID||'cn-autumn-025';
assert(/^https:\/\/yanm-jun\.github\.io\/hhba-talent\/preview-factory-v2\/$/.test(base),'Never test or mutate production via this preview checker');
assert(/^cn-autumn-\d{3}$/.test(id));
const p=JSON.parse(fs.readFileSync('src/data/employerProfiles/'+id+'.json','utf8'));
const query=process.env.HHBA_PUBLIC_SEARCH||p.name.slice(0,2);
const output='factory-v2-live-search-proof';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const result={url:'',search:query,employer:p.name,companyVisible:false,jobRecordsVisible:false,urlRetained:false,versionLabel:false,expectedProfileRoute:'/companies/autumn/'+id,rootObservation:null};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},locale:'zh-CN'});
 const url=base+'candidate/jobs/?q='+encodeURIComponent(query);
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:55000});
 result.url=page.url();
 const input=page.getByRole('textbox',{name:'自然语言搜索岗位'});
 await input.waitFor({timeout:25000});
 assert.equal(await input.inputValue(),query,'Published preview ignored URL search query');
 const card=page.locator('.domestic-company-card').filter({hasText:p.name}).first();
 await card.waitFor({state:'visible',timeout:25000});
 assert((await card.getAttribute('href'))?.endsWith('/companies/autumn/'+id),'Published company card has stale route');
 result.companyVisible=true;
 await page.locator('.unified-job-card').filter({hasText:p.name}).first().waitFor({state:'visible',timeout:25000});
 result.jobRecordsVisible=true;
 const version=page.locator('[data-hhba-preview-version="factory-v2"]');
 await version.waitFor({state:'visible',timeout:10000});
 result.versionLabel=true;
 await page.screenshot({path:output+'/published-short-search.png',fullPage:true});
 await page.reload({waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(await page.getByRole('textbox',{name:'自然语言搜索岗位'}).inputValue(),query,'Published search lost after reload');
 await page.locator('.domestic-company-card').filter({hasText:p.name}).first().waitFor({state:'visible',timeout:25000});
 result.urlRetained=true;
 await page.screenshot({path:output+'/published-short-search-after-reload.png',fullPage:true});
 const oldText='当前没有通过近期核验的岗位，请尝试其他筛选条件。';
 assert.equal(await page.getByText(oldText,{exact:true}).count(),0,'Old empty response still visible on verified build');
 await page.close();
 const root=await browser.newPage({viewport:{width:1440,height:900},locale:'zh-CN'});
 try{
  await root.goto('https://yanm-jun.github.io/hhba-talent/candidate/jobs/?q='+encodeURIComponent(query),{waitUntil:'domcontentloaded',timeout:25000});
  const rootInput=root.getByRole('textbox',{name:'自然语言搜索岗位'});
  await rootInput.waitFor({timeout:12000});
  result.rootObservation={url:root.url(),hasV2Label:await root.locator('[data-hhba-preview-version="factory-v2"]').count()>0,
   matchingCompanyCards:await root.locator('.domestic-company-card').filter({hasText:p.name}).count()};
  await root.screenshot({path:output+'/existing-root-not-modified.png',fullPage:true});
 }catch(e){
  result.rootObservation={url:root.url(),error:String(e).slice(0,300)};
 }
 await root.close();
 result.status='PASS';
 fs.writeFileSync(output+'/result.json',JSON.stringify(result,null,2)+'\n');
 console.log('HHBA_PUBLISHED_V2_SEARCH_VALIDATED '+JSON.stringify(result));
}finally{await browser.close()}
