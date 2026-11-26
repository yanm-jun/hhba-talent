// Public query sanitation for the employer index; never dispatches a model request.
const clean=x=>String(x||'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim();
const pii=/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b1[3-9]\d{9}\b|\b\d{17}[\dXx]\b|(?:微信|手机号|QQ号|身份证号)\s*[:：])/i;
const unsafe=/(?:https?:\/\/|(?:\b(?:login|password|token|api[_-]?key|passwd)\b))/i;
export function normalizeAutonomousQueries(values,used=[],{minLength=3}={}){
 if(!Array.isArray(values))return [];
 const known=new Set((Array.isArray(used)?used:[]).map(x=>clean(x).toLowerCase()));
 const output=[];
 for(const value of values){
  const raw=typeof value==='string'?value:typeof value?.query==='string'?value.query:'';
  const query=clean(raw);
  const key=query.toLowerCase();
  // Search API's query field supports short human-readable searches. These
  // checks protect contacts and keys, not the AI's choice of job direction.
  // Short Chinese job titles such as 区域督导 are meaningful search queries.
  // Reject only empty or extremely broad one/two-character phrases, not all
  // real four-character occupations.
  if(query.length<minLength||query.length>128||pii.test(query)||unsafe.test(query)||known.has(key))continue;
  known.add(key);
  output.push(query);
 }
 return output;
}
