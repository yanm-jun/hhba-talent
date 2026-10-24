// Deliberately small, auditable list of identified real company scene images.
// No automatic stock-photo discovery, no parent/subsidiary photos, no fabricated offices.
// Source and license/author retained for each image. The original URL must be allowed.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root='src/data/';
const profiles=JSON.parse(readFileSync(root+'domesticCareerProfiles.json','utf8'));
const manifest=JSON.parse(readFileSync(root+'domesticMediaBundle.json','utf8'));
const approved=[
  {
   name:'小米集团',
   url:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Xiaomi_Science_and_Technology_Park_%2820220414090237%29.jpg/960px-Xiaomi_Science_and_Technology_Park_%2820220414090237%29.jpg',
   host:'upload.wikimedia.org',source:'https://commons.wikimedia.org/wiki/File:Xiaomi_Science_and_Technology_Park_(20220414090237).jpg',
   label:'小米科技园北京总部大楼实景（摄影 N509FZ，修图 Jacek Halicki，CC BY-SA 4.0）',
   kind:'headquarters',attribution:'N509FZ; Jacek Halicki (retouch)',license:'CC BY-SA 4.0',
   licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',changes:'resized and transcoded to WebP'
  },
  {
   name:'长城汽车',
   url:'https://res.gwm.com.cn/2025/01/01/1846004_115_11_29_800_450.jpg',
   host:'res.gwm.com.cn',source:'https://www.gwm.com.cn/news/3403600.html',
   label:'长城汽车官网2025年报道中的企业园区建筑照片',
   kind:'office',attribution:'长城汽车官方网站',license:'first-party-editorial-image_rights_unverified',
   changes:'resized and transcoded to WebP'
  },
  {
   name:'三一重工',
   url:'https://cos-www.sanygroup.com/2022/10/13/ic2f5zsydoa8gu7l.jpg',
   host:'cos-www.sanygroup.com',source:'https://www.sanygroup.com/news/11374.html',
   label:'三一集团官网发布的“三一重工”18号灯塔工厂外景',
   kind:'factory',attribution:'三一集团官网',license:'first-party-editorial-image_rights_unverified',
   changes:'resized and transcoded to WebP'
  },
  {
   name:'中国联通',
   url:'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/%E4%B8%AD%E5%9B%BD%E8%81%94%E9%80%9A%E6%B7%B1%E5%9C%B3%E5%88%86%E5%85%AC%E5%8F%B8.jpg/960px-%E4%B8%AD%E5%9B%BD%E8%81%94%E9%80%9A%E6%B7%B1%E5%9C%B3%E5%88%86%E5%85%AC%E5%8F%B8.jpg',
   host:'upload.wikimedia.org',source:'https://commons.wikimedia.org/wiki/File:%E4%B8%AD%E5%9B%BD%E8%81%94%E9%80%9A%E6%B7%B1%E5%9C%B3%E5%88%86%E5%85%AC%E5%8F%B8.jpg',
   label:'中国联通深圳分公司楼宇（摄影 Lhzss8，CC BY-SA 4.0；非集团总部）',
   kind:'office',attribution:'Lhzss8',license:'CC BY-SA 4.0',
   licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',changes:'resized and transcoded to WebP'
  },
  {
   name:'广汽集团',
   url:'https://oss.gz-cmc.com/pgcr/root/huacheng/upload/news/image/2026/02/01/1769944302959083605.jpg?x-oss-process=style%2Fcontent',
   host:'oss.gz-cmc.com',source:'https://huacheng.gz-cmc.com/pages/2026/02/01/29d5156007bc4881a29146865010f259.html',
   label:'广州媒体2026年报道中的广汽集团T2园区楼宇照片',
   kind:'office',attribution:'广州媒体华城',license:'news-photo-rights_not_independently_cleared',
   changes:'resized and transcoded to WebP'
  }
];
const {default:sharp}=await import('sharp');
const stats={attempted:approved.length,imported:[],skipped:[],failed:[]};
mkdirSync('public/domestic-media',{recursive:true});
mkdirSync('preview-reports',{recursive:true});
for(const spec of approved){
 const p=profiles[spec.name],m=manifest.companies[spec.name]||{brand:{state:'missing'},photos:[]};
 if(!p){stats.failed.push({name:spec.name,reason:'company_missing'});continue}
 const existing=(p.photos||[]).find(x=>x.sourceFile==='reviewed-external-scene');
 if(existing?.localPath&&existsSync(path.join('public',existing.localPath))){
   stats.skipped.push(spec.name);continue;
 }
 try{
  const u=new URL(spec.url);
  if(u.protocol!=='https:'||u.hostname!==spec.host)throw Error('not_allowlisted_first_party_or_licensed_media');
  const reply=await fetch(spec.url,{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'HHBA-CompanyDiscovery/1.0 (media source audit)'}});
  if(!reply.ok)throw Error('HTTP_'+reply.status);
  const final=new URL(reply.url);
  if(final.protocol!=='https:'||final.hostname!==spec.host)throw Error('unexpected_media_redirect');
  if(Number(reply.headers.get('content-length')||0)>8_000_000)throw Error('too_large');
  const bytes=Buffer.from(await reply.arrayBuffer());
  if(bytes.length<5000||bytes.length>8_000_000)throw Error('invalid_image_size');
  const input=sharp(bytes,{limitInputPixels:35_000_000});
  const meta=await input.metadata();
  if(!['jpeg','png','webp'].includes(meta.format)||meta.width<450||meta.height<220)throw Error('invalid_media_dimensions');
  const packed=await sharp(bytes).rotate().resize({width:1200,withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer();
  const id=createHash('sha256').update(spec.name).digest('hex').slice(0,20);
  const rel='domestic-media/company100-review-'+id+'.webp';
  writeFileSync(path.join('public',rel),packed);
  const photo={url:rel,localPath:rel,source:spec.source,kind:spec.kind,label:spec.label,
    verification:'reviewed_named_corporate_building_image_with_source',
    sourceFile:'reviewed-external-scene',attribution:spec.attribution,license:spec.license,
    licenseUrl:spec.licenseUrl||null,changes:spec.changes};
  p.photos ||= [];
  const idx=p.photos.findIndex(x=>x.sourceFile==='reviewed-external-scene');
  if(idx>=0)p.photos[idx]=photo;else p.photos.push(photo);
  m.photos ||= [];
  const slot=idx>=0?idx:p.photos.length-1;
  m.photos[slot]={state:'ready',path:rel,source:spec.source,classification:'source_backed_named_enterprise_scene',reviewDate:'2026-10-24'};
  manifest.companies[spec.name]=m;
  stats.imported.push({name:spec.name,path:rel,source:spec.source,bytes:packed.length});
 }catch(e){stats.failed.push({name:spec.name,reason:String(e.message||e).slice(0,130)})}
}
manifest.generatedAt=new Date().toISOString();
writeFileSync(root+'domesticCareerProfiles.json',JSON.stringify(profiles,null,2)+'\n');
writeFileSync(root+'domesticMediaBundle.json',JSON.stringify(manifest,null,2)+'\n');
writeFileSync('preview-reports/company100-reviewed-scenes.json',JSON.stringify(stats,null,2)+'\n');
console.log('HHBA_COMPANY100_REVIEWED_SCENES',JSON.stringify(stats));
