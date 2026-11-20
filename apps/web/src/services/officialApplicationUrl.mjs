/** A source-backed application link only. Never generate an employer URL from
 * a company name, never allow mass job boards or non-HTTPS destinations. */
const THIRD_PARTY=new Set([
 'zhipin.com','51job.com','zhaopin.com','liepin.com',
 'lagou.com','bosszhipin.com','kanzhun.com'
]);
export function officialApplicationUrl(job){
 if(!job||!['EMPLOYER_ATS','EMPLOYER_DOMAIN_CANDIDATE']
  .includes(job.recruitment_source_kind))return null;
 try{
  const url=new URL(job.official_url);
  if(url.protocol!=='https:'||url.username||url.password||
   url.port||url.hostname.length<4)return null;
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(THIRD_PARTY.size&&[...THIRD_PARTY].some(domain=>
   host===domain||host.endsWith('.'+domain)))return null;
  if(url.pathname==='/'&&!url.search)return null;
  return url.href;
 }catch{return null;}
}
export const officialLinkLabel=job=>job?.recruitment_source_kind==='EMPLOYER_ATS'?
 '打开企业招聘系统（核实后投递）':
 '打开企业招聘页面（核实后投递）';
