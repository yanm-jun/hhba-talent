// Source-tracked extraction of explicitly captioned employer imagery from official webpages.
// This is NOT an identity-verification tool and never marks a favicon as a formal logo.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const profiles=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
const sources=[
 {name:'华域视觉科技（上海）有限公司',page:'https://www.hascovision.com/products-innovation/intelligent-manufacturing',host:['www.hascovision.com','hascovision.com'],
 rules:[{match:/^工厂(?:\.jpg)?$/i,kind:'factory',label:'华域视觉官网：嘉定数字化工厂'}]},
 {name:'京东方Ａ',page:'https://www.boe.com/Enterprise/SmartEnergyManagement',host:['www.boe.com','boe.com','boe-official01.oss-cn-beijing.aliyuncs.com'],
  rules:[
   {match:/^(?:园区场景)[-—·\s]*京东方集团/i,kind:'headquarters',label:'京东方官网：北京集团园区场景'},
   {match:/^(?:楼宇场景)[-—·\s]*BOE\s*核心能力大楼/i,kind:'office',label:'京东方官网：北京核心能力大楼'},
   {match:/^(?:楼宇场景)[-—·\s]*京东方北京创新中心/i,kind:'office',label:'京东方官网：北京创新中心'},
   {match:/^(?:工厂场景)[-—·\s]*京东方B(?:1|4|10)/i,kind:'factory',label:'京东方官网：生产工厂实景'}
  ]}
];
function entities(s=''){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/gi,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function attr(tag,key){const m=tag.match(new RegExp('(?:^|\\s)'+key+'\\s*=\\s*(?:"([^"]*)"|([^\\s>]+))','i'));return entities((m?.[1]||m?.[2]||'').trim())}
function extFor(buffer){
 if(buffer[0]===0x89&&buffer[1]===0x50&&buffer[2]===0x4e&&buffer[3]===0x47)return 'png';
 if(buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return 'jpg';
 if(buffer.subarray(0,6).toString()==='GIF89a'||buffer.subarray(0,6).toString()==='GIF87a')return 'gif';
 if(buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP')return 'webp';
 return '';
}
const result={generatedAt:new Date().toISOString(),sourceCount:sources.length,entries:{},warnings:[]};
mkdirSync('public/domestic-media', {recursive:true});
const deadline=(ms)=>AbortSignal.timeout(ms);
async function get(url,ms=11000){
 const res=await fetch(url,{signal:deadline(ms),headers:{'User-Agent':'Mozilla/5.0 (compatible; HHBA-photo-provenance/1.0)','Accept':'text/html,image/*,*/*;q=0.5'}});
 if(!res.ok)throw Error('HTTP '+res.status);
 return res;
}
for(const source of sources){
 const entry={sourcePage:source.page,candidates:[],published:[],status:'pending'};
 result.entries[source.name]=entry;
 if(!profiles[source.name]){entry.status='no_profile';continue}
 try{
  const html=await (await get(source.page)).text();
  const candidates=[];
  for(const tag of html.match(/<img\b[^>]*>/gi)||[]){
   const alt=attr(tag,'alt')||attr(tag,'title');
   const rawLabel=attr(tag,'data-original')||attr(tag,'data-src')||attr(tag,'src');
   let basename='';try{basename=decodeURIComponent(new URL(rawLabel,source.page).pathname.split('/').at(-1)||'')}catch{}
   const rule=source.rules.find(r=>r.match.test(alt)||r.match.test(basename));
   if(!rule)continue;
   const original=attr(tag,'data-original')||attr(tag,'data-src')||attr(tag,'src');
   if(!original||original.startsWith('data:'))continue;
   let url;
   try{url=new URL(original,source.page)}catch{continue}
   if(url.protocol!=='https:'||!source.host.includes(url.hostname))continue;
   candidates.push({alt,url:url.href,kind:rule.kind,label:rule.label});
  }
  const seen=new Set();
  for(const x of candidates.filter(c=>!seen.has(c.url)&&seen.add(c.url)).slice(0,8)){
   const record={...x,state:'pending',sourcePage:source.page};
   entry.candidates.push(record);
   try{
    const response=await get(x.url,8500);
    if(Number(response.headers.get('content-length')||0)>3000000)throw Error('too_large');
    const buf=Buffer.from(await response.arrayBuffer());
    const ext=extFor(buf);
    if(!ext||buf.length>3000000||buf.length<3000)throw Error('not_suitable_image');
    const hex=Buffer.from(source.name).toString('hex').slice(0,55);
    const file='domestic-media/'+hex+'-official-caption-'+entry.published.length+'.'+ext;
    writeFileSync('public/'+file,buf);
    record.state='ready';
    entry.published.push({kind:x.kind,label:x.label,sourcePage:source.page,originalUrl:x.url,path:file,
      evidence:'publisher_alt_on_official_page',identityVerifiedByHuman:false});
   }catch(e){record.state='failed';record.reason=String(e).slice(0,130)}
  }
  entry.status=entry.published.length?'official_page_caption_assets_found':'no_approved_download';
 }catch(e){entry.status='source_inaccessible';result.warnings.push(source.name+':'+String(e).slice(0,140))}
}
for(const [name,group] of Object.entries(result.entries)){
 const profile=profiles[name];if(!profile)continue;
 const existing=new Set((profile.photos||[]).map(p=>p.url));
 for(const image of group.published){
  if(existing.has(image.originalUrl))continue;
  profile.photos ||= [];
  profile.photos.push({url:image.originalUrl,label:image.label,
   kind:image.kind,source:image.sourcePage,localPath:image.path,
   verification:'official_page_caption_not_human_reviewed'});
  existing.add(image.originalUrl);
 }
}
writeFileSync('src/data/domesticCareerProfiles.json',JSON.stringify(profiles,null,2)+'\n');
writeFileSync('src/data/domesticOfficialSceneBundle.json',JSON.stringify(result,null,2)+'\n');
mkdirSync('preview-reports',{recursive:true});
writeFileSync('preview-reports/official-image-discovery.json',JSON.stringify(result,null,2));
console.log('HHBA_OFFICIAL_SCENE_DISCOVERY',JSON.stringify(Object.fromEntries(Object.entries(result.entries).map(([k,v])=>[k,{status:v.status,found:v.candidates.length,ready:v.published.length}]))));
