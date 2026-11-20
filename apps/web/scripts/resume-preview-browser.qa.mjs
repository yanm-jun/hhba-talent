// Live, anonymous Chromium smoke against an immutable Cloudflare Preview.
// No user login, no resume upload and no paid AI calls.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const root=(process.env.HHBA_PREVIEW_URL||'').replace(/\/$/,'');
assert.match(root,/^https:\/\/[a-z0-9-]+\.hhba-talent\.pages\.dev$/i,
 'Only immutable HHBA Preview deployments may be tested');
const output=process.env.QA_OUTPUT||'/tmp/hhba-resume-live-preview-qa';
await mkdir(output,{recursive:true});
function findChrome(){
 for(const bin of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
  try{return execFileSync('which',[bin],{encoding:'utf8'}).trim()}catch{}
 }
 throw Error('No headless Chromium binary available');
}
const browser=await chromium.launch({executablePath:findChrome(),headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const reports=[];
 for(const device of [{name:'desktop',width:1365,height:900},{name:'mobile',width:390,height:844}]){
  const page=await browser.newPage({viewport:{width:device.width,height:device.height},locale:'zh-CN'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto(root+'/candidate/match',{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response?.status(),200,device.name+' must load the public application shell');
  await page.waitForTimeout(1800);
  assert.equal(new URL(page.url()).origin,new URL(root).origin,
   'the Preview must never redirect visitors onto hhba.work production');
  const text=await page.locator('body').innerText();
  assert.ok(text.trim().length>=30,device.name+' page unexpectedly blank');
  assert.match(text,/HHBA|汇方职场|简历|登录/,
   device.name+' did not show the expected HHBA shell or login gate');
  assert.deepEqual(errors,[],device.name+' unhandled browser errors');
  const widths=await page.evaluate(()=>({
   viewport:document.documentElement.clientWidth,
   content:document.documentElement.scrollWidth
  }));
  await page.screenshot({path:output+'/'+device.name+'-preview.png',fullPage:true});
  reports.push({device:device.name,finalPath:new URL(page.url()).pathname,
   bodyCharacters:text.length,widths});
  await page.close();
 }
 console.log(JSON.stringify({result:'PASS',preview:root,reports}));
}finally{await browser.close()}
