/**
 * V8: derive a Mainland work CITY from independently fetched single-job page
 * content. Never use a Search snippet, employer address, URL, or model guess.
 * Every accepted city has an auditable field/header/JobPosting evidence type.
 */
import {MAINLAND_CITIES,findMainlandCity,classifyMainlandJobLocation} from './mainland-job-location.js';

const WORK_FIELD=/^(?:工作地点|工作城市|工作地|工作所在地|工作地址|办公地点|办公城市|办公地|办公地址|上班地点|岗位地点|岗位城市|岗位所在地|职位地点|职位城市|职位所在地|任职地点|常驻地|base地|job location|work location|location)(?:\s*[：:|｜—–-]\s*|\s{1,4}|$)/i;
const SHORT_FIELD=/^(?:城市|地点|city)(?:\s*[：:|｜—–-]\s*|\s{1,4}|$)/i;
const END_SECTION=/^(?:岗位职责|工作职责|职位职责|工作内容|职责描述|工作描述|职位描述|职责|任职要求|岗位要求|职位要求|任职资格|招聘要求|qualification|requirements|responsibilities|job responsibilities)(?:[\s：:]|$)/i;
const BAD_VALUE=/(?:待定|不限|不限制|任意地点|全国范围|全国各地|分配|海外|境外|国外|remote|anywhere|全球|worldwide)/i;
const DISTRICT=/(?:朝阳区|白山区|吉林市|伊春区)/u;
const QUOTED_CITY=/^(?:中国大陆|中国)?\s*([\p{Script=Han}]{2,12}(?:市|州)?)\s*$/u;
const safe=(s,n=160)=>typeof s==='string'?s.trim().slice(0,n):'';
function normalizeLine(x){
 return String(x||'').replace(/^\s*(?:#{1,6}\s*|[-*•·]\s*|\d{1,2}[.、．]\s*)/,'')
  .replace(/\*\*/g,'').replace(/^\s*>\s*/,'')
  .replace(/^\s*\|\s*/,'').replace(/\s*\|\s*$/,'')
  .replace(/[ \t]+/g,' ').trim();
}
function citiesInValue(value){
 const s=String(value||'');
 const matches=MAINLAND_CITIES.filter(c=>s.includes(c)&&!(c==='朝阳'&&/朝阳区/.test(s)&&/北京市?/.test(s))&&
 !(c==='吉林'&&(/吉林省/.test(s)||(/吉林市/.test(s)&&!/^吉林市/.test(s)))));
 return [...new Set(matches)];
}
function interpret(value){
 const text=safe(value,140).replace(/^\s*(?:中国大陆|中国)\s*[-—–|｜,，]?\s*/,'');
 if(!text||BAD_VALUE.test(text))return {reason:'UNKNOWN_MAINLAND_CITY'};
 const parts=text.split(/\s*(?:\/|\||｜|,|，|;|；|、|或者|或|及|与|\band\b|\bor\b)\s*/i).filter(Boolean);
 if(!parts.length)return {reason:'UNKNOWN_MAINLAND_CITY'};
 const found=[];
 for(const p of parts){
  if(!p||classifyMainlandJobLocation(p)!=='MAINLAND_CONFIRMED')
   return {reason:classifyMainlandJobLocation(p)==='OUTSIDE_MAINLAND'?'OVERSEAS_WORKPLACE':'UNKNOWN_MAINLAND_CITY'};
  const distinct=citiesInValue(p);
  if(distinct.length>1){
   // The Beijing/Chaoyang-district case was filtered above; anything else
   // carries multiple named cities and must not be collapsed to the first one.
   return {reason:'AMBIGUOUS_WORKPLACE'};
  }
  const city=findMainlandCity(p);
  if(!city)return {reason:'UNKNOWN_MAINLAND_CITY'};
  // A bare district named like a prefecture is NOT proof of the prefecture.
  // e.g. 朝阳区 alone does not establish the city 朝阳 (or 北京).
  if(/^[\p{Script=Han}]{2,9}(?:区|县)$/u.test(p)&&p===city+'区')
   return {reason:'UNKNOWN_MAINLAND_CITY'};
  found.push(city);
 }
 if(new Set(found).size>1)return {reason:'AMBIGUOUS_WORKPLACE'};
 return {city:found[0]};
}
function headerStop(lines){
 const idx=lines.findIndex((l,i)=>i>3&&END_SECTION.test(l));
 return idx>=0?idx:lines.length;
}
function readField(lines,i,allowGeneric){
 const line=lines[i];
 const match=line.match(WORK_FIELD)||(allowGeneric?line.match(SHORT_FIELD):null);
 if(!match)return null;
 const remainder=line.slice(match[0].length).replace(/^[：:|｜—–\-\s]+/,'').trim();
 if(remainder)return remainder.slice(0,140);
 const next=lines[i+1]||'';
 if(!next||END_SECTION.test(next)||WORK_FIELD.test(next)||SHORT_FIELD.test(next))
  return null;
 return next.slice(0,140);
}
function extractedJobPostingLocations(raw,role,now=new Date()){
 const found=[];let count=0,matching=0,reason=null;
 const scripts=[...String(raw||'').slice(0,200000).matchAll(
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].slice(0,8);
 const validCountry=value=>{
  if(!value)return true; // legacy schemas sometimes omit addressCountry
  const name=typeof value==='string'?value:value?.name||value?.['@id']||'';
  return /^(?:CN|CHN|中国|中国大陆|中华人民共和国|China|People.s Republic of China)$/i.test(String(name).trim());
 };
 function walk(value,depth=0){
  if(depth>4||!value||typeof value!=='object')return;
  if(Array.isArray(value)){for(const v of value.slice(0,16))walk(v,depth+1);return;}
  const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];
  if(types.some(t=>typeof t==='string'&&t.toLowerCase()==='jobposting')){
   count++;
   const title=safe(value.title,140);
   // Never borrow location from a nameless or differently named listing.
   if(!title||!role||!(title.includes(role)||role.includes(title)))return;
   matching++;
   if(/TELECOMMUTE/i.test(String(value.jobLocationType||''))){reason='UNKNOWN_MAINLAND_CITY';return;}
   const end=value.validThrough?Date.parse(value.validThrough):NaN;
   if(Number.isFinite(end)&&end<new Date(now).getTime()){
    reason='CLOSED';return;
   }
   const locs=Array.isArray(value.jobLocation)?value.jobLocation:[value.jobLocation];
   for(const loc of locs.slice(0,10)){
    const addr=loc?.address;
    if(!addr||typeof addr!=='object')continue;
    if(!validCountry(addr.addressCountry)){reason='OVERSEAS_WORKPLACE';return;}
    const city=addr.addressLocality||addr.addressRegion;
    if(typeof city==='string')found.push(city);
   }
  }
  if(value['@graph'])walk(value['@graph'],depth+1);
 }
 for(const m of scripts){
  if(m[1].length>25000)continue;
  try{walk(JSON.parse(m[1]));}catch{}
 }
 if(count>1)return {values:[],reason:'MULTIPLE_STRUCTURED_JOBS'};
 if(reason)return {values:[],reason};
 if(count&&matching!==1)return {values:[],reason:'UNRELATED_STRUCTURED_JOB'};
 return {values:found,reason:null};
}
export function extractMainlandWorkplaceFromJob({raw='',lines=[],role=''}={}){
 const normalized=(Array.isArray(lines)?lines:[]).map(normalizeLine).filter(Boolean);
 const boundary=headerStop(normalized);
 // Only single-job header metadata, NEVER the footer's corporate office.
 const scan=Math.min(boundary,90,normalized.length);
 const roleAt=normalized.findIndex((x,j)=>j<scan&&role&&
  (x===role||x.startsWith(role+' |')||x.startsWith(role+' -')||x.startsWith(role+' ')));
 const labeled=[];
 for(let i=0;i<scan;i++){
  const genericAfterRole=roleAt>=0&&i>=roleAt&&i<=roleAt+8;
  const v=readField(normalized,i,genericAfterRole);
  if(v===null)continue;
  // A bare "工作地点" menu item before the actual role followed by a
  // navigation label is not an employer work-city field. Inline and
  // meaningful next-line values are still validated, including conflicts.
  const hasInline=/[：:|｜—–-]\s*\S+/u.test(normalized[i]);
  if(roleAt>=0&&i<roleAt&&!hasInline&&!interpret(v).city)continue;
  labeled.push(v);
 }
 // Structured data is a SECOND source from the fetched single-job page,
 // never Search snippets. A conflict with a labeled city rejects the page.
 const structured=extractedJobPostingLocations(raw,role);
 if(structured.reason)return {reason:structured.reason};
 const parsed=structured.values.map(interpret);
 const failed=parsed.find(x=>!x.city);
 if(failed)return failed;
 const structuredCities=[...new Set(parsed.map(x=>x.city))];
 if(structuredCities.length>1)return {reason:'AMBIGUOUS_WORKPLACE'};
 const structuredCity=structuredCities[0]||null;
 // Never let a labeled work city contradict the SAME vacancy's standalone
 // role header. Both are independently parsed from the fetched document.
 const workHeaderCities=[];
 if(roleAt>=0){
  const inline=normalized[roleAt].slice(role.length).replace(/^[\s｜|—–-]+/u,'').trim();
  if(inline&&inline.length<=14&&QUOTED_CITY.test(inline)&&
    citiesInValue(inline).length===1&&findMainlandCity(inline))
   workHeaderCities.push(findMainlandCity(inline));
  const near=normalized.slice(roleAt+1,Math.min(roleAt+7,scan));
  for(const line of near){
   const parts=line.split(/[｜|]/).map(x=>x.trim()).filter(Boolean);
   if(parts.length>=3&&parts.length<=6&&line.length<105&&
     parts.some(x=>/^(?:全职|兼职|实习|社会招聘|校园招聘|正式|社招|校招)$/u.test(x))){
    const city=parts.at(-1);
    if(city&&city.length<=14&&QUOTED_CITY.test(city)&&
      citiesInValue(city).length===1&&findMainlandCity(city))
     workHeaderCities.push(findMainlandCity(city));
   }
  }
 }
 const uniqueHeaderCities=[...new Set(workHeaderCities)];
 if(uniqueHeaderCities.length>1||
   structuredCity&&uniqueHeaderCities.length&&uniqueHeaderCities[0]!==structuredCity)
  return {reason:'AMBIGUOUS_WORKPLACE'};
 if(labeled.length){
  const evaluated=labeled.map(interpret);
  const errors=evaluated.find(x=>!x.city);
  if(errors)return errors;
  const cities=[...new Set(evaluated.map(x=>x.city))];
  if(cities.length!==1||structuredCity&&cities[0]!==structuredCity||
    uniqueHeaderCities.length&&cities[0]!==uniqueHeaderCities[0])
   return {reason:'AMBIGUOUS_WORKPLACE'};
  return {city:cities[0],evidence_type:'JOB_LOCATION_FIELD'};
 }
 if(structuredCity)return {city:structuredCity,evidence_type:'JOBPOSTING_STRUCTURED'};
 // Standalone city *on or adjacent to this exact job title*, before JD.
 if(roleAt>=0){
  const after=normalized.slice(roleAt+1,Math.min(roleAt+7,scan));
  const cities=[];
  // A common rendered ATS header: "内容运营经理 上海" (single position).
  // The city must be a complete city token, not "上海客户" or a nav tag.
  const inline=normalized[roleAt].slice(role.length).replace(/^[\s｜|—–-]+/u,'').trim();
  if(inline&&inline.length<=14&&QUOTED_CITY.test(inline)&&
   citiesInValue(inline).length===1&&findMainlandCity(inline))cities.push(findMainlandCity(inline));
  for(const candidate of after){
   const word=candidate.replace(/^中国大陆[\s｜|—-]*/,'').trim();
   if(word.length<=14&&QUOTED_CITY.test(word)&&
     !/(?:招聘|公司|集团|工作|办公|岗位|职责|要求|地址|实习|专员|运营|经理|不限)/.test(word)){
    const city=findMainlandCity(word);
    if(city&&citiesInValue(word).length===1)cities.push(city);
   }
   // Many employer-owned career sites have a header after the exact role:
   // "产品规划中心｜全职｜科研通道｜上海". Only the final standalone city
   // with explicit employment mode within the same single-job header counts.
   // Do not mine ordinary prose, office addresses, or related-job listings.
   const parts=candidate.split(/[｜|]/).map(x=>x.trim()).filter(Boolean);
   if(parts.length>=3&&parts.length<=6&&candidate.length<105&&
     parts.some(x=>/^(?:全职|兼职|实习|社会招聘|校园招聘|正式|社招|校招)$/u.test(x))){
    const place=parts.at(-1);
    if(place&&place.length<=14&&QUOTED_CITY.test(place)&&
       citiesInValue(place).length===1&&findMainlandCity(place))
     cities.push(findMainlandCity(place));
   }
  }
  if(new Set(cities).size>1)return {reason:'AMBIGUOUS_WORKPLACE'};
  if(cities.length)return {city:cities[0],evidence_type:'JOB_HEADER_CITY'};
 }
 return {reason:'MISSING_EXPLICIT_WORKPLACE'};
}
