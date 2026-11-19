/**
 * Server-only AI provider routing. Never expose credentials to the browser.
 * Keep provider model names configurable; vendors change model availability.
 */
export const PROVIDERS = Object.freeze({
 deepseek:{baseUrl:'https://api.deepseek.com',protocol:'openai'},
 openai:{baseUrl:'https://api.openai.com/v1',protocol:'openai'},
 anthropic:{baseUrl:'https://api.anthropic.com/v1',protocol:'anthropic'},
 gemini:{baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',protocol:'openai'},
 qwen:{baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',protocol:'openai'},
 zhipu:{baseUrl:'https://open.bigmodel.cn/api/paas/v4',protocol:'openai'},
 groq:{baseUrl:'https://api.groq.com/openai/v1',protocol:'openai'},
 openrouter:{baseUrl:'https://openrouter.ai/api/v1',protocol:'openai'}
});
const allowedKeys=new Set(Object.keys(PROVIDERS));
const clip=(value,max=20000)=>String(value||'').slice(0,max);
export function selectProvider(env,task='resume_optimization'){
 const requested=clip(env?.['HHBA_AI_'+task.toUpperCase()+'_PROVIDER']||env?.HHBA_AI_DEFAULT_PROVIDER||'deepseek',30).toLowerCase();
 if(!allowedKeys.has(requested))throw new Error('AI_PROVIDER_UNSUPPORTED');
 const prefix='HHBA_AI_'+requested.toUpperCase()+'_';
 // For the existing HHBA DeepSeek integration, reuse the server-side secret
 // instead of requiring the founder to duplicate sensitive credentials.
 const key=env?.[prefix+'API_KEY']||(requested==='deepseek'?env?.HHBA_MATCH_DEEPSEEK_KEY:null);
 // "deepseek-chat"/"deepseek-reasoner" were retired in 2026: use the current
 // non-thinking Flash model by default, always allowing explicit override.
 const model=env?.[prefix+'MODEL']||(requested==='deepseek'?'deepseek-flash':null);
 if(typeof key!=='string'||!key.trim()||typeof model!=='string'||!model.trim())throw new Error('AI_PROVIDER_NOT_CONFIGURED');
 return {name:requested,...PROVIDERS[requested],key,model:model.trim()};
}
export function parseSuggestions(raw,allowedBlockIds){
 if(!raw||!Array.isArray(raw.suggestions))throw new Error('AI_PROVIDER_RESPONSE_INVALID');
 const allowed=new Set(allowedBlockIds),used=new Set(),accepted=[];
 for(const [index,s] of raw.suggestions.slice(0,12).entries()){
  if(!s||typeof s!=='object'||Array.isArray(s))continue;
  const blockId=typeof s.blockId==='string'?s.blockId:
   (typeof s.block_id==='string'?s.block_id:'');
  if(!allowed.has(blockId)||used.has(blockId))continue;
  if(!['replace','append','request_evidence'].includes(s.action))continue;
  const isEvidenceRequest=s.action==='request_evidence';
  let proposed=typeof s.proposed==='string'?s.proposed.trim():'';
  if(!proposed&&isEvidenceRequest)
   proposed='请补充你真实参与的相关工作、项目或成果。';
  if(!proposed||proposed.length>1600)continue;
  const original=typeof s.original==='string'&&s.original.trim()?s.original:
   '原始段落内容由服务端核实';
  const rationale=typeof s.rationale==='string'&&s.rationale.trim()?s.rationale:
   '请确认建议的每项事实都符合真实经历';
  const jobRequirement=typeof s.jobRequirement==='string'&&s.jobRequirement.trim()?
   s.jobRequirement:'岗位相关要求';
  used.add(blockId);
  accepted.push({
   id:clip(typeof s.id==='string'&&s.id.trim()?s.id:'suggestion-'+(index+1)+'-'+blockId,100),
   blockId,action:s.action,original:clip(original,1600),proposed:clip(proposed,1600),
   rationale:clip(rationale,600),jobRequirement:clip(jobRequirement,600),
   // The model is not an authority on the user's employment facts.
   evidenceStatus:'needs_user_confirmation'
  });
 }
 if(raw.suggestions.length>0&&!accepted.length)
  throw new Error('AI_PROVIDER_RESPONSE_INVALID');
 return accepted;
}
export async function generateSuggestions({env,blocks,job,signal}){
 const provider=selectProvider(env);
 const system='你是HHBA简历优化助手。只使用用户提供的真实证据。不要虚构任职资格、学历、时间、业绩或技能。针对岗位逐条提出建议；缺少事实时使用request_evidence。每次选取最多5处最值得优化的真实表达，每条建议适度精炼，不要重复整份简历；如无可用建议返回空数组。仅返回JSON对象（不要Markdown），字段suggestions数组，每条必须含id,blockId,action,original,proposed,rationale,jobRequirement,evidenceStatus。对于不确定事实一律标注needs_user_confirmation。';
 const input=JSON.stringify({blocks,job:{title:job.title,requirements:job.requirements}});
 let url,headers,body;
 if(provider.protocol==='anthropic'){
  url=provider.baseUrl+'/messages';
  headers={'content-type':'application/json','x-api-key':provider.key,'anthropic-version':'2023-06-01'};
  body={model:provider.model,max_tokens:2200,system,messages:[{role:'user',content:input}]};
 }else{
  url=provider.baseUrl+'/chat/completions';
  headers={'content-type':'application/json',authorization:'Bearer '+provider.key};
  body={model:provider.model,messages:[{role:'system',content:system},{role:'user',content:input}],...(provider.name==='openai'?{max_completion_tokens:2200}:{max_tokens:3200}),...(provider.name==='deepseek'?{response_format:{type:'json_object'},thinking:{type:'disabled'}}:{})};
 }
 let response;
 try{
  response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal,redirect:'manual'});
 }catch(e){
  throw new Error(e?.name==='TimeoutError'||e?.name==='AbortError'?
   'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK_ERROR');
 }
 // Workerd does not implement redirect:'error'. Manual redirects must be
 // rejected explicitly to prevent a provider key ever leaving its origin.
 if(response.status>=300&&response.status<400)throw new Error('AI_PROVIDER_UNEXPECTED_REDIRECT');
 // No upstream response body or URL (potentially containing PII) is exposed.
 if(!response.ok){
  const status=response.status;
  if(status===400||status===422)throw new Error('AI_PROVIDER_REQUEST_REJECTED');
  if(status===401||status===403)throw new Error('AI_PROVIDER_KEY_REJECTED');
  if(status===402)throw new Error('AI_PROVIDER_BALANCE_INSUFFICIENT');
  if(status===429)throw new Error('AI_PROVIDER_RATE_LIMITED');
  if(status>=500)throw new Error('AI_PROVIDER_UPSTREAM_ERROR');
  throw new Error('AI_PROVIDER_REQUEST_FAILED');
 }
 let data;
 try{data=await response.json();}catch{throw new Error('AI_PROVIDER_RESPONSE_HTTP_INVALID');}
 const output=provider.protocol==='anthropic'?data?.content?.filter(x=>x.type==='text').map(x=>x.text).join(''):data?.choices?.[0]?.message?.content;
 if(data?.choices?.[0]?.finish_reason==='length')throw new Error('AI_PROVIDER_RESPONSE_TRUNCATED');
 if(typeof output!=='string'||!output.trim())throw new Error('AI_PROVIDER_RESPONSE_EMPTY');
 let parsed;
 try{parsed=JSON.parse(output.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g,''));}
 catch{throw new Error('AI_PROVIDER_RESPONSE_JSON_INVALID');}
 let suggestions;
 try{suggestions=parseSuggestions(parsed,blocks.map(b=>b.id));}
 catch{throw new Error('AI_PROVIDER_SUGGESTION_SCHEMA_INVALID');}
 return {provider:provider.name,suggestions};
}
