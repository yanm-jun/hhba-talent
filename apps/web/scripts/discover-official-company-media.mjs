// Source-tracked extraction of explicitly captioned employer imagery from official webpages.
// This is NOT an identity-verification tool and never marks a favicon as a formal logo.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const profiles=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
const sources=[
 {name:"比亚迪",page:"https://www.bydglobal.com/cn/about.html",host:["www.bydglobal.com","bydglobal.com"],rules:[{match:/乘用车品牌|新能源汽车产品|多元产业/i,kind:"product",label:"比亚迪官网汽车品牌及产品展示"}]},
 {name:"雷赛智能",page:"https://www.leisai.com/groupIntroduction.html",host:["www.leisai.com","leisai.com"],rules:[{match:/公司总部|总部大楼|生产基地|园区实景|工业厂房|办公环境/i,kind:"office",label:"雷赛智能官网展示的总部及办公环境"},{match:/伺服系统|PLC产品|运动控制器|工业机器人/i,kind:"product",label:"雷赛智能官网运动控制产品展示"}]},
 {name:"德赛西威",page:"https://www.desaysv.com/about.html",host:["www.desaysv.com","desaysv.com"],rules:[{match:/惠南工业园|智能工厂|生产基地|园区实景/i,kind:"factory",label:"德赛西威官网产业园及工厂展示"},{match:/智能座舱|驾驶域控制器|产品实景/i,kind:"product",label:"德赛西威官网汽车电子产品"}]},
 {name:"隆基绿能",page:"https://www.longi.com/cn/about-longi/",host:["www.longi.com","longi.com"],rules:[{match:/光伏组件|硅片制造|光伏工厂|隆基基地/i,kind:"product",label:"隆基绿能官网光伏产品与制造场景"}]},
 {name:"兆易创新",page:"https://www.gigadevice.com.cn/about/career",host:["www.gigadevice.com.cn","gigadevice.com.cn"],rules:[{match:/办公环境|办公室|研发中心/i,kind:"office",label:"兆易创新官网办公环境"}]},
 {name:"宁德时代",page:"https://www.catl.com/about/profile/",host:["www.catl.com","catl.com"],rules:[{match:/宁德总部|总部大楼|宁德基地|电池工厂/i,kind:"headquarters",label:"宁德时代官网总部及生产基地"},{match:/动力电池产品|储能系统|骁遥电池|神行电池/i,kind:"product",label:"宁德时代官网电池产品展示"}]},
 {name:"海尔智家",page:"https://hd.maker.haier.net/client/home/abouthaier.html",host:["hd.maker.haier.net","maker.haier.net"],rules:[{match:/海尔智家总部|办公环境|海尔研发中心/i,kind:"office",label:"海尔智家官网办公和研发环境"},{match:/海尔智慧家庭|智能家电|三翼鸟智慧家庭/i,kind:"product",label:"海尔智家官网智慧家庭产品展示"}]},
 {name:"英威腾",page:"https://www.invt.com.cn/careers",host:["www.invt.com.cn","invt.com.cn"],rules:[{match:/办公环境|生产基地|工厂展示|研发中心/i,kind:"office",label:"英威腾官方办公与研发场景"}]},
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

// Extend coverage using only the reviewed employer's first-party product/about pages.
// Never label an uncaptioned or third-party image as its headquarters. A generic
// decorative banner, logo, partner thumbnail or profile portrait is not a scene.
const knownSources=new Set(sources.map(x=>x.name));
const forbiddenHost=/sse\.com\.cn|cninfo\.com\.cn|zhiye\.com|hotjob\.cn|51job\.com|zhaopin\.com|gov\.cn|edu\.cn/;
const sceneDescriptors=[
 {regex:/(?:总部大楼|总部园区|企业园区|办公环境|办公楼|研发中心|研发大楼|办公园区|公司总部|研发总部|办公总部)/,kind:'office',label:'企业官网公开的总部、研发或办公环境'},
 {regex:/(?:制造基地|生产基地|生产车间|制造车间|智能工厂|数字化工厂|工业厂房|生产厂房|智能制造基地|制造园区)/,kind:'factory',label:'企业官网公开的生产或制造场景'},
 {regex:/(?:主营产品|产品展示|主要产品|产品中心|业务产品|产品实景|技术产品|产品应用|系统解决方案)/,kind:'product',label:'企业官网公开的业务及产品展示'}
];
for(const [name,p] of Object.entries(profiles)){
 if(knownSources.has(name))continue;
 const urls=[p.productSource,p.officialSource].filter(Boolean);
 for(const uri of [...new Set(urls)]){
  let link;try{link=new URL(uri)}catch{continue}
  if(link.protocol!=='https:'||forbiddenHost.test(link.hostname))continue;
  const host=link.hostname.replace(/^www\./,'');
  sources.push({name,page:link.href,host:[host,'www.'+host,link.hostname],
   rules:sceneDescriptors.map(x=>({match:x.regex,kind:x.kind,label:x.label}))});
  break; // One source per employer; avoid overwriting its published evidence.
 }
}

function entities(s=''){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/gi,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')}
function attr(tag,key){const m=tag.match(new RegExp('(?:^|\\s)'+key+'\\s*=\\s*(?:"([^"]*)"|([^\\s>]+))','i'));return entities((m?.[1]||m?.[2]||'').trim())}
function figureCaption(html,position){
 const start=html.lastIndexOf('<figure',position);
 const priorEnd=html.lastIndexOf('</figure>',position);
 if(start<0||start<priorEnd||position-start>12000)return '';
 const end=html.indexOf('</figure>',position);
 if(end<0||end-position>12000)return '';
 const figure=html.slice(start,end);
 if((figure.match(/<img\b/gi)||[]).length!==1)return '';
 const matched=figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
 if(!matched)return '';
 return entities(matched[1].replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ')).trim().slice(0,150);
}
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
let nextSource=0;
await Promise.all(Array.from({length:Math.min(5,sources.length)},async()=>{
 while(nextSource<sources.length){
 const source=sources[nextSource++];
 const entry={sourcePage:source.page,candidates:[],published:[],status:'pending'};
 result.entries[source.name]=entry;
 if(!profiles[source.name]){entry.status='no_profile';continue}
 try{
  const html=await (await get(source.page)).text();
  const candidates=[];
  for(const m of html.matchAll(/<img\b[^>]*>/gi)){
   const tag=m[0];
   const alt=attr(tag,'alt')||attr(tag,'title')||attr(tag,'data-caption')||figureCaption(html,m.index);
   const rawLabel=attr(tag,'data-original')||attr(tag,'data-src')||attr(tag,'src');
   let basename='';try{basename=decodeURIComponent(new URL(rawLabel,source.page).pathname.split('/').at(-1)||'')}catch{}
   // Exact descriptive captions are required for generic discovery; opaque filenames alone
   // are insufficient proof of an employer photograph or product scene.
   const genericDiscovery=!knownSources.has(source.name);
   if(genericDiscovery&&(!alt||alt.trim().length<4||/logo|icon|banner|二维码|广告|奖章|伙伴|客户|肖像|团队合影/i.test(alt)))continue;
   const rule=source.rules.find(r=>r.match.test(alt)||(!genericDiscovery&&r.match.test(basename)));
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
}));
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
