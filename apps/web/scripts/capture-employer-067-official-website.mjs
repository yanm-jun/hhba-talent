import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const url='https://www.cnpresky.com/';
const folder='public/images/employer-profiles/cn-autumn-067';
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:820},deviceScaleFactor:1,locale:'zh-CN'});
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForTimeout(1800);
 const body=(await page.locator('body').innerText()).slice(0,9000);
 if(!body.includes('弘象')||!body.includes('气象'))throw Error('Page did not show the verified real company');
 const output=folder+'/photo1.png';
 await page.screenshot({path:output,animations:'disabled',fullPage:false});
 const file=await readFile(output);
 if(file.length<16000||file.subarray(1,4).toString()!=='PNG')throw Error('Company screenshot missing/invalid');
 const audit=[{filename:'photo1.png',sourceUrl:url,sourceType:'browser-captured official public company webpage',sourceNote:'Real corporate website screenshot. Not an office/workplace photograph; URL and capture visible in provenance.',company:'北京弘象科技有限公司',photographClaim:false,sha256:createHash('sha256').update(file).digest('hex'),bytes:file.length,commercialLicenseVerified:false}];
 await writeFile(folder+'/media-sources.json',JSON.stringify(audit,null,2)+'\n');
 console.log('HHBA_067_ACTUAL_COMPANY_SITE_SCREENSHOT_READY',JSON.stringify({url,bytes:file.length,sha256:audit[0].sha256}));
}finally{await browser.close();}
