// Source spans rather than model-assembled excerpts: preserve every character
// between independently located JD boundaries, including intervening paragraphs.
export function completeJdSpan(document,parts,startQuote,endQuote){
 if(typeof document!=='string'||!Array.isArray(parts)||!parts.length||typeof startQuote!=='string'||!startQuote.trim()||typeof endQuote!=='string'||!endQuote.trim())return null;
 const start=document.indexOf(startQuote),end=document.indexOf(endQuote,Math.max(0,start));
 if(start<0||end<start||document.indexOf(startQuote,start+1)!==-1||document.indexOf(endQuote,end+1)!==-1)return null;
 const span=document.slice(start,end+endQuote.length).trim();
 if(!span||looksTruncatedJd(span))return null;
 const norm=x=>x.trim().replace(/\s+/g,' ');
 let offset=0,plain=norm(span);
 for(const part of parts){
  if(typeof part!=='string'||!part.trim())return null;
  const quote=norm(part),position=plain.indexOf(quote,offset);
  if(position<0)return null;
  offset=position+quote.length;
 }
 return span;
}
export function looksTruncatedJd(text){
 return typeof text==='string'&&/(?:\.\.\.|…+|查看完整(?:职位|岗位|描述|招聘信息)|展开(?:全部|更多|完整)(?:内容|描述)?|read more|show more|view full (?:job|description))\s*$/i.test(text.trim());
}
// Schema.org JobPosting may publish responsibilities and qualifications in
// fields separate from description. Preserve each independently read value,
// not just the description. Do not invent headings or missing qualifications.
export function structuredJdParts(posting,convert){
 const collect=v=>{
  if(typeof v==='string')return [convert(v).trim()].filter(Boolean);
  if(Array.isArray(v))return v.flatMap(collect);
  if(v&&typeof v==='object')return ['name','description','credentialCategory','monthsOfExperience','value'].flatMap(k=>collect(v[k]));
  if(typeof v==='number'&&Number.isFinite(v))return [String(v)];
  return [];
 };
 const fields=['description','responsibilities','qualifications','skills','educationRequirements','experienceRequirements','occupationalCredentialAwarded','jobBenefits','incentiveCompensation','workHours','employmentType'];
 const parts=[];
 for(const k of fields)for(const value of collect(posting?.[k]))if(!parts.some(p=>p.replace(/\s+/g,' ').includes(value.replace(/\s+/g,' '))))parts.push(value);
 return parts;
}
