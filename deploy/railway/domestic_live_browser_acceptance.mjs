import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../../.browser-test/node_modules/playwright/index.mjs';
const base='https://hhba-live-jobs-preview-production.up.railway.app';
async function json(path){
 const res=await fetch(base+path,{signal:AbortSignal.timeout(70000),headers:{Accept:'application/json'}});
 assert.equal(res.status,200,path+' HTTP status');return res.json();
}
const combined=await json('/api/jobs/page?limit=1');
assert.ok(combined.allJobs>=8761,'Merged index unexpectedly shrank');
assert.equal(combined.domesticObserved,1010);
assert.equal(combined.boards,34);
const mi=await json('/api/jobs/page?country=cn&limit=5');
assert.equal(mi.total,1010);
assert.ok(mi.jobs.every(j=>j.domestic&&j.company==='Xiaomi'));
for(const [type,expected] of [['SOCIAL',350],['CAMPUS',350],['INTERNSHIP',310]]){
 const page=await json('/api/jobs/page?country=cn&recruitment_type='+type+'&limit=2');
 assert.equal(page.total,expected,type+' source count');
}
for(const q of ['小米','小米集团','Xiaomi']){
 const data=await json('/api/jobs/page?q='+encodeURIComponent(q)+'&limit=2');
 assert.equal(data.total,1010,'Chinese/English Xiaomi search: '+q);
}
const oa=await json('/api/jobs/page?q=OpenAI&limit=3');
assert.ok(oa.total>=1&&oa.jobs.every(j=>j.company==='OpenAI'),'OpenAI source regression');
const item=mi.jobs[0];const itemDetail=await json('/api/jobs/'+encodeURIComponent(item.id));
assert.equal(itemDetail.description,null);
assert.equal(itemDetail.applyUrl,null);
assert.equal(itemDetail.currentApplicationVerified,false);
assert.equal(itemDetail.recordKind,'OFFICIAL_LIST_OBSERVED');
assert.match(itemDetail.officialListUrl,/^https:\/\/xiaomi\.jobs\.f\.mioffice\.cn\//);
const browser=await chromium.launch({headless:true});
await mkdir('domestic-live-evidence',{recursive:true});
try{
 const desktop=await browser.newPage({viewport:{width:1340,height:900},locale:'zh-CN'});
 const errors=[];desktop.on('pageerror',e=>errors.push(e.message));
 await desktop.goto(base+'/?q=小米',{waitUntil:'domcontentloaded',timeout:80000});
 await desktop.waitForFunction(()=>document.querySelector('.job .company-name')?.textContent==='小米集团',{timeout:75000});
 assert.match(await desktop.locator('#shown').innerText(),/1,?010/);
 await desktop.locator('#country').selectOption('cn');
 await desktop.locator('#recruitment').selectOption('CAMPUS');
 await desktop.waitForFunction(()=>document.querySelector('#shown')?.textContent?.includes('350'),{timeout:75000});
 assert.equal((await desktop.locator('.job .company-name').first().innerText()),'小米集团');
 await desktop.screenshot({path:'domestic-live-evidence/xiaomi-desktop.png',fullPage:false});
 await desktop.locator('.job-title').first().click();
 await desktop.waitForURL(/\/jobs\/xiaomi-/,{timeout:35000});
 assert.ok((await desktop.locator('body').innerText()).includes('投递链接尚未核实')||(await desktop.locator('body').innerText()).includes('直达投递链接'));
 const officialLink=await desktop.locator('.action').getAttribute('href');assert.ok(officialLink.startsWith('https://xiaomi.jobs.f.mioffice.cn/'));
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'zh-CN'});
 mobile.on('pageerror',e=>errors.push('mobile: '+e.message));
 await mobile.goto(base+'/?q=小米',{waitUntil:'domcontentloaded',timeout:80000});
 await mobile.waitForFunction(()=>document.querySelector('.job .company-name')?.textContent==='小米集团',{timeout:75000});
 await mobile.screenshot({path:'domestic-live-evidence/xiaomi-mobile.png',fullPage:false});
 assert.equal(errors.length,0,errors.join('; '));
 console.log('HHBA_DOMESTIC_LIVE_BROWSER_PASS',JSON.stringify({merged:combined.allJobs,domestic:mi.total,openAI:oa.total,boards:combined.boards,desktop:true,mobile:true,sourceFilters:true,jobDetail:'safe',officialList:'correct'}));
}finally{await browser.close();}
