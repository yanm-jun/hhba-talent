// Public ATS discovery only. No AI, cookies, private data or paid API calls.
// Reports independently failing sources and never labels search-index hits as live jobs.
import {mkdir,writeFile} from 'node:fs/promises';
const sources=[
 {company:'OpenAI',platform:'ashby',token:'openai',url:'https://api.ashbyhq.com/posting-api/job-board/openai'},
 {company:'Anthropic',platform:'greenhouse',token:'anthropic',url:'https://boards-api.greenhouse.io/v1/boards/anthropic/jobs'},
 {company:'SpaceX',platform:'greenhouse',token:'spacex',url:'https://boards-api.greenhouse.io/v1/boards/spacex/jobs'}
];
const curated=new Map([
 ['ashby-openai-18e64608-5881-4b8f-b5cf-abd09a8ff086','亚太区广告供应商负责人（新加坡）'],
 ['ashby-openai-7ba0b390-b198-4101-80bb-b49a6dd62607','身份平台工程经理'],
 ['greenhouse-anthropic-5426627008','亚太区市场拓展赋能负责人'],
 ['greenhouse-anthropic-5391293008','汽车行业企业客户经理'],
 ['greenhouse-spacex-8885762002','财务应用软件工程经理'],
 ['greenhouse-spacex-8621995002','射频工程师（星链）']
]);
function validUrl(url,source){
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  if(source.platform==='ashby')return u.hostname==='jobs.ashbyhq.com'&&u.pathname.split('/')[1]==='openai'&&u.pathname.split('/').length>=3;
  return ['job-boards.greenhouse.io','boards.greenhouse.io','boards.eu.greenhouse.io'].includes(u.hostname)
    &&u.pathname.split('/').includes(source.token);
 }catch{return false}
}
function trim(s,max=220){
 if(typeof s!=='string')return '';
 return s.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().slice(0,max);
}
function mapRow(row,src,asOf){
 if(!row||typeof row!=='object'||row.isListed===false)return null;
 const id=src.platform==='ashby'?String(row.id||''):String(row.id||'');
 if(src.platform==='ashby'&&!/^[0-9a-f-]{36}$/i.test(id))return null;
 if(src.platform==='greenhouse'&&!/^\d{5,20}$/.test(id))return null;
 const uid=src.platform+'-'+src.token+'-'+id;
 const title=trim(row.title);
 const url=src.platform==='ashby'?row.jobUrl:row.absolute_url;
 if(!title||!validUrl(url,src))return null;
 return {id:uid,company:src.company,companyZh:src.company,title,
  titleZh:curated.get(uid)||null,titleStatus:curated.has(uid)?'verified_translated':'pending',
  location:trim(src.platform==='ashby'?row.location:row.location?.name,170),
  locationZh:curated.has(uid)?({'ashby-openai-18e64608-5881-4b8f-b5cf-abd09a8ff086':'新加坡',
  'ashby-openai-7ba0b390-b198-4101-80bb-b49a6dd62607':'美国 · 旧金山',
  'greenhouse-anthropic-5426627008':'澳大利亚 · 悉尼',
  'greenhouse-anthropic-5391293008':'法国 · 巴黎',
  'greenhouse-spacex-8885762002':'美国 · 加州霍桑',
  'greenhouse-spacex-8621995002':'美国 · 得克萨斯州巴斯特罗普'})[uid]||null:null,
  platform:src.platform,source:src.token,url,domestic:false,remote:row.isRemote===true||undefined,
  recruitmentType:undefined,recordKind:'ATS_PUBLIC_ACTIVE_LIST',observedAt:asOf,
  currentApplicationVerified:false};
}
const asOf=new Date().toISOString(),perCompany={},failures=[],selected=[];
for(const src of sources){
 try{
  const response=await fetch(src.url,{headers:{Accept:'application/json'},redirect:'error',
    signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw Error('HTTP_'+response.status);
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('NOT_JSON');
  const payload=await response.json();
  const rows=src.platform==='ashby'?payload.jobs:payload.jobs;
  if(!Array.isArray(rows)||rows.length>12000||rows.length===0)throw Error('EMPTY_OR_INVALID_BOARD');
  const verified=rows.map(r=>mapRow(r,src,asOf)).filter(Boolean);
  if(!verified.length)throw Error('NO_VALID_PUBLIC_JOB_URLS');
  verified.sort((a,b)=>Number(curated.has(b.id))-Number(curated.has(a.id)) || a.title.localeCompare(b.title));
  const pick=verified.slice(0,2);
  selected.push(...pick);
  perCompany[src.company]={found:verified.length,featured:pick.length,state:'ATS_LIST_CONFIRMED'};
 }catch(err){failures.push({company:src.company,error:String(err.message||err).slice(0,100)});
  perCompany[src.company]={found:0,featured:0,state:'SOURCE_UNAVAILABLE'};
 }
}
await mkdir('dist/data',{recursive:true});
const artifact={kind:'HHBA_3_EMPLOYER_OFFICIAL_BOARD_V1',updated:asOf,companyStatus:perCompany,failures,
 jobs:selected,total:selected.length,offset:0,limit:30,boards:3,informationalNotice:
 'Only directly listed, valid public ATS job URLs; fetched at the timestamp shown. Later closure remains possible.'};
await writeFile('dist/data/featured-live.json',JSON.stringify(artifact),'utf8');
console.log('HHBA_FEATURED_PUBLIC_BOARDS',JSON.stringify({updated:asOf,counts:perCompany,failures}));
