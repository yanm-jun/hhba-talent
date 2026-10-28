import mediaA from '../data/domesticMediaBundle.json';
import mediaB from '../data/domesticMedia200Bundle.json';

const mediaIndex={...mediaA.companies,...mediaB.companies} as Record<string,{
 photos?:Array<{state:string;path?:string;classification?:string;source?:string}>
}>;

export function AutumnCompanyCover({name,id,kind='card'}:{name:string;id:string;kind?:'card'|'directory'}){
 const local=mediaIndex[name]?.photos?.find(photo=>
  photo.state==='ready'&&photo.classification?.includes('website_screenshot')&&
  /^domestic-media\/[a-z0-9-]+\.(?:webp|png|jpg|jpeg)$/i.test(photo.path||'')
 );
 const isScreenshot=!!local;
 const path=local?.path||'images/autumn-cover/'+id+'.svg';
 return <span className={'hhba-autumn-cover-frame '+(isScreenshot?'hhba-autumn-cover-real ':'')+'hhba-autumn-cover-'+kind}>
  <img src={import.meta.env.BASE_URL+path} loading="lazy" alt={isScreenshot?name+'企业网站截屏，非办公环境实景':name+' HHBA原创企业主题插画（非企业实景）'}/>
  {isScreenshot&&<small className="hhba-autumn-cover-provenance">官网页面截图 · 非实景</small>}
 </span>;
}
