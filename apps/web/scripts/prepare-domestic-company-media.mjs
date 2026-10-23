// Downloads only readable, recognizable images for the static preview.
// Never synthesizes a logo or treats a website favicon as a verified brand mark.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const profiles=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
const directory='public/domestic-media';
mkdirSync(directory,{recursive:true});
const manifest={version:1,generatedAt:new Date().toISOString(),companies:{}};
const stats={employers:Object.keys(profiles).length,brandSucceeded:0,brandFailed:0,photoSucceeded:0,photoFailed:0,files:0,bytes:0};
const extFor=(buffer)=>{
 if(buffer.length>=4&&buffer[0]===0x89&&buffer[1]===0x50&&buffer[2]===0x4e&&buffer[3]===0x47)return 'png';
 if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return 'jpg';
 if(buffer.length>=6&&buffer.subarray(0,3).toString()==='GIF')return 'gif';
 if(buffer.length>=12&&buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP')return 'webp';
 if(buffer.length>=4&&buffer[0]===0&&buffer[1]===0&&buffer[2]===1&&buffer[3]===0)return 'ico';
 return '';
};
async function download(url,key,maxBytes=2_800_000){
 try{
  const parsed=new URL(url);
  if(parsed.protocol!=='https:')return {state:'rejected_url'};
  const response=await fetch(url,{signal:AbortSignal.timeout(9000),redirect:'follow',
   headers:{'User-Agent':'Mozilla/5.0 (compatible; HHBA-company-media-check/1.0)','Accept':'image/avif,image/webp,image/png,image/jpeg,image/gif,image/x-icon,*/*;q=0.5'}});
  if(!response.ok){await response.body?.cancel();return {state:'http_'+response.status};}
  if(Number(response.headers.get('content-length')||0)>maxBytes){
   await response.body?.cancel();return {state:'too_large'};
  }
  const reader=response.body?.getReader();
  if(!reader)return {state:'empty'};
  const parts=[];let size=0;
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>maxBytes){await reader.cancel();return {state:'too_large'};}
   parts.push(Buffer.from(value));
  }
  const bytes=Buffer.concat(parts);const ext=extFor(bytes);
  if(!ext)return {state:'not_supported_image'};
  const file=key+'.'+ext;
  writeFileSync(join(directory,file),bytes);
  stats.files++;stats.bytes+=bytes.length;
  return {state:'ready',path:'domestic-media/'+file,bytes:bytes.length,source:url};
 }catch(e){return {state:e?.name==='TimeoutError'?'timeout':'blocked_or_network'};}
}
const jobs=[];
for(const [name,p] of Object.entries(profiles)){
 const key=Buffer.from(name).toString('hex').slice(0,175);
 manifest.companies[name]={brand:{state:'missing'},photos:[]};
 if(p.brandImage)jobs.push({name,kind:'brand',idx:0,url:p.brandImage,key:key+'-brand'});
 (p.photos||[]).forEach((photo,idx)=>jobs.push({name,kind:'photo',idx,url:photo.url,key:key+'-photo-'+idx}));
}
let cursor=0;
await Promise.all(Array.from({length:Math.min(7,jobs.length)},async()=>{
 while(cursor<jobs.length){
  const j=jobs[cursor++];
  const out=await download(j.url,j.key);
  const rec=manifest.companies[j.name];
  if(j.kind==='brand'){
   rec.brand={...out,
    classification:profiles[j.name].brandAssetStatus==='official_logo_visually_verified'?
      'logo_identity_checked':'site_icon_or_brand_candidate_not_visually_verified'};
   stats.brandSucceeded+=Number(out.state==='ready');
   stats.brandFailed+=Number(out.state!=='ready');
  }else{
   rec.photos[j.idx]={...out,sourcePage:profiles[j.name].photos?.[j.idx]?.source};
   stats.photoSucceeded+=Number(out.state==='ready');
   stats.photoFailed+=Number(out.state!=='ready');
  }
 }
}));
writeFileSync('src/data/domesticMediaBundle.json',JSON.stringify(manifest,null,2)+'\n');
mkdirSync('preview-reports',{recursive:true});
writeFileSync('preview-reports/media-bundle-status.json',JSON.stringify({stats,manifest},null,2));
console.log('HHBA_MEDIA_BUNDLE',JSON.stringify(stats));
console.log('HHBA_MEDIA_BUNDLE_FAILED',JSON.stringify(Object.entries(manifest.companies).filter(([_,v])=>v.brand.state!=='ready').map(([name,v])=>({name,state:v.brand.state}))));
