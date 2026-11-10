// Distinguish employer-directed job pages from recruitment aggregators.
// Domain shape is a source *signal*; no domain without employer ownership
// evidence may be presented as a verified corporate recruitment website.
// Keep official ATS services distinct from mass job boards.
const BOARD_HOSTS=[
 'zhipin.com','51job.com','zhaopin.com','liepin.com','lagou.com',
 'shixiseng.com','yingjiesheng.com','jobui.com','kanzhun.com',
 '58.com','ganji.com','maimai.cn','bosszhipin.com','100offer.com',
 'job5156.com','chinahr.com','qianchengwuyou.com'
];
const ATS_HOSTS=[
 'myworkdayjobs.com','workdayjobs.com','greenhouse.io',
 'lever.co','smartrecruiters.com','taleo.net','icims.com',
 'ashbyhq.com','recruitee.com','successfactors.com','oraclecloud.com',
 'jobvite.com','breezy.hr','teamtailor.com'
];
const sameOrChild=(host,domain)=>host===domain||host.endsWith('.'+domain);
const compact=s=>String(s||'').replace(/[\s《》【】[\]（）()·•:：—–\-_,.，。/\\]+/g,'').toLowerCase();
const companyCore=s=>compact(s).replace(/^(?:北京市?|上海市?|深圳市?|广州市?|杭州市?|成都市?)/,'')
 .replace(/(?:股份)?(?:有限责任公司|有限公司|股份有限公司|集团公司|集团|公司)$/,'');
const titleCore=s=>compact(s).replace(/(?:社会招聘|校园招聘|社招|校招|急聘|岗位招聘|职位招聘|招聘岗位|招聘职位|实习生|招聘)$/,'');
const basicLocation=s=>compact(s).replace(/(市|区|县|省|中国大陆|中国内地)/g,'').slice(0,6);
export function recruitmentSourceKind(url){
 let u;
 try{u=new URL(url)}catch{return 'UNVERIFIED';}
 const host=u.hostname.toLowerCase();
 if(BOARD_HOSTS.some(d=>sameOrChild(host,d)))return 'THIRD_PARTY_BOARD';
 if(ATS_HOSTS.some(d=>sameOrChild(host,d)))return 'EMPLOYER_ATS';
 // A generic /jobs or /positions URL is not enough: public boards also use them.
 // Prefer explicit careers-domain branding or dedicated recruitment paths.
 if(/^(careers?|jobs?|recruit(?:ment)?|zhaopin|join|talent|hr|campus)\./.test(host)
  ||/(?:\/(?:careers?|recruit(?:ment)?|join-us|vacanc(?:y|ies))\/)/i.test(u.pathname))
  return 'EMPLOYER_DOMAIN_CANDIDATE';
 return 'UNVERIFIED';
}
// HHBA strictly forbids consumer job boards and unknown aggregators in results.
// Employer-branded career sites and dedicated employer ATS positions may be considered.
// Domain shape is a candidate signal, not proof of corporate authorization.
export function isEmployerDirectedSource(kind){
 return kind==='EMPLOYER_DOMAIN_CANDIDATE'||kind==='EMPLOYER_ATS';
}
export function allowedEmployerJobLink(raw){
 return isEmployerDirectedSource(recruitmentSourceKind(raw));
}
export function sourcePriority(kind){
 return kind==='EMPLOYER_DOMAIN_CANDIDATE'?0:kind==='EMPLOYER_ATS'?1:
  kind==='UNVERIFIED'?2:3;
}
export function sortEmployerFirst(hits,max=48){
 return hits.map((hit,index)=>({hit,index})).sort((a,b)=>{
  const ak=a.hit.recruitment_source_kind||recruitmentSourceKind(a.hit.url);
  const bk=b.hit.recruitment_source_kind||recruitmentSourceKind(b.hit.url);
  return sourcePriority(ak)-sourcePriority(bk)||a.index-b.index;
 }).slice(0,max).map(x=>x.hit);
}
export function sourceDisplay(kind){
 if(kind==='THIRD_PARTY_BOARD')return '已排除 · 第三方招聘平台';
 if(kind==='EMPLOYER_ATS')return '企业招聘系统候选 · 来源待核验';
 if(kind==='EMPLOYER_DOMAIN_CANDIDATE')return '疑似企业招聘站 · 来源待核验';
 return '来源不明 · 不参与推荐';
}
export function employerLookupQuery(job){
 const company=String(job.company||'').replace(/[\r\n<>]/g,' ').slice(0,45);
 const title=String(job.title||'').replace(/[\r\n<>]/g,' ').slice(0,40);
 const location=String(job.location||'').replace(/[\r\n<>]/g,' ').slice(0,20);
 return (company+' '+title+' '+location+' 企业官网 招聘 职位详情 -site:zhipin.com -site:51job.com -site:zhaopin.com -site:liepin.com').slice(0,128);
}
export function corroboratesEmployerPosting(job,hit){
 const kind=hit?.recruitment_source_kind||recruitmentSourceKind(hit?.url);
 // Never silently relabel a third-party platform as an official employer URL.
 if(kind!=='EMPLOYER_DOMAIN_CANDIDATE'&&kind!=='EMPLOYER_ATS')return false;
 const evidence=compact([hit?.title,hit?.site_name||hit?.source,hit?.summary,hit?.snippet].join(' '));
 const company=companyCore(job.company),title=titleCore(job.title),city=basicLocation(job.location);
 // Both company and specific job title must be evident in the returned Search result.
 // Do not trust a company name echoed only in the Search query.
 if(company.length<2||title.length<2)return false;
 const companyMatch=evidence.includes(company)||company.length>=5&&evidence.includes(company.slice(0,5));
 const roleMatch=evidence.includes(title)||title.length>=5&&evidence.includes(title.slice(0,5));
 const locationMatch=city.length<2||evidence.includes(city);
 return Boolean(companyMatch&&roleMatch&&locationMatch);
}
export function sourceCounts(jobs){
 const out={employer_domain:0,employer_ats:0,third_party_board:0,unverified:0};
 for(const job of jobs){
  const kind=job.recruitment_source_kind||recruitmentSourceKind(job.official_url);
  if(kind==='EMPLOYER_DOMAIN_CANDIDATE')out.employer_domain++;
  else if(kind==='EMPLOYER_ATS')out.employer_ats++;
  else if(kind==='THIRD_PARTY_BOARD')out.third_party_board++;
  else out.unverified++;
 }
 return out;
}
