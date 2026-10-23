// Downloads only readable, recognizable images for the static preview.
// Never synthesizes a logo or treats a website favicon as a verified brand mark.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const profiles=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
const targetNames=new Set(JSON.parse(readFileSync('src/data/domesticComplete50Target.json','utf8')).companyNames);
let older={companies:{}};
try{older=JSON.parse(readFileSync('src/data/domesticMediaBundle.json','utf8'))}catch{}
function previousMedia(name,kind,idx,url){
 const item=kind==='brand'?older.companies?.[name]?.brand:older.companies?.[name]?.photos?.[idx];
 if(item?.state!=='ready'||item.source!==url)return null;
 if(!/^domestic-media\/[a-zA-Z0-9._-]+\.(?:png|jpg|webp|gif|ico)$/.test(item.path||''))return null;
 return existsSync('public/'+item.path)?item:null;
}

const directory='public/domestic-media';
mkdirSync(directory,{recursive:true});
const manifest={version:1,generatedAt:new Date().toISOString(),companies:{}};
const stats={employers:targetNames.size,brandSucceeded:0,brandFailed:0,photoSucceeded:0,photoFailed:0,cacheReused:0,files:0,bytes:0};
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
  let packed=bytes, finalExt=ext;
  // Preserve exact-brand logo pixels; reduce large first-party scene photographs
  // to web-sized WebP so the verified static preview can be versioned in Git.
  if(key.includes('-photo-')&&['png','jpg','webp'].includes(ext)){
   try{
    const {default:sharp}=await import('sharp');
    packed=await sharp(bytes,{limitInputPixels:35_000_000}).rotate()
      .resize({width:1200,withoutEnlargement:true})
      .webp({quality:78,effort:4}).toBuffer();
    finalExt='webp';
   }catch{ /* Original magic-header-checked image stays available. */ }
  }
  if(packed.length>maxBytes)return {state:'too_large_after_pack'};
  const file=key+'.'+finalExt;
  writeFileSync(join(directory,file),packed);
  stats.files++;stats.bytes+=packed.length;
  return {state:'ready',path:'domestic-media/'+file,bytes:packed.length,source:url};
 }catch(e){return {state:e?.name==='TimeoutError'?'timeout':'blocked_or_network'};}
}
const jobs=[];
for(const [name,p] of Object.entries(profiles)){
 if(!targetNames.has(name))continue; // This job is scoped to the first fifty fully audited entities.
 const key=Buffer.from(name).toString('hex').slice(0,175);
 manifest.companies[name]={brand:{state:'missing'},photos:[]};
 if(p.brandLocalPath&&/^domestic-media\/[a-zA-Z0-9._-]+\.(?:png|jpg|webp|gif)$/.test(p.brandLocalPath)&&existsSync('public/'+p.brandLocalPath)){
  manifest.companies[name].brand={state:'ready',path:p.brandLocalPath,source:p.brandImage,
   classification:p.brandAssetStatus==='official_logo_visually_verified'?'logo_identity_checked':'official_site_brand_candidate_not_visually_verified'};
  stats.brandSucceeded++;
 }else if(p.brandImage){
  const cached=previousMedia(name,'brand',0,p.brandImage);
  if(cached){manifest.companies[name].brand=cached;stats.brandSucceeded++;stats.cacheReused++;}
  else jobs.push({name,kind:'brand',idx:0,url:p.brandImage,key:key+'-brand'});
 }
 (p.photos||[]).forEach((photo,idx)=>{
  if(!photo.source?.startsWith('https://')||!photo.label||!['headquarters','office','factory','product'].includes(photo.kind)){
   manifest.companies[name].photos[idx]={state:'pending_photo_identity_or_source'};
   return;
  }
  if(photo.localPath&&/^domestic-media\/[a-zA-Z0-9._-]+\.(?:png|jpg|webp|gif)$/.test(photo.localPath)&&existsSync('public/'+photo.localPath)){
   manifest.companies[name].photos[idx]={state:'ready',path:photo.localPath,source:photo.url,
    sourcePage:photo.source,classification:'official_publisher_caption_not_independently_visual_verified'};
   stats.photoSucceeded++;
  }else{
   const cached=previousMedia(name,'photo',idx,photo.url);
   if(cached){manifest.companies[name].photos[idx]=cached;stats.photoSucceeded++;stats.cacheReused++;}
   else jobs.push({name,kind:'photo',idx,url:photo.url,key:key+'-photo-'+idx});
  }
 });
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
      'logo_identity_checked':profiles[j.name].brandAssetStatus==='official_website_logo_candidate'?'official_site_brand_candidate_not_visually_verified':'site_icon_or_brand_candidate_not_visually_verified'};
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
const rows=Object.entries(manifest.companies).map(([name,m])=>({
 name,localBrandCandidate:m.brand?.state==='ready',
 brandClass:m.brand?.classification||'missing',
 readyPhotos:(m.photos||[]).filter(photo=>photo?.state==='ready').length,
 declaredPhotos:profiles[name].photos?.length||0,
 brandedLogoVerified:profiles[name].brandAssetStatus==='official_logo_visually_verified'&&m.brand?.state==='ready'
}));
writeFileSync('preview-reports/media-coverage-by-company.json',JSON.stringify({generatedAt:manifest.generatedAt,rows},null,2));
writeFileSync('preview-reports/media-coverage-by-company.md',[
 '# HHBA 首批50家企业媒体真实验收',
 '',
 '打包成功≠品牌身份确认；未经视觉核对的 favicon 不是正式 Logo。未验证为可展示的照片不应计入。',
 '',
 '| 企业 | 本地品牌候选图 | 正式Logo已人工核对 | 本地有效照片 / 已登记 |',
 '|---|---|---|---|',
 ...rows.map(x=>`| ${x.name} | ${x.localBrandCandidate?'有':'无'} | ${x.brandedLogoVerified?'是':'否'} | ${x.readyPhotos}/${x.declaredPhotos} |`)
].join('\n')+'\n');
console.log('HHBA_MEDIA_BUNDLE',JSON.stringify(stats));
console.log('HHBA_MEDIA_BUNDLE_FAILED',JSON.stringify(Object.entries(manifest.companies).filter(([_,v])=>v.brand.state!=='ready').map(([name,v])=>({name,state:v.brand.state}))));
