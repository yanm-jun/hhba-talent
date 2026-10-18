import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='https://hhba-live-jobs-preview-production.up.railway.app';
await mkdir('browser-evidence',{recursive:true});
const browser=await chromium.launch({headless:true});
let failures=[];
let stats={};
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,
  isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(response.status(),200);
 await page.locator('#jobs .job').first().waitFor({timeout:30000});
 assert.equal(await page.locator('#toggle-zh').count(),1);
 assert.equal(await page.locator('#toggle-en').count(),1);
 const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,
  client:document.documentElement.clientWidth}));
 if(width.scroll>width.client+5)failures.push({type:'mobile_horizontal_overflow',...width});
 await page.screenshot({path:'browser-evidence/market-zh.png',fullPage:false});
 const entries=await page.evaluate(async()=>{
  const res=await fetch('/api/jobs');return (await res.json()).jobs;
 });
 stats.listings=entries.length;
 stats.language=await page.locator('#toggle-zh').getAttribute('class');
 // Flip language in place, then return to Chinese.
 await page.locator('#toggle-en').click();
 const englishRemote=await page.locator('#jobs .job .meta span:nth-child(2)').first().innerText();
 if(/[\u3400-\u9fff]/.test(englishRemote))
  failures.push({type:'english_remote_badge_is_chinese',value:englishRemote});
 if(!await page.locator('#toggle-en').getAttribute('class').then(x=>x?.includes('on')))
  failures.push({type:'english_toggle_not_selected'});
 await page.locator('#toggle-zh').click();
 const seen=new Set();
 for(const platform of ['greenhouse','ashby','lever']){
  const job=entries.find(j=>j.platform===platform&&j.company==='Airwallex')||
    entries.find(j=>j.platform===platform);
  if(!job){failures.push({platform,type:'no_live_job'});continue;}
  if(seen.has(job.id))continue;seen.add(job.id);
  const entry={platform,id:job.id};
  try{
   response=await page.goto(base+'/jobs/'+encodeURIComponent(job.id),
    {waitUntil:'domcontentloaded',timeout:30000});
   entry.http=response.status();
   if(!response.ok())throw Error('GET status '+response.status());
   await page.locator('#jd-zh').waitFor({state:'attached',timeout:10000});
   await page.locator('#detail-zh').click();
   await page.locator('#jd-en').count();
   assert.equal(await page.locator('#detail-zh').count(),1);
   assert.equal(await page.locator('#detail-en').count(),1);
   assert.equal(await page.locator('#personal-reader').count(),1);
   if(platform==='ashby')await page.screenshot({path:'browser-evidence/job-zh-loading.png'});
   await page.locator('#detail-en').click();
   const official=await page.locator('#jd-en').innerText();
   const visibleEnglish=await page.locator('body').innerText();
   const withoutLanguagePicker=visibleEnglish.replace(/中文/g,'');
   if(/[\u3400-\u9fff]/.test(withoutLanguagePicker))
     failures.push({platform,type:'chinese_UI_leaks_in_English_mode',id:job.id,
       snippet:withoutLanguagePicker.match(/.{0,15}[\u3400-\u9fff].{0,30}/)?.[0]||''});
   entry.englishChars=official.length;
   if(official.length<100)throw Error('English official JD too short');
   await page.locator('#detail-zh').click();
   // Chrome executes reader's actual JS. Wait for first true Chinese paragraph.
   const chinese=page.locator('#translated-paragraphs');
   await page.waitForFunction(()=>{
    const el=document.querySelector('#translated-paragraphs');
    return !!el&&el.textContent.length>40&&/[\u3400-\u9fff]/.test(el.textContent);
   },{timeout:60000}).catch(()=>{});
   entry.chineseChars=(await chinese.innerText()).length;
   const shownChinese=await chinese.innerText();
   if(shownChinese.includes('【关键信息核对：以下英文原文数字未全部保留】'))
     failures.push({platform,id:job.id,type:'English_source_appended_to_Chinese_reading'});
   if(await page.locator('#jd-zh .reader-original').count())
     failures.push({platform,id:job.id,type:'full_English_expanded_inside_Chinese_reading'});
   if(!await page.locator('#show-original-english').count())
     failures.push({platform,id:job.id,type:'English_original_switch_missing'});
   const numericRiskVisible=await page.locator('#numeric-risk').isVisible();
   entry.riskBadgeVisible=numericRiskVisible;
   entry.progress=await page.locator('#translation-progress').innerText();
   if(entry.chineseChars<40)
    failures.push({platform,type:'real_browser_chinese_not_readable',id:job.id,
      state:entry.progress});
   if(platform==='ashby')await page.screenshot({path:'browser-evidence/job-zh.png'});
   await page.locator('#detail-en').click();
   if(platform==='ashby')await page.screenshot({path:'browser-evidence/job-en.png'});
  }catch(err){failures.push({platform,id:job.id,type:'browser_detail_error',error:err.message});}
  stats[platform]=entry;
 }
 if(errors.length)failures.push({type:'browser_page_errors',errors:errors.slice(0,8)});
 await writeFile('browser-evidence/report.json',JSON.stringify({stats,failures},null,2));
 console.log('HHBA_MOBILE_BROWSER_AUDIT',JSON.stringify({stats,failures}));
 if(failures.length)process.exitCode=1;
}finally{await browser.close();}
