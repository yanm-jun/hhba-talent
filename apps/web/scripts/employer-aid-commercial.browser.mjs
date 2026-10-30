import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const base=(process.env.HHBA_TEST_BASE||'http://127.0.0.1:4173/hhba-talent/preview-employer/').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900},locale:'zh-CN'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
mkdirSync('aid-review',{recursive:true});
try{
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:40000});
 await page.getByRole('button',{name:/我要招人/}).click();
 await page.getByRole('link',{name:/进入企业工作台/}).click();
 await page.getByRole('link',{name:'帮扶申请',exact:true}).click();
 await page.getByRole('heading',{name:/让真正善待员工的企业，获得更多机会/}).waitFor();
 await page.getByText('真实企业帮扶申请尚未开放').waitFor();
 if(await page.getByRole('button',{name:'待可信帮扶服务接入'}).isEnabled())throw Error('BUSINESS_AID_UNSAFE');
 await page.getByText('暂时没有真实帮扶申请。').waitFor();
 await page.screenshot({path:'aid-review/company-application-desktop.png',fullPage:true});
 await page.getByRole('link',{name:/查看客户对接记录/}).click();
 await page.getByRole('heading',{name:'客户引荐与真实商业合作记录'}).waitFor();
 await page.getByText('真实客户引荐后台尚未开放').waitFor();
 await page.getByText('目前没有已经核实的客户引荐记录。').waitFor();
 await page.screenshot({path:'aid-review/client-records-desktop.png',fullPage:true});
 await page.goto(base+'/admin/employer-aid/',{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:'帮扶审批与客户对接运营台'}).waitFor();
 await page.getByText('真实帮扶审批与客户对接暂未开放').waitFor();
 for(const name of ['待独立审核服务接入','待匹配权限接入','待权限与客户同意核验','待可信订单核验服务接入'])
  if(await page.getByRole('button',{name}).isEnabled())throw Error('BUSINESS_ADMIN_UNSAFE '+name);
 await page.screenshot({path:'aid-review/admin-closed-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/employer/aid/apply/',{waitUntil:'domcontentloaded'});
 await page.getByText('真实企业帮扶申请尚未开放').waitFor();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+3);
 if(overflow)throw Error('AID_MOBILE_HORIZONTAL_OVERFLOW');
 await page.screenshot({path:'aid-review/company-mobile.png',fullPage:true});
 if(errors.length)throw Error('PAGE_ERRORS '+JSON.stringify(errors));
 console.log('HHBA_AID_COMMERCIAL_BROWSER_OK',JSON.stringify({noFakeApplications:true,noFakeOrders:true,disabledAdmin:true,mobile:true,deepLinks:true}));
}finally{await browser.close()}
