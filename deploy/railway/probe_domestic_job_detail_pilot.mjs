import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from '../../.browser-test/node_modules/playwright/index.mjs';
const data=JSON.parse(readFileSync(new URL('./domestic_tencent_meituan_pilot_20261018.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true});
const proof=[];
try{
 for(const j of data.jobs){
  const page=await browser.newPage({locale:'zh-CN',viewport:{width:1280,height:800}});
  let http=null,title='',url='',visible='',error=null;
  try{
   const res=await page.goto(j.url,{waitUntil:'domcontentloaded',timeout:23000});
   http=res?.status()??null;url=page.url();title=(await page.title()).slice(0,150);
   visible=(await page.locator('body').innerText({timeout:6000})).replace(/\s+/g,' ').slice(0,3000);
  }catch(e){error=String(e.message||e).slice(0,170);try{url=page.url()}catch{}}
  const actualHost=(()=>{try{return new URL(url).hostname}catch{return ''}})();
  const hostAllowed=j.company==='Tencent'?actualHost==='careers.tencent.com':actualHost==='zhaopin.meituan.com';
  const hasTitle=visible.includes(j.title)||title.includes(j.title);
  const unavailable=/(当前职位无法投递|职位已下线|该职位已关闭|职位已过期|该岗位已停止招聘)/.test(visible);
  const ok=http===200&&hostAllowed&&hasTitle&&!unavailable;
  proof.push({company:j.company,id:j.officialId,status:http,hostAllowed,hasTitle,unavailable,ok,url,title,excerpt:visible.slice(0,150),error});
  console.log('HHBA_DOMESTIC_JOB_DETAIL_PROBE',JSON.stringify(proof.at(-1)));
  await page.close();
 }
}finally{await browser.close()}
mkdirSync('domestic-official-job-evidence',{recursive:true});
writeFileSync('domestic-official-job-evidence/probe.json',JSON.stringify({runAt:new Date().toISOString(),proof},null,2));
console.log('HHBA_DOMESTIC_JOB_DETAIL_SUMMARY',JSON.stringify({passed:proof.filter(x=>x.ok).length,skipped:proof.filter(x=>!x.ok).map(x=>x.id),total:proof.length}));
