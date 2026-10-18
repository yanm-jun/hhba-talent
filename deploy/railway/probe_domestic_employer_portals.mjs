import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from '../../.browser-test/node_modules/playwright/index.mjs';
const catalog=JSON.parse(readFileSync(new URL('./domestic_employer_directory_20261018.json',import.meta.url),'utf8')).employers;
const allowedHosts={
 Tencent:['careers.tencent.com','join.qq.com'],
 ByteDance:['jobs.bytedance.com','job.bytedance.com','bytedance.com'],
 Huawei:['career.huawei.com'],
 BYD:['job.byd.com','www.byd.com','byd.com'],
 Alibaba:['talent.alibaba.com','job.alibaba.com'],
 Meituan:['zhaopin.meituan.com','hr.meituan.com'],
 Baidu:['talent.baidu.com'],
 NIO:['campus.nio.com','app.nio.com','nio.com'],
 Lenovo:['talent.lenovo.com.cn','jobs.lenovo.com','lenovo.com'],
 'Trip.com Group':['careers.ctrip.com','www.ctrip.com','ctrip.com']
};
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const e of catalog){
  const context=await browser.newContext({locale:'zh-CN',viewport:{width:1200,height:800}});
  const page=await context.newPage();let status=0,finalUrl='',title='',snippet='',error=null;
  try{
   const response=await page.goto(e.url,{waitUntil:'domcontentloaded',timeout:24000});
   status=response?.status()||0;finalUrl=page.url();title=(await page.title()).slice(0,140);
   snippet=(await page.locator('body').innerText({timeout:5500})).replace(/\s+/g,' ').slice(0,420);
  }catch(x){error=String(x?.message||x).slice(0,170);try{finalUrl=page.url()}catch{}}
  const h=(()=>{try{return new URL(finalUrl).hostname}catch{return ''}})();
  const inScope=(allowedHosts[e.id]||[]).includes(h);
  const verified=!!(status>=200&&status<400&&inScope&&/(招聘|职位|岗位|工作|career|job|join|opportunities|apply|应聘|校招|社招)/i.test(title+' '+snippet));
  results.push({id:e.id,name:e.zh,input:e.url,status,finalUrl,finalHost:h,inScope,verified,title,excerpt:snippet.slice(0,170),error});
  console.log('HHBA_DOMESTIC_PORTAL_PROBE',JSON.stringify(results.at(-1)));
  await context.close();
 }
}finally{await browser.close()}
mkdirSync('domestic-portal-evidence',{recursive:true});
writeFileSync('domestic-portal-evidence/probe.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
console.log('HHBA_DOMESTIC_PORTAL_SUMMARY',JSON.stringify({total:results.length,verified:results.filter(x=>x.verified).length,unresolved:results.filter(x=>!x.verified).map(x=>x.id)}));
