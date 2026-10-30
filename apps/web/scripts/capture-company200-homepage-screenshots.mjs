// Fetch screenshot-sized visual references ONLY from a named company's published site.
// A screenshot is NOT proof of an office/headquarters photo or a verified company logo.
// No Railway and no production services are accessed.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root='src/data/';
const target=JSON.parse(readFileSync(root+'domesticComplete200Target.json','utf8'));
const profiles=JSON.parse(readFileSync(root+'domesticCompanyExpansion200Profiles.json','utf8'));
const manifest=JSON.parse(readFileSync(root+'domesticMedia200Bundle.json','utf8'));
const {chromium}=await import('playwright');
const {default:sharp}=await import('sharp');
const existing=new Set(target.companyNames.slice(0,100));
const group=[...target.thirdCohortNames,...target.fourthCohortNames];
const stats={checked:group.length,screenshots:0,logoCandidates:0,skippedExisting:0,failed:[],saved:[]};
mkdirSync('public/domestic-media',{recursive:true});
mkdirSync('preview-reports',{recursive:true});
const shortHash=v=>createHash('sha256').update(v).digest('hex').slice(0,20);
function safeSite(str){
 try{
  const u=new URL(str);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)return null;
  if(u.hostname==='localhost'||u.hostname.endsWith('.local')||!u.hostname.includes('.'))return null;
  return u;
 }catch{return null}
}
function staysWithinEmployerSite(before,after){
 const a=before.hostname.replace(/^www\./,'').toLowerCase();
 const b=after.hostname.replace(/^www\./,'').toLowerCase();
 return before.protocol==='https:'&&after.protocol==='https:'&&(a===b||b.endsWith('.'+a));
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let index=0;
try {
 await Promise.all(Array.from({length:3},async()=>{
  while(index<group.length){
   const name=group[index++];
   const profile=profiles[name];
   const existingSource=profile?.website||profile?.officialSource;
   if(!profile||existing.has(name)){stats.failed.push({name,error:'unexpected_profile_or_cohort'});continue}
   const record=manifest.companies[name]||{brand:{state:'missing',classification:'identity_not_yet_verified'},photos:[]};
   record.photos ||= [];
   const hasOriginalScreenshot=(profile.photos||[]).some(x=>x.verification==='company_website_screenshot_unreviewed'&&
       x.localPath&&existsSync(path.join('public',x.localPath)));
   // A previously captured screenshot is enough to avoid expensive repeat visits.
   if(hasOriginalScreenshot){stats.skippedExisting++;continue}
   const url=safeSite(existingSource);
   if(!url){stats.failed.push({name,error:'missing_safe_company_website'});continue}
   const page=await browser.newPage({viewport:{width:1280,height:790},deviceScaleFactor:1,locale:'zh-CN',ignoreHTTPSErrors:false});
   page.setDefaultTimeout(1800); // Dynamic headers must not block a company for 30 seconds per element.
   try{
    await page.route('**/*',route=>{
      const u=route.request().url();
      if(/^(?:file:|data:|blob:|about:)/i.test(u))return route.continue();
      if(!/^https?:\/\//i.test(u)||/^(?:http:\/\/)?(?:127\.|10\.|192\.168\.|localhost|169\.254\.)/i.test(u.replace(/^https?:\/\//,'')))return route.abort();
      return route.continue();
    });
    const candidates=[url,safeSite(profile.officialSource),
      safeSite(url.hostname.startsWith('www.')?'https://'+url.hostname.slice(4)+url.pathname:'https://www.'+url.hostname+url.pathname)]
      .filter(Boolean).filter((item,i,arr)=>arr.findIndex(v=>v.href===item.href)===i);
    let final=null,title='',lastError='unreachable';
    for(const candidate of candidates){
     try{
      const reply=await page.goto(candidate.href,{waitUntil:'domcontentloaded',timeout:10000});
      if(!reply||reply.status()>=400)throw new Error('http_'+(reply?.status()||0));
      const actual=safeSite(page.url());
      if(!actual||!staysWithinEmployerSite(candidate,actual))throw new Error('unexpected_redirect');
      const t=(await page.title()).trim();
      if(!t||/403|404|not found|access denied|security check|captcha|robot verification/i.test(t))throw new Error('unusable_page_title');
      const body=await page.locator('body').innerText({timeout:1800}).catch(()=>'');
      if(body.replace(/\s+/g,'').length<35)throw new Error('page_content_not_proven');
      const matchText=(t+' '+body.slice(0,1800)).normalize('NFKC').toLocaleLowerCase();
      const tokens=[name,name.replace(/(集团|汽车|科技|股份|国际)$/,'')].filter(x=>x.length>=2);
      if(!tokens.some(x=>matchText.includes(x.toLocaleLowerCase())))throw new Error('company_identity_not_visible_in_page');
      title=t;final=actual;break;
     }catch(e){lastError=String(e.message||e).slice(0,100)}
    }
    if(!final)throw new Error('no_firstparty_page:'+lastError);
    await page.waitForTimeout(500);
    let screenshot;
    try{screenshot=await page.screenshot({type:'jpeg',quality:74,fullPage:false,animations:'allow',timeout:5500})}
    catch{throw new Error('screenshot_timeout')}
    const output=await sharp(screenshot).resize({width:1024,withoutEnlargement:true}).webp({quality:78,effort:4}).toBuffer();
    if(output.length<2300)throw new Error('image_too_small');
    const rel='domestic-media/company200-site-'+shortHash(name)+'.webp';
    writeFileSync(path.join('public',rel),output);
    const photo={url:rel,localPath:rel,source:final.href,kind:'screenshot',
      label:name+'官方网站页面截图（非总部或办公环境实景）',
      verification:'company_website_screenshot_unreviewed',sourceFile:'company200-screenshot'};
    const entry=(profile.photos||[]).findIndex(x=>x.sourceFile==='company200-screenshot');
    profile.photos ||= [];
    if(entry>=0){profile.photos[entry]=photo;record.photos[entry]={state:'ready',path:rel,source:final.href,classification:'official_website_screenshot_unreviewed'};}
    else{profile.photos.push(photo);record.photos[profile.photos.length-1]={state:'ready',path:rel,source:final.href,classification:'official_website_screenshot_unreviewed'};}
    // Capture only a first-party page-header logo candidate, NEVER an arbitrary
    // sponsor, social icon or logo inside the page body. Review before verification.
    if(!profile.brandLocalPath || !existsSync(path.join('public',profile.brandLocalPath)) || profile.brandAssetStatus==='pending_official_logo'){
     const matches=page.locator('header img,nav img,[class*="header"] img,[id*="header"] img');
     const count=Math.min(await matches.count(),18);
     for(let i=0;i<count;i++){
      const mark=matches.nth(i);
      try{
       if(!await mark.isVisible())continue;
       const alt=(await mark.getAttribute('alt'))||'';
       const cls=(await mark.getAttribute('class'))||'';
       const id=(await mark.getAttribute('id'))||'';
       const src=(await mark.getAttribute('src'))||'';
       const cue=alt+' '+cls+' '+id+' '+src;
       if(!/logo|品牌标识|企业标志|公司标识/i.test(cue))continue;
       if(/partner|sponsor|accessibility|certification|认证|无障碍|公众号|微信|二维码|logo-list/i.test(cue))continue;
       const bounds=await mark.boundingBox();
       if(!bounds||bounds.width<50||bounds.height<18||bounds.width>460||bounds.height>160)continue;
       const bytes=await mark.screenshot({type:'png',timeout:3000,animations:'disabled'});
       const normalized=await sharp(bytes).resize({width:500,withoutEnlargement:true}).png({compressionLevel:9}).toBuffer();
       if(normalized.length<750||normalized.length>350000)continue;
       const filename='domestic-media/company200-brand-'+shortHash(name)+'.png';
       writeFileSync(path.join('public',filename),normalized);
       profile.brandLocalPath=filename;
       profile.brandImageSource=final.href;
       profile.brandImage='';
       profile.brandAssetStatus='official_website_logo_candidate';
       profile.brandIdentityEvidence='Captured from site header on the matched company site; not independently visually identity verified';
       record.brand={state:'candidate',path:filename,source:final.href,classification:'first_party_header_logo_candidate_unreviewed'};
       stats.logoCandidates++;
       break;
      }catch{ /* One unusable logo candidate must not block the page. */ }
     }
    }
    manifest.companies[name]=record;
    stats.screenshots++;
    stats.saved.push({name,path:rel,source:final.href,title:title.slice(0,100)});
   }catch(e){stats.failed.push({name,error:String(e.message||e).slice(0,130)})}
   finally{await page.close().catch(()=>{})}
  }
 }));
}finally{await browser.close()}
// A metadata reference without an actual committed binary must NEVER appear ready.
for(const name of group){
 const profile=profiles[name],record=manifest.companies[name];
 if(!record)continue;
 if(record.brand?.state==='candidate'&&record.brand.path?.startsWith('domestic-media/company200-brand-')&&
    !existsSync(path.join('public',record.brand.path))){
    record.brand={state:'missing',classification:'binary_missing_recheck_required'};
    if(profile.brandLocalPath?.startsWith('domestic-media/company200-brand-'))delete profile.brandLocalPath;
    profile.brandAssetStatus='pending_official_logo';
    delete profile.brandIdentityEvidence;
 }
 for(const photo of record.photos||[]){
  if(photo?.state==='ready'&&photo.path?.startsWith('domestic-media/company200-site-')&&
     !existsSync(path.join('public',photo.path)))photo.state='binary_missing_recheck_required';
 }
}
manifest.generatedAt=new Date().toISOString();
writeFileSync(root+'domesticMedia200Bundle.json',JSON.stringify(manifest,null,2)+'\n');
writeFileSync(root+'domesticCompanyExpansion200Profiles.json',JSON.stringify(profiles,null,2)+'\n');
writeFileSync('preview-reports/company200-screenshot-capture.json',JSON.stringify({...stats,date:new Date().toISOString()},null,2)+'\n');
console.log('HHBA_COMPANY100_SCREENSHOT_IMPORT',JSON.stringify({checked:stats.checked,success:stats.screenshots,logoCandidates:stats.logoCandidates,skipped:stats.skippedExisting,failed:stats.failed.length,sampleErrors:stats.failed.slice(0,12)}));
