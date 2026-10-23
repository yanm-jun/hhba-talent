// Import ordinary company photos, logo screenshots and webpage captures.
// Usage: place images under media-inbox/<exact enterprise name>/logo.png,
// office.jpg, headquarters.png, factory-1.webp, screenshot-1.jpg, etc.
// A source URL is OPTIONAL. Misattributed artwork is never marked verified automatically.
import {existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, lstatSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const inbox='media-inbox';
const profilesPath='src/data/domesticCareerProfiles.json';
const bundlePath='src/data/domesticMediaBundle.json';
const roster=JSON.parse(readFileSync('src/data/domesticComplete50Target.json','utf8')).companyNames;
const known=new Set(roster);
const profiles=JSON.parse(readFileSync(profilesPath,'utf8'));
const bundle=JSON.parse(readFileSync(bundlePath,'utf8'));
const counts={companiesChecked:0,imagesImported:0,logos:0,photos:0,skipped:[],errors:[]};
const kindPattern=/^(logo|headquarters|office|factory|product|screenshot)(?:[-_][\p{L}\p{N}-]+)?\.(png|jpe?g|webp|gif)$/iu;
const labels={
 headquarters:'企业总部或大楼照片（用户提供）',
 office:'企业办公环境照片（用户提供）',
 factory:'企业工厂或生产环境照片（用户提供）',
 product:'企业产品展示照片（用户提供）',
 screenshot:'企业相关网页或场景截图（用户提供）'
};
const cap=1600;
const ensureHttps=(value)=>{try{const x=new URL(value);return x.protocol==='https:'?x.href:null}catch{return null}};
const sha=(content)=>createHash('sha256').update(content).digest('hex');
const targetDir='public/domestic-media';
mkdirSync(targetDir,{recursive:true});
mkdirSync('preview-reports',{recursive:true});

const importImage=async(original,name,kind)=>{
 const content=readFileSync(original);
 if(content.length>15_000_000||content.length<200)throw Error('Image outside 200B-15MB limits');
 const {default:sharp}=await import('sharp');
 const metadata=await sharp(content,{limitInputPixels:55_000_000,animated:false}).metadata();
 if(!['png','jpeg','webp','gif'].includes(metadata.format))throw Error('Unsupported image encoding');
 const normalized=kind==='logo'
   ?await sharp(content,{limitInputPixels:55_000_000,animated:false}).rotate()
      .resize({width:680,height:420,fit:'inside',withoutEnlargement:true})
      .png({compressionLevel:8}).toBuffer()
   :await sharp(content,{limitInputPixels:55_000_000,animated:false}).rotate()
      .resize({width:cap,height:1100,fit:'inside',withoutEnlargement:true})
      .webp({quality:82,effort:4}).toBuffer();
 const ext=kind==='logo'?'png':'webp';
 const id=sha(Buffer.from(name+'\0'+kind+'\0'+sha(content))).slice(0,24);
 const rel='domestic-media/user-'+id+'.'+ext;
 writeFileSync(path.join('public',rel),normalized);
 return {path:rel,bytes:normalized.length,originalBytes:content.length};
};

if(!existsSync(inbox)){
 console.log('HHBA_USER_MEDIA_INBOX_EMPTY: create apps/web/media-inbox/企业名称/logo.png or office.jpg');
}else{
 for(const dirent of readdirSync(inbox,{withFileTypes:true})){
  if(!dirent.isDirectory())continue;
  const name=dirent.name;
  if(!known.has(name)){counts.skipped.push({company:name,reason:'Unknown enterprise; exact 50-company directory required'});continue}
  counts.companiesChecked++;
  const folder=path.join(inbox,name);
  const profile=profiles[name],record=bundle.companies[name]||{brand:{state:'missing'},photos:[]};
  record.photos ||= [];
  let metadata={};
  const metaPath=path.join(folder,'sources.json');
  if(existsSync(metaPath)){try{metadata=JSON.parse(readFileSync(metaPath,'utf8'))}catch{counts.errors.push({company:name,reason:'Invalid sources.json'})}}
  const confirmed=metadata.confirmedCompany===name;
  const candidates=readdirSync(folder,{withFileTypes:true}).filter(x=>x.isFile()&&kindPattern.test(x.name)).slice(0,13);
  for(const file of candidates){
   const match=file.name.match(kindPattern);
   const kind=match?.[1]?.toLowerCase();
   if(!kind)continue;
   if(!profile){counts.errors.push({company:name,file:file.name,reason:'Profile missing'});continue}
   const filename=path.join(folder,file.name);
   if(lstatSync(filename).isSymbolicLink()){counts.skipped.push({company:name,file:file.name,reason:'Symbolic links disallowed'});continue}
   try{
    const image=await importImage(filename,name,kind);
    const evidence=metadata.files?.[file.name]||{};
    const source=ensureHttps(evidence.source)||'user_submission';
    if(kind==='logo'){
     profile.brandLocalPath=image.path;
     profile.brandImage='';
     profile.brandImageSource=source==='user_submission'?'':source;
     profile.brandAssetStatus=confirmed?'user_provided_logo_confirmed':'user_provided_logo_pending_identity';
     profile.brandReviewNote=confirmed?'使用者已按企业名称确认Logo对应关系':'已导入用户提供的Logo或截图，品牌归属尚需确认';
     if(confirmed){
      profile.brandIdentityEvidence='User-submitted image associated with exact named company and confirmed in sources.json';
      profile.brandVerifiedAt=new Date().toISOString().slice(0,10);
     }else{
      delete profile.brandIdentityEvidence;
      delete profile.brandVerifiedAt;
     }
     record.brand={state:'ready',path:image.path,source:'user_submission',
       classification:confirmed?'user_confirmed_company_logo':'user_submitted_logo_pending_identity'};
     counts.logos++;
    }else{
     const photo={url:image.path,localPath:image.path,source,kind,
       label:typeof evidence.label==='string'&&evidence.label.trim()?evidence.label.slice(0,120):labels[kind],
       verification:confirmed?'user_supplied_exact_company_confirmed':'user_supplied_company_image_pending_identity',
       sourceFile:file.name};
     const idx=(profile.photos||[]).findIndex(p=>p.sourceFile===file.name);
     profile.photos ||= [];
     if(idx>=0){profile.photos[idx]=photo;record.photos[idx]={state:'ready',path:image.path,source:photo.url,
       classification:'user_supplied_company_image'};}
     else{profile.photos.push(photo);record.photos[profile.photos.length-1]={state:'ready',path:image.path,source:photo.url,
       classification:'user_supplied_company_image'};}
     counts.photos++;
    }
    counts.imagesImported++;
   }catch(error){counts.errors.push({company:name,file:file.name,reason:String(error?.message||error).slice(0,160)})}
  }
  bundle.companies[name]=record;
 }
 bundle.generatedAt=new Date().toISOString();
 bundle.version=Math.max(1,bundle.version||1);
 writeFileSync(profilesPath,JSON.stringify(profiles,null,2)+'\n');
 writeFileSync(bundlePath,JSON.stringify(bundle,null,2)+'\n');
}
writeFileSync('preview-reports/user-media-import.json',JSON.stringify({date:new Date().toISOString(),...counts},null,2)+'\n');
console.log('HHBA_USER_MEDIA_IMPORT',JSON.stringify(counts));
