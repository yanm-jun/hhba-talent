import {Link} from '../router';
import mediaA from '../data/domesticMediaBundle.json';
import mediaB from '../data/domesticMedia200Bundle.json';
import generatedScenes from '../data/domesticAutumnAiScenes.json';

// A true enterprise photograph has priority. Generative AI scenes are separately
// labeled conceptual material and must never be described as the employer's real office.
const mediaIndex={...mediaA.companies,...mediaB.companies} as Record<string,{
 photos?:Array<{state:string;path?:string;classification?:string;source?:string}>
}>;
type AiScene={id:string;path:string;kind:string;status:string;sourceLabel:string;alt:string};
const aiIndex=generatedScenes.entries as Record<string,AiScene[]>;
const scenePath=/^domestic-media\/[a-z0-9-]+\.(?:webp|png|jpg|jpeg)$/i;
const aiPath=/^images\/autumn-ai-scenes\/(cn-autumn-[0-9]{3})-[0-9]{2}\.(?:webp|avif)$/;

export function AutumnCompanyCover({name,id,kind='card'}:{name:string;id:string;kind?:'card'|'directory'}){
 const real=mediaIndex[name]?.photos?.find(photo=>
  photo.state==='ready'&&photo.classification==='source_backed_named_enterprise_scene'&&
  !!photo.source&&/^https:\/\//.test(photo.source)&&scenePath.test(photo.path||'')
 );
 const ai=aiIndex[id]?.find(item=>
  item.status==='published_preview'&&item.kind==='ai_generated_concept_scene'&&
  aiPath.test(item.path)&&item.path.startsWith('images/autumn-ai-scenes/'+id+'-')
 );
 if(!real?.path&&!ai)return null;
 const imagePath=real?.path||ai!.path;
 const illustrated=!real?.path;
 const label=illustrated?'AI 场景示意 · 非企业实景':'已核验企业实景';
 return <Link to={'/companies/autumn/'+id} className={kind==='directory'?'hhba-autumn-directory-visual':'hhba-autumn-job-cover-link'}
  title={'查看'+name+'的HHBA企业档案'}>
   <span className={'hhba-autumn-cover-frame hhba-autumn-cover-'+kind+(illustrated?' hhba-autumn-cover-ai':' hhba-autumn-cover-real')}>
    <img src={import.meta.env.BASE_URL+imagePath} loading="lazy"
      alt={illustrated?ai!.alt:name+'有来源的真实企业场景照片'}/>
    <small className="hhba-autumn-cover-provenance">{label}</small>
   </span>
 </Link>;
}
