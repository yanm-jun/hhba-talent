import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const profiles=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
const targets=[];
for(const [name,p] of Object.entries(profiles)){
 if(p.brandImage)targets.push({name,type:'brand_candidate',url:p.brandImage,source:p.brandImageSource||''});
 for(const photo of p.photos||[])targets.push({name,type:'photo',url:photo.url,source:photo.source});
}
const byCompany=new Map();
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function validate(one){
 try{
  const response=await fetch(one.url,{
   signal:AbortSignal.timeout(8500),redirect:'follow',
   headers:{'User-Agent':'Mozilla/5.0 (compatible; HHBA-Preview-ImageAudit/1.0)','Accept':'image/avif,image/webp,image/*,*/*;q=0.8',Range:'bytes=0-65535'},
  });
  const contentType=response.headers.get('content-type')||'';
  await response.body?.cancel().catch(()=>{});
  return {...one,httpStatus:response.status,contentType,reachableImage:response.ok&&/image\/|application\/(octet-stream)/i.test(contentType),finalUrl:response.url};
 }catch(error){return {...one,httpStatus:null,contentType:'',reachableImage:false,reason:error instanceof Error?error.name:'unknown'}}
}
let cursor=0;
const outputs=[];
await Promise.all(Array.from({length:Math.min(7,targets.length)},async()=>{
 while(cursor<targets.length){
  const idx=cursor++;outputs[idx]=await validate(targets[idx]);
 }
}));
const success=outputs.filter(x=>x.reachableImage).length;
for(const o of outputs){
 const data=byCompany.get(o.name)||{logo:false,photoCount:0,bad:[]};
 if(o.type==='brand_candidate')data.logo=o.reachableImage;
 else if(o.reachableImage)data.photoCount++;
 if(!o.reachableImage)data.bad.push({type:o.type,status:o.httpStatus,reason:o.reason||o.contentType});
 byCompany.set(o.name,data);
}
mkdirSync('preview-reports',{recursive:true});
const summary={audited:outputs.length,reachableImages:success,failedOrBlockedImages:outputs.length-success,checkedCompanies:Object.keys(profiles).length,companyReachability:Object.fromEntries(byCompany),items:outputs};
writeFileSync('preview-reports/company-media-http-audit.json',JSON.stringify(summary,null,2));
console.log('HHBA_COMPANY_MEDIA_HTTP_AUDIT',JSON.stringify({audited:outputs.length,reachableImages:success,failedOrBlockedImages:outputs.length-success}));
console.log('HHBA_COMPANY_MEDIA_BAD_OR_BLOCKED',JSON.stringify(outputs.filter(x=>!x.reachableImage).map(x=>({name:x.name,type:x.type,status:x.httpStatus,reason:x.reason||x.contentType}))));
