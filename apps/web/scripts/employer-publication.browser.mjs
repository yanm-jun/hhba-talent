import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/preview-employer/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900},locale:'zh-CN'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
mkdirSync('publication-review',{recursive:true});
try{
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:40000});
 await page.getByRole('button',{name:/我要招人/}).click();
 await page.getByRole('link',{name:/进入企业工作台/}).click();
 await page.getByRole('link',{name:'企业公开评分档案'}).click();
 await page.getByRole('heading',{name:/企业怎么样，让证据和行动说话/}).waitFor();
 await page.getByRole('heading',{name:'企业信誉值'}).waitFor();
 await page.getByRole('heading',{name:'员工善待值'}).waitFor();
 await page.getByText('正式评分发布服务尚未开放').waitFor();
 await page.getByText('暂无可以公开的真实改善记录。').waitFor();
 await page.screenshot({path:'publication-review/public-pending-desktop.png',fullPage:true});
 const body=await page.locator('.vp-page').innerText();
 if(/\b88\b|\b92\b/.test(body))throw Error('FABRICATED_SCORES');
 await page.goto(base+'/employer/verified-profile/',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'企业信誉值'}).waitFor();
 await page.goto(base+'/admin/employer-publication/',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:/双人审核、版本发布与撤销/}).waitFor();
 await page.getByText('真实评分发布与撤销尚未开放').waitFor();
 for(const name of ['待可信发布服务接入','待双人审核接入','待撤销权限接入']){
  if(await page.getByRole('button',{name}).isEnabled())throw Error('UNTRUSTED_ADMIN_ENABLED '+name);
 }
 await page.screenshot({path:'publication-review/admin-closed-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/employer/verified-profile/',{waitUntil:'domcontentloaded'});
 await page.getByText('正式评分发布服务尚未开放').waitFor();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+3);
 if(overflow)throw Error('MOBILE_HORIZONTAL_OVERFLOW');
 await page.screenshot({path:'publication-review/public-mobile.png',fullPage:true});
 if(errors.length)throw Error('PAGE_ERRORS '+JSON.stringify(errors));
 console.log('HHBA_PUBLICATION_BROWSER_OK',JSON.stringify({twoScoresPending:true,noFabrication:true,lockedAdmin:true,mobile:true,deepLinks:true}));
}finally{await browser.close()}
