import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/').replace(/\/?$/,'/');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900},locale:'zh-CN'});
  const runtimeErrors=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  await page.goto(root+'candidate/jobs/',{waitUntil:'domcontentloaded',timeout:60000});
  const input=page.getByRole('textbox',{name:'自然语言搜索岗位'});
  await input.waitFor({timeout:16000});
  await page.waitForFunction(()=>{const text=document.body.innerText;return /共匹配\s*[1-9][0-9]*\s*条/.test(text)||text.includes('DOMESTIC_REBUILD_SOURCE_INVALID')},{timeout:25000});
  const firstPaint=await page.locator('body').innerText();
  assert(!firstPaint.includes('DOMESTIC_REBUILD_SOURCE_INVALID'),'No full-market invalid-source crash');
  assert(/共匹配\s*[1-9][0-9]*\s*条/.test(firstPaint),'Market must render nonzero jobs with unchanged default filters');
  await input.fill('佑驾创新');
  await page.waitForFunction(()=>{const t=document.body.innerText;return t.includes('佑驾创新')&&/共匹配\s*[1-9][0-9]*\s*条/.test(t)}, {timeout:20000});
  assert.equal(await page.getByRole('alert').filter({hasText:'DOMESTIC_REBUILD_SOURCE_INVALID'}).count(),0);
  assert.equal(runtimeErrors.length,0,'No JS runtime errors on market desktop/mobile');
  await page.goto(root+'candidate/jobs/cn-v2-profile-cn-autumn-035-MJ000950',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(900);
  const detail=await page.locator('body').innerText();
  assert(detail.includes('研发运营')&&!detail.includes('国内岗位来源无效'),'Original uppercase Moka role ID must resolve');
  await page.goto(root+'candidate/jobs/cn-v2-profile-cn-autumn-047-rd',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(900);
  const shortIdDetail=await page.locator('body').innerText();
  assert(shortIdDetail.includes('研发工程师')&&!shortIdDetail.includes('国内岗位来源无效'),'Two-character authentic role ID must resolve');
  console.log('HHBA_MARKET_NO_SOURCE_INVALID_BROWSER_OK',width,'nonempty, search, MJ000950, rd');
  await page.close();
 }
} finally {await browser.close()}
