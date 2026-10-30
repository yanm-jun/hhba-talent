import {useEffect,useState} from 'react';
import {Building2} from 'lucide-react';
import {domesticBrandFor} from '../services/domesticCompanyBrand';
type Props={name:string;route?:string;size?:number;className?:string};
export function DomesticBrandMark({name,route,size=19,className=''}:Props){
 const asset=domesticBrandFor({name,route});
 const [broken,setBroken]=useState(false);
 useEffect(()=>setBroken(false),[asset?.path]);
 return <span className={className} title={asset?name+' · 已保存企业品牌素材（商标归属仍以品牌方为准）':name+' · 品牌 Logo 待核实'}>
  {asset&&!broken?<img src={import.meta.env.BASE_URL+asset.path} alt={name+'品牌标识'} loading="lazy" decoding="async" onError={()=>setBroken(true)}/>:
  <Building2 size={size} aria-label={name+' Logo 待核验'}/>}
 </span>;
}
