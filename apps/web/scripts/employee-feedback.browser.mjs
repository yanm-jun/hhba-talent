import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/preview-employer/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900},locale:'zh-CN'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
mkdirSync('feedback-review',{recursive:true});
try{
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:/我要招人/}).click();
 await page.getByRole('link',{name:/进入企业工作台/}).click();
 await page.getByRole('link',{name:'企业公开视图'}).click();
 await page.getByRole('button',{name:'员工'}).click();
 await page.getByRole('link',{name:/查看员工反馈流程/}).click();
 await page.getByRole('heading',{name:/让每一份真实的工作体验被尊重/}).waitFor();
 await page.getByText('真实反馈服务尚未开放').waitFor();
 if(await page.getByRole('button',{name:'待可信员工认证服务接入'}).isEnabled())
   throw Error('ISSUE_UNVERIFIED_TICKET');
 if(await page.getByRole('button',{name:'尚未开放真实提交'}).isEnabled())
   throw Error('SUBMIT_UNVERIFIED_EMPLOYEE_FEEDBACK');
 for(const s of ['薪酬支付体验','社会保障体验','工时与休假体验','工作尊重与沟通','员工发展与成长']){
   await page.getByText(s,{exact:true}).waitFor();
 }
 if(await page.locator('input[type="radio"]:enabled').count())throw Error('UNVERIFIED_FEEDBACK_ENABLED');
 await page.screenshot({path:'feedback-review/employee-gated-desktop.png',fullPage:true});
 await page.goto(base+'/employee/feedback/',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:/让每一份真实的工作体验被尊重/}).waitFor();
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/employee/feedback/',{waitUntil:'domcontentloaded'});
 await page.getByText('真实反馈服务尚未开放').waitFor();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+3);
 if(overflow)throw Error('MOBILE_HORIZONTAL_OVERFLOW');
 await page.screenshot({path:'feedback-review/employee-gated-mobile.png',fullPage:true});
 if(errors.length)throw Error('PAGE_ERRORS '+JSON.stringify(errors));
 console.log('HHBA_EMPLOYEE_FEEDBACK_BROWSER_OK',JSON.stringify({questionCount:5,serverAuthRequired:true,noFakeFeedback:true,deepLink:true,mobile:true}));
}finally{await browser.close()}
