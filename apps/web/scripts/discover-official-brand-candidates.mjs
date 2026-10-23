// Discover site-header logos from each exact company's own verified website.
// Source provenance is preserved; candidates are not claimed to be visually verified.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const profiles=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
const candidates=[];
const report={generatedAt:new Date().toISOString(),checked:0,replaced:[],preserved:[],failed:[]};
mkdirSync('public/domestic-media',{recursive:true});
mkdirSync('preview-reports',{recursive:true});
const htmlAttr=(tag,key)=>{
 const m=tag.match(new RegExp('(?:^|\\s)'+key+'\\s*=\\s*(?:"([^"]*)"|([^\\s>]+))','i'));
 return (m?.[1]||m?.[2]||'').replace(/&amp;/g,'&');
};
const svgToPng=async(source)=>{
 const markup=source.toString('utf8');
 if(!/<svg[\s>]/i.test(markup.slice(0,1000)))throw Error('invalid_svg');
 // Fail closed on XML entity expansion, script and remotely referenced content.
 if(/<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:xlink:)?href\s*=\s*["'](?:https?:|data:|javascript:|\/\/)/i.test(markup))throw Error('unsafe_svg');
 const {Resvg}=await import('@resvg/resvg-js');
 return Buffer.from(new Resvg(markup,{fitTo:{mode:'width',value:480}}).render().asPng());
};
const fileFormat=b=>{
 if(b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47)return 'png';
 if(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'jpg';
 if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return 'webp';
 if(b.subarray(0,3).toString()==='GIF')return 'gif';
 if(/<svg[\s>]/i.test(b.subarray(0,1200).toString('utf8')))return 'svg';
 return '';
};
const projects=Object.entries(profiles).filter(([name,p])=>p.brandAssetStatus!=='official_logo_visually_verified')
 .map(([name,p])=>{
  const url=p.website||p.productSource||p.officialSource;
  try{
   const u=new URL(url);
   if(u.protocol!=='https:'||/sse.com.cn|cninfo.com.cn|finance.sina.com.cn/.test(u.hostname))return null;
   return {name,url:u.origin+'/',host:u.hostname};
  }catch{return null}
 }).filter(Boolean);
let cursor=0;
await Promise.all(Array.from({length:5},async()=>{
 while(cursor<projects.length){
  const {name,url,host}=projects[cursor++];
  report.checked++;
  const p=profiles[name];
  try{
   const r=await fetch(url,{signal:AbortSignal.timeout(9500),headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}});
   if(!r.ok)throw Error('homepage http '+r.status);
   const html=(await r.text()).slice(0,180000);
   let options=[];
   for(const match of html.matchAll(/<img\b[^>]*>/gi)){
    const tag=match[0],raw=htmlAttr(tag,'data-original')||htmlAttr(tag,'data-src')||htmlAttr(tag,'data-lazy-src')||htmlAttr(tag,'src')||htmlAttr(tag,'srcset').split(',')[0]?.trim().split(/\s+/)[0];
    const alt=htmlAttr(tag,'alt'),cls=htmlAttr(tag,'class'),id=htmlAttr(tag,'id');
    if(!raw||raw.startsWith('data:')||raw.startsWith('blob:'))continue;
    let absolute;try{absolute=new URL(raw,url)}catch{continue}
    const hostname=absolute.hostname.toLowerCase();
    // Official site only (including subdomains). Third-party logos must be manually reviewed.
    if(absolute.protocol!=='https:'||!(hostname===host||hostname.endsWith('.'+host.replace(/^www\./,''))))continue;
    const filename=decodeURIComponent(absolute.pathname).toLowerCase();
    if(!/\.(png|jpg|jpeg|webp|gif)(?:$|\?)/.test(filename))continue;
    const logo=/logo|品牌标识|企业标识|公司标志/i;
    const isLogo=logo.test(cls+' '+id+' '+alt+' '+filename);
    if(!isLogo||/customer|client|partner|invest|supplier|footer|service|国家|政府/i.test(cls+' '+alt+' '+filename))continue;
    const score=(/logo/i.test(cls)?40:0)+(/logo/i.test(id)?35:0)+
      (/(?:\/|_|-)logo/i.test(filename)?35:0)+(/logo/i.test(alt)?30:0)+
      (match.index<16000?25:0)-(match.index>60000?20:0);
    options.push({url:absolute.href,alt,score});
   }
   options.sort((a,b)=>b.score-a.score);
   let saved=false;
   for(const entry of options.slice(0,3)){
    try{
     const ir=await fetch(entry.url,{signal:AbortSignal.timeout(6500),headers:{'User-Agent':'Mozilla/5.0','Accept':'image/*'}});
     if(!ir.ok)continue;
     const len=Number(ir.headers.get('content-length')||0);if(len>900000)continue;
     const original=Buffer.from(await ir.arrayBuffer());
     const detected=fileFormat(original);
     if(!detected||original.length<200||original.length>900000)continue;
     const buf=detected==='svg'?await svgToPng(original):original;
     const fmt=detected==='svg'?'png':detected;
     if(buf.length>900000)continue;
     const id=createHash('sha256').update(name).digest('hex').slice(0,15);
     const file='domestic-media/'+id+'-website-brand-candidate.'+fmt;
     writeFileSync('public/'+file,buf);
     p.brandImage=entry.url;
     p.brandImageSource=url;
     p.brandLocalPath=file;
     p.brandAssetStatus='official_website_logo_candidate';
     p.brandIdentityEvidence='Candidate found in official website HTML logo-marked image; human visual identity review pending';
     report.replaced.push({name,url:entry.url,sourcePage:url,localPath:file,alt:entry.alt,sourceScore:entry.score});
     saved=true;break;
    }catch{}
   }
   if(!saved)report.failed.push({name,reason:options.length?'logo_file_inaccessible':'no_official_logo_tag'});
  }catch(e){report.failed.push({name,reason:String(e).slice(0,110)})}
 }
}));
writeFileSync('src/data/domesticCareerProfiles.json',JSON.stringify(profiles,null,2)+'\n');
writeFileSync('preview-reports/official-header-logo-candidates.json',JSON.stringify(report,null,2));
console.log('HHBA_OFFICIAL_HEADER_LOGOS',JSON.stringify({checked:report.checked,candidateDownloaded:report.replaced.length,missing:report.failed.length,formalHumanVerified:Object.values(profiles).filter(p=>p.brandAssetStatus==='official_logo_visually_verified').length}));
