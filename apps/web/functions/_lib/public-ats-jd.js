/**
 * Public, employer-directed ATS POSTING APIs.
 * This is not an arbitrary URL fetcher or a claim of legal-company ownership:
 * the tenant slug is explicitly identified as the public ATS job-board token.
 * Exact HTTPS URL, token and job id are bound to a fixed provider API host.
 * No application endpoints or user-provided API URLs are ever fetched.
 */
import {findMainlandCity,isMainlandJobLocation} from './mainland-job-location.js';
import {extractOfficialJdSections,htmlToText} from './official-job-evidence.js';

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT=/^[a-z0-9][a-z0-9_-]{1,63}$/i;
const NUMBER=/^[0-9]{4,12}$/;
const MAX_BYTES=240000;
export const ATS_JD_PROOF='PUBLIC_EMPLOYER_ATS_V1';

export function safePublicAtsJobLocator(input){
 if(typeof input!=='string'||input.length>350)return null;
 try{
  const u=new URL(input);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||
   u.search||u.pathname.endsWith('/'))return null;
  const parts=u.pathname.split('/').filter(Boolean);
  if((u.hostname==='job-boards.greenhouse.io'||u.hostname==='boards.greenhouse.io')&&
   parts.length===3&&parts[1]==='jobs'&&TENANT.test(parts[0])&&NUMBER.test(parts[2])){
   const tenant=parts[0].toLowerCase(),id=parts[2];
   return {kind:'greenhouse',tenant,id,company:tenant,
    url:'https://'+u.hostname+'/'+tenant+'/jobs/'+id,
    api_url:'https://boards-api.greenhouse.io/v1/boards/'+tenant+'/jobs/'+id+'?content=true'};
  }
  if((u.hostname==='jobs.lever.co'||u.hostname==='jobs.eu.lever.co')&&
   parts.length===2&&TENANT.test(parts[0])&&ID.test(parts[1])){
   const tenant=parts[0].toLowerCase(),id=parts[1].toLowerCase(),
    eu=u.hostname==='jobs.eu.lever.co';
   return {kind:'lever',tenant,id,company:tenant,
    url:'https://'+u.hostname+'/'+tenant+'/'+id,
    api_url:'https://'+(eu?'api.eu.lever.co':'api.lever.co')+
      '/v0/postings/'+tenant+'/'+id};
  }
  return null;
 }catch{return null;}
}
async function boundedJson(response){
 if(response.status!==200)throw Error('ATS_POSTING_NOT_AVAILABLE');
 const type=(response.headers.get('Content-Type')||'').toLowerCase();
 if(!/(?:application\/json|\+json)/.test(type))throw Error('ATS_RESPONSE_NOT_JSON');
 const len=response.headers.get('content-length');
 if(len!==null&&(!/^\d+$/.test(len)||Number(len)>MAX_BYTES))
  throw Error('ATS_RESPONSE_TOO_LARGE');
 if(!response.body)throw Error('ATS_RESPONSE_EMPTY');
 const reader=response.body.getReader();const chunks=[];let n=0;
 try{
  for(;;){const r=await reader.read();if(r.done)break;
   n+=r.value.byteLength;if(n>MAX_BYTES){await reader.cancel();throw Error('ATS_RESPONSE_TOO_LARGE');}
   chunks.push(r.value);
  }
 }finally{reader.releaseLock()}
 const data=new Uint8Array(n);let off=0;
 for(const chunk of chunks){data.set(chunk,off);off+=chunk.byteLength}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data))}
 catch{throw Error('ATS_RESPONSE_INVALID_JSON')}
}
function tidy(text){return typeof text==='string'?text.trim():'';}
function htmlLines(text){
 // Some Greenhouse content is HTML entity encoded twice.
 return htmlToText(htmlToText(text)).replace(/\r/g,'').trim();
}
function unpackGreenhouse(data,loc){
 if(!data||typeof data!=='object'||String(data.id)!==loc.id)return null;
 if(typeof data.title!=='string'||data.title.length<3||data.title.length>120)return null;
 const place=tidy(data.location?.name);
 const published=tidy(data.content);
 if(!place||!published||published.length<90)return null;
 return {title:tidy(data.title),place,body:htmlLines(published)};
}
function unpackLever(data,loc){
 if(!data||typeof data!=='object'||data.id?.toLowerCase()!==loc.id)return null;
 if(typeof data.hostedUrl!=='string'||safePublicAtsJobLocator(data.hostedUrl)?.url!==loc.url)
  return null;
 const title=tidy(data.text),place=tidy(data.categories?.location);
 if(title.length<3||title.length>120||!place)return null;
 const lists=Array.isArray(data.lists)?data.lists.slice(0,18):[];
 const blocks=[
  tidy(data.descriptionPlain||data.description),
  ...lists.flatMap(l=>[tidy(l.text),tidy(l.content)]),
  tidy(data.additionalPlain||data.additional)
 ].filter(Boolean);
 if(blocks.join('\n').length<90)return null;
 return {title,place,body:htmlLines(blocks.join('\n'))};
}
export async function fetchPublicAtsJd(url,{fetcher=fetch,now=new Date()}={}){
 const loc=safePublicAtsJobLocator(url);
 if(!loc)throw Error('ATS_URL_NOT_SUPPORTED');
 let response;
 try{
  response=await fetcher(loc.api_url,{
   method:'GET',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000),
   headers:{Accept:'application/json','User-Agent':'HHBA-PublicJobJD/1.0'}
  });
 }catch{throw Error('ATS_POSTING_FETCH_FAILED')}
 const data=await boundedJson(response);
 const item=loc.kind==='greenhouse'?unpackGreenhouse(data,loc):unpackLever(data,loc);
 if(!item)throw Error('ATS_POSTING_UNVERIFIED');
 if(!isMainlandJobLocation(item.place))throw Error('ATS_NOT_MAINLAND');
 const city=findMainlandCity(item.place);
 if(!city)throw Error('ATS_LOCATION_UNVERIFIED');
 const parsed=extractOfficialJdSections(item.body);
 if(!parsed)throw Error('ATS_JD_SECTIONS_UNVERIFIED');
 return {
  canonical_url:loc.url,company:loc.company,title:item.title,location:city,
  ...parsed,proof_method:ATS_JD_PROOF,
  checked_at:new Date(now).toISOString(),
  source_label:loc.kind+' public employer-controlled job board (tenant: '+loc.tenant+')'
 };
}
