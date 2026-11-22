/**
 * Model-driven Mainland job-search planning.
 *
 * The model decides job families, synonyms and company/industry angles from the
 * consented, redacted CV. The old keyword table remains only a fast fallback.
 * Query text contains no CV, URLs, credentials or personal contact identifiers.
 * No made-up jobs, employers or source links can be returned by this planner.
 */
const BASE='https://api.deepseek.com';
const DEFAULT_TIMEOUT_MS=35000;
const clean=x=>String(x||'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim();
const pii=/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b1[3-9]\d{9}\b|\b\d{17}[\dXx]\b|(?:微信|手机号|QQ号|身份证号)\s*[:：])/i;
const unsafe=/(?:https?:\/\/|(?:\b(?:login|password|token|api[_-]?key|passwd)\b))/i;
export function normalizeAutonomousQueries(values,used=[]){
 if(!Array.isArray(values))return [];
 const known=new Set((Array.isArray(used)?used:[]).map(x=>clean(x).toLowerCase()));
 const output=[];
 for(const value of values){
  const raw=typeof value==='string'?value:typeof value?.query==='string'?value.query:'';
  const query=clean(raw);
  const key=query.toLowerCase();
  // Search API's query field supports short human-readable searches. These
  // checks protect contacts and keys, not the AI's choice of job direction.
  if(query.length<5||query.length>128||pii.test(query)||unsafe.test(query)||known.has(key))continue;
  known.add(key);
  output.push(query);
 }
 return output;
}
function outputText(result){
 const outputs=(result?.output||[]).filter(row=>row?.type==='message');
 return outputs.flatMap(row=>(row.content||[])
  .filter(part=>part?.type==='output_text').map(part=>part.text||'')).join('');
}
export async function planAutonomousMainlandSearch(key,redactedResume,roleHint,{
 fetcher=fetch,signal=null,plannerTimeoutMs=DEFAULT_TIMEOUT_MS
}={}){
 const timeout=AbortSignal.timeout(plannerTimeoutMs);
 const sig=signal?AbortSignal.any([signal,timeout]):timeout;
 const instructions=[
  '你是 HHBA 国内求职搜索策略智能体。你完全负责根据真实简历推断目标岗位方向、可迁移职业能力和相关岗位的多种招聘表述。',
  '不要被固定行业关键词、用户过去的职称或某几个岗位名称所限制。自主探索直接相关、相邻、跨行业和容易被忽略的真实职业机会。目标岗位方向输入为空时，你自己根据简历综合判断。',
  '这些搜索短句只用于查询中国大陆公开招聘信息。尽量覆盖企业官网、官方招聘公告、企业自有招聘站、公开招聘信息与职位任职要求，允许把专业名、经历和技能转成适合国内招聘用语。',
  '检索语句不要含求职者姓名、学校学号、手机号、邮箱、住址、身份证、QQ、微信、原简历原句、隐私信息，也不要在搜索词中夹带URL或任何API密钥。',
  '不要编造招聘信息、特定企业正在招人或真实职位链接；规划查询语句不等于发现职位。',
  '按你认为有价值的角度组织多条高质量、不重复且彼此补充的中文搜索语句，每条控制在128字符内。不要为了固定数目而凑数。',
  '返回严格 JSON 对象：{"queries":["用于企业官方岗位搜索的查询1","查询2"],"strategy":"简短说明涵盖的职业方向"}'
 ].join('\n');
 const response=await fetcher(BASE+'/responses',{
  method:'POST',redirect:'manual',signal:sig,
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
  body:JSON.stringify({model:'deepseek-v4-pro',reasoning:{effort:'max'},
   text:{format:{type:'json_object'}},max_output_tokens:14000,stream:false,
   instructions,
   input:'目标职位（可为空）：'+clean(roleHint).slice(0,80)+
    '\n已脱敏且用户授权用于分析的简历：\n'+String(redactedResume||'').slice(0,12000)})
 });
 if(!response.ok){
  const code=response.status===401||response.status===403?'AI_PROVIDER_KEY_REJECTED':
   response.status===402?'AI_PROVIDER_BALANCE_INSUFFICIENT':
   response.status===429?'AI_PROVIDER_RATE_LIMITED':
   [400,404,422].includes(response.status)?'AI_PROVIDER_REQUEST_REJECTED':
   'AI_PROVIDER_UNAVAILABLE';
  throw Object.assign(new Error(code),{code});
 }
 let result;try{result=JSON.parse(outputText(await response.json()))}
 catch{throw Error('SEARCH_PLANNER_INVALID_JSON')}
 return {queries:normalizeAutonomousQueries(result?.queries),
  strategy:clean(result?.strategy).slice(0,240)};
}
