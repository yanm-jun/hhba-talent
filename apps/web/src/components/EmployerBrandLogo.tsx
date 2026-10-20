import { useState } from 'react';
import { Building2 } from 'lucide-react';
import type { LiveJob } from '../services/liveRecruitment';

type BrandKey='openai'|'anthropic'|'spacex';
export function verifiedBrandKey(job:Pick<LiveJob,'company'|'source'|'platform'>):BrandKey|null{
  // Never infer identity from substring-matched company names or fabricated logos.
  if(job.company==='OpenAI' && job.source==='openai' && job.platform==='ashby')return 'openai';
  if(job.company==='Anthropic' && job.source==='anthropic' && job.platform==='greenhouse')return 'anthropic';
  if(job.company==='SpaceX' && job.source==='spacex' && job.platform==='greenhouse')return 'spacex';
  return null;
}
export function EmployerBrandLogo({job}:{job:LiveJob}){
  const [broken,setBroken]=useState(false);
  const brand=verifiedBrandKey(job);
  const alt=brand==='anthropic'?'Claude 品牌标识（Anthropic）':
    brand==='openai'?'OpenAI 品牌标识':brand==='spacex'?'SpaceX 品牌标识':'';
  const cls=brand==='spacex'?'unified-brand-logo unified-brand-logo-wide':'unified-brand-logo';
  return <span className={cls} title={alt||'企业身份以官方招聘来源为准'}>
    {brand&&!broken?
      <img src={import.meta.env.BASE_URL+'brands/'+(brand==='anthropic'?'claude':brand)+'.svg'}
        alt={alt} loading="eager" decoding="async" onError={()=>setBroken(true)}/>:
      <Building2 size={18} aria-label="未获取企业品牌标识"/>}
  </span>;
}
