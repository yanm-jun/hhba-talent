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
  if(job?.recordKind==='DOMESTIC_REBUILT'&&job.company==='中国南方航空')
    return <span className={cls} title="中国南方航空（用户提供品牌素材）"><img src={import.meta.env.BASE_URL+'images/csair-user/csair-logo.webp'} alt="中国南方航空品牌图" loading="eager" decoding="async"/></span>;
  if(job?.recordKind==='DOMESTIC_REBUILT'&&job.company==='辉瑞')
    return <span className={cls} title="辉瑞 Pfizer"><img src={import.meta.env.BASE_URL+'images/pfizer-user/pfizer-logo.webp'} alt="辉瑞 Pfizer 用户提供的品牌 Logo" loading="eager" decoding="async"/></span>;
  if(job?.recordKind==='DOMESTIC_REBUILT'&&job.company==='中信证券')
    return <span className={cls} title="中信证券（已保存的旧版品牌图，待核验归属）">
      <img src={import.meta.env.BASE_URL+'domestic-media/user-ed43abe9b2aa6a7d0600525e.png'} alt="中信证券品牌图（来源归属待核验）" loading="eager" decoding="async"/>
    </span>;
  if(job?.recordKind==='DOMESTIC_REBUILT'&&job.company==='广发证券')
    return <span className={cls} title="广发证券（旧版品牌素材，身份待最终核验）">
      <img src={import.meta.env.BASE_URL+'domestic-media/user-bc5d9ca993044b7644390553.png'} alt="广发证券旧版 Logo 素材" loading="eager" decoding="async"/>
    </span>;
  if(job?.recordKind==='DOMESTIC_REBUILT'&&job.company==='华安证券')
    return <span className={cls} title="华安证券（旧版已存品牌素材，尚待归属核验）">
      <img src={import.meta.env.BASE_URL+'domestic-media/user-4e84106ce0d3db721fab644a.png'} alt="华安证券旧版品牌图" loading="eager" decoding="async"/>
    </span>;
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
