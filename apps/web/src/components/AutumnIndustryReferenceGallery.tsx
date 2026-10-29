import {useEffect,useState} from 'react';
import {ExternalLink,ImageOff,ShieldCheck} from 'lucide-react';
import '../styles/domestic-autumn-market.css';

type ReviewedPhoto={
 id:string; file:string;imageType:string;label:string;alt:string;
 companyId:string;companyName:string;sourceUrl:string;license:string;licenseUrl:string;
 author:string;credit:string;changes:string;
};
type Manifest={entries:Record<string,ReviewedPhoto[]>};
type ResearchManifest={entries:Record<string,ReviewedPhoto[]>};


let manifestPromise:Promise<Manifest|null>|null=null;
function loadManifest(){
 if(!manifestPromise)manifestPromise=fetch(import.meta.env.BASE_URL+'data/domestic-autumn-industry-photos.json')
  .then(r=>r.ok?r.json():null).then(d=>d&&typeof d==='object'&&d.entries?d as Manifest:null).catch(()=>null);
 return manifestPromise;
}
let researchPromise:Promise<ResearchManifest|null>|null=null;
function loadResearch(){
 if(!researchPromise)researchPromise=fetch(import.meta.env.BASE_URL+'data/domestic-autumn-photo-research.json')
  .then(r=>r.ok?r.json():null).then(d=>d&&typeof d==='object'&&d.entries?d as ResearchManifest:null).catch(()=>null);
 return researchPromise;
}
function checkedResearch(p:ReviewedPhoto,id:string,name:string){
 return p.companyId===id&&p.companyName===name&&
  p.imageType==='licensed_industry_reference_not_actual_employer'&&
  (p as ReviewedPhoto & {reviewStatus?:string}).reviewStatus==='research_unreviewed_not_employer_photo'&&
   new RegExp('^images/autumn-photo-research/'+id+'-[0-9]{2}\\.jpg$').test(p.file)&&
   p.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:');
}
function checkedImage(photo:ReviewedPhoto,companyId:string,companyName:string){
 const expected=new RegExp('^images/autumn-industry-references/'+companyId+'-[0-9]{2}\\.jpg$');
 return photo.imageType==='licensed_industry_reference_not_actual_employer'&&
  photo.companyId===companyId&&photo.companyName===companyName&&expected.test(photo.file)&&
  photo.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:')&&
  photo.licenseUrl.startsWith('https://creativecommons.org/');
}

/** Displays only manually scene-reviewed stock photographs and their own license attribution.
 * No image is implied to be the employer's actual premises or worksite.
 */
export function AutumnIndustryReferenceGallery({companyId,companyName}:{companyId:string;companyName:string}){
 const [photos,setPhotos]=useState<ReviewedPhoto[]|null>(null);
 const [research,setResearch]=useState<ReviewedPhoto[]>([]);
 useEffect(()=>{
  let active=true;setPhotos(null);
  loadManifest().then(m=>{if(active)setPhotos((m?.entries?.[companyId]||[]).filter(p=>checkedImage(p,companyId,companyName)))});
  loadResearch().then(m=>{if(active)setResearch((m?.entries?.[companyId]||[]).filter(p=>checkedResearch(p,companyId,companyName)))});
  return ()=>{active=false};
 },[companyId,companyName]);
 return <section className="hhba-autumn-industry-gallery" aria-label="企业相关行业场景参考照片">
  <div className="hhba-autumn-photo-heading">
   <h3>行业场景参考照片</h3>
   <span><ShieldCheck size={14}/> 非该企业真实办公环境</span>
  </div>
  <p className="hhba-autumn-profile-note">以下仅用于了解相关行业的典型环境。照片来自公开授权摄影图库，不是 {companyName} 的真实办公楼、团队、工厂、产品或招聘现场，也不是 AI 生成的照片。图片归属与来源逐张标注。</p>
  {photos===null?<p className="hhba-autumn-profile-note">正在读取已审核的照片索引…</p>:
   photos.length===0?<p className="hhba-autumn-no-qualified-photo"><ImageOff size={21}/> 该企业暂无通过场景匹配审核的参考照片。不会使用不相关的照片凑数。</p>:
   <div className="hhba-autumn-local-photo-grid hhba-autumn-references">{photos.map(p=>
    <figure key={p.id}>
     <div className="hhba-autumn-ref-img"><img src={import.meta.env.BASE_URL+p.file} loading="lazy" alt={p.alt}/><span>行业示意 · 非企业实景</span></div>
     <figcaption>
      <strong>独立照片 · 图库参考</strong>
      <small>摄影／来源：{p.author||'见来源页面'} · {p.license} · 已裁切</small>
      <span className="hhba-autumn-ref-links"><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" data-hhba-non-recruitment-link="true">原图及署名 <ExternalLink size={12}/></a><a href={p.licenseUrl} target="_blank" rel="noopener noreferrer" data-hhba-non-recruitment-link="true">许可条款 <ExternalLink size={12}/></a></span>
     </figcaption>
    </figure>
   )}</div>}
 </section>;
