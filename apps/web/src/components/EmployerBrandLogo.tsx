import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import type { LiveJob } from '../services/liveRecruitment';
import { verifiedBrandForEmployer, verifiedBrandAssetUrl,
 type BrandIdentity } from '../services/verifiedBrandRegistry';

type BrandKey='openai'|'anthropic'|'spacex';
export function verifiedBrandKey(job:Pick<LiveJob,'company'|'source'|'platform'>):BrandKey|null{
  // Keep the three original hand-reviewed employer pages at their stable URLs.
  if(job.company==='OpenAI' && job.source==='openai' && job.platform==='ashby')return 'openai';
  if(job.company==='Anthropic' && job.source==='anthropic' && job.platform==='greenhouse')return 'anthropic';
  if(job.company==='SpaceX' && job.source==='spacex' && job.platform==='greenhouse')return 'spacex';
  return null;
}
type LogoProps={job?:LiveJob;identity?:BrandIdentity;variant?:'card'|'profile'};
export function EmployerBrandLogo({job,identity,variant='card'}:LogoProps){
  const target=identity||job;
  const asset=target?verifiedBrandForEmployer(target):null;
  const file=asset?.file||null;
  const [broken,setBroken]=useState(false);
  useEffect(()=>setBroken(false),[file]);
  const alt=asset?.company==='Anthropic'?'Claude 品牌标识（Anthropic）':
    asset?.company?asset.company+' 品牌标识':'';
  const url=target?verifiedBrandAssetUrl(target):null;
  const cls=variant==='profile'
    ?'company-profile-brand'+(asset?.wide?' company-profile-brand-wide':'')
    :'unified-brand-logo'+(asset?.wide?' unified-brand-logo-wide':'');
  if(job?.recordKind==='DOMESTIC_REBUILT'&&job.company==='华域视觉科技（上海）有限公司')
    return <span className={cls} title="华域视觉（旧版用户上传 Logo，身份待核验）">
      <img src={import.meta.env.BASE_URL+'domestic-media/user-f9727f3062cf91da52b3285c.png'} alt="华域视觉原有品牌素材，待最终核对" loading="eager" decoding="async"/>
    </span>;
  if(job?.recordKind==='DOMESTIC_REBUILT'&&job.company==='毕马威')
    return <span className={cls} title="毕马威"><img src={import.meta.env.BASE_URL+'images/autumn-real-logos/cn-autumn-001.svg'} alt="毕马威 KPMG Logo" loading="eager" decoding="async"/></span>;
  if(job?.recordKind==='DOMESTIC_REBUILT'&&job.company==='施耐德电气')
    return <span className={cls} title="施耐德电气"><img src={import.meta.env.BASE_URL+'images/autumn-real-logos/cn-autumn-002.svg'} alt="施耐德电气 Logo" loading="eager" decoding="async"/></span>;
  return <span className={cls} title={alt||'企业身份以官方招聘来源为准'}>
    {url&&!broken?
      <img src={url} alt={alt} loading="eager"
        decoding="async" onError={()=>setBroken(true)}/>:
      <Building2 size={variant==='profile'?28:18} aria-label="未获取已核实企业品牌标识"/>}
  </span>;
}
