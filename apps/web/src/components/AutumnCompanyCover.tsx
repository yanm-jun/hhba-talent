import {Link} from '../router';
import mediaA from '../data/domesticMediaBundle.json';
import mediaB from '../data/domesticMedia200Bundle.json';

// The large slot is reserved for confirmed photographs of this exact employer.
// Website screenshots, stock photographs and generated scenes must not appear as
// genuine employer premises. If nothing is independently verified, omit the slot.
const mediaIndex={...mediaA.companies,...mediaB.companies} as Record<string,{
 photos?:Array<{state:string;path?:string;classification?:string;source?:string}>
}>;
const scenePath=/^domestic-media\/[a-z0-9-]+\.(?:webp|png|jpg|jpeg)$/i;

export function AutumnCompanyCover({name,id,kind='card'}:{name:string;id:string;kind?:'card'|'directory'}){
 const scene=mediaIndex[name]?.photos?.find(photo=>
  photo.state==='ready'&&photo.classification==='source_backed_named_enterprise_scene'&&
  !!photo.source&&/^https:\/\//.test(photo.source)&&scenePath.test(photo.path||'')
 );
 if(!scene?.path)return null;
 return <Link to={'/companies/autumn/'+id} className={kind==='directory'?'hhba-autumn-directory-visual':'hhba-autumn-job-cover-link'}
  title={'查看'+name+'的HHBA企业档案'}>
   <span className={'hhba-autumn-cover-frame hhba-autumn-cover-real hhba-autumn-cover-'+kind}>
    <img src={import.meta.env.BASE_URL+scene.path} loading="lazy" alt={name+'经来源核验的企业场景照片'}/>
    <small className="hhba-autumn-cover-provenance">有来源的企业场景照片</small>
   </span>
 </Link>;
}
