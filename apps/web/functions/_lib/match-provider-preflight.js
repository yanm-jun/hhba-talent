/**
 * Candidate-initiated DeepSeek capability check, NOT a public health probe.
 * Never sends résumé or personal data. Checks both funds and the actual
 * Search tool needed to execute an HHBA job match.
 */
const BASE='https://api.deepseek.com';
const codeError=(code)=>Object.assign(new Error(code),{code});
export function providerStatusError(status){
 if(status===401||status===403)return 'AI_PROVIDER_KEY_REJECTED';
 if(status===402)return 'AI_PROVIDER_BALANCE_INSUFFICIENT';
 if(status===429)return 'AI_PROVIDER_RATE_LIMITED';
 if([400,404,405,422].includes(status))return 'AI_SEARCH_API_REJECTED';
 return 'AI_PROVIDER_UNAVAILABLE';
}
export async function checkMatchProviderCapabilities(key,{
 fetcher=fetch,signal=null,timeoutMs=15000
}={}){
 const deadline=AbortSignal.timeout(timeoutMs);
 const sig=signal?AbortSignal.any([signal,deadline]):deadline;
 const request=async(path,init)=>{
  let response;
  try{
   response=await fetcher(BASE+path,{...init,redirect:'manual',signal:sig,
    headers:{Authorization:'Bearer '+key,Accept:'application/json',
     ...(init?.body?{'Content-Type':'application/json'}:{})}});
  }catch(e){
   if(signal?.aborted)throw e;
   throw codeError(e?.name==='TimeoutError'||e?.name==='AbortError'?
    'AI_PROVIDER_TIMEOUT':'AI_PROVIDER_NETWORK_ERROR');
  }
  if(!response.ok){
   const code=providerStatusError(response.status);
   throw codeError(path==='/responses'&&code==='AI_SEARCH_API_REJECTED'?
    'AI_PROVIDER_REQUEST_REJECTED':code);
  }
  try{return await response.json()}
  catch{throw codeError('AI_SEARCH_RESPONSE_INVALID')}
 };
 // Check actual permission for Search; balance alone can be READY even when
 // this API is disabled, rejects the request shape or has no tool access.
 const [balance,search,model]=await Promise.all([
  request('/user/balance',{method:'GET'}),
  request('/v1/tools/search',{method:'POST',body:JSON.stringify({
   query:'中国大陆 企业招聘 岗位职责 官方招聘',count:1,need_content:false
  })}),
  request('/responses',{method:'POST',body:JSON.stringify({
   model:'deepseek-v4-pro',reasoning:{effort:'none'},
   text:{format:{type:'json_object'}},max_output_tokens:96,stream:false,
   instructions:'仅回复一个JSON对象。',input:'健康检查：回复 {"ok":true}'
  })})
 ]);
 if(balance?.is_available!==true)throw codeError('AI_PROVIDER_BALANCE_INSUFFICIENT');
 if(!Array.isArray(search?.results))throw codeError('AI_SEARCH_RESPONSE_INVALID');
 // An HTTP 200 with only reasoning tokens, incomplete status or an
 // empty output array does not prove that the model can return a usable JSON
 // recommendation. Check the actual terminal response and JSON payload.
 if(model?.status!=='completed'||!Array.isArray(model.output))
  throw codeError('AI_PROVIDER_RESPONSE_INVALID');
 const answer=model.output.filter(x=>x?.type==='message')
  .flatMap(x=>(x.content||[]).filter(y=>y?.type==='output_text')
   .map(y=>typeof y.text==='string'?y.text:'')).join('');
 let parsed;
 try{parsed=JSON.parse(answer)}catch{throw codeError('AI_PROVIDER_RESPONSE_INVALID')}
 if(parsed?.ok!==true)throw codeError('AI_PROVIDER_RESPONSE_INVALID');
 return {ok:true,status:'READY',capabilities:['balance','deepseek_search','v4_pro_responses_json'],
  searches_returned:search.results.length};
}
