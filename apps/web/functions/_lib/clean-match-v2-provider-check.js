/**
 * Explicit, candidate-authorized DeepSeek Search/Fetch/Responses readiness
 * probe. Runs only on demand and never sends a résumé, name, or user URL.
 * Unlike the previous static READY answer, every declared capability
 * must actually succeed before enabling a green result.
 */
import {checkMatchProviderCapabilities,providerStatusError}
 from './match-provider-preflight.js';
import {checkOpenAIMatchProvider} from './openai-match-adapter.js';

const PUBLIC_TEST_URL='https://api-docs.deepseek.com/zh-cn/guides/search/';
const fail=code=>Object.assign(new Error(code),{code});
export const MATCH_V2_PREFLIGHT='HHBA_MATCH_V2_LIVE_PROVIDER_PREFLIGHT';

export async function checkCleanMatchProvider(key,{
 fetcher=fetch,signal=null,fetchTimeoutMs=12000
}={}){
 if(key?.name==='openai')return checkOpenAIMatchProvider(key,{fetcher,signal});
 const vendorKey=typeof key==='string'?key:key?.key;
 const base=await checkMatchProviderCapabilities(vendorKey,{
  fetcher,signal,timeoutMs:15000
 });
 const timeout=AbortSignal.timeout(fetchTimeoutMs);
 const merged=signal?AbortSignal.any([signal,timeout]):timeout;
 let response;
 try{
  response=await fetcher('https://api.deepseek.com/v1/tools/fetch',{
   method:'POST',redirect:'manual',signal:merged,
   headers:{Authorization:'Bearer '+key,
    Accept:'application/json','Content-Type':'application/json'},
   body:JSON.stringify({url:PUBLIC_TEST_URL})
  });
 }catch{
  throw fail(signal?.aborted?'AI_MATCH_CANCELLED':'AI_FETCH_TIMEOUT');
 }
 if(!response.ok){
  // Fetch 403 may be a target-site security block, not a rejected API key.
  if(response.status===403)throw fail('AI_FETCH_ACCESS_DENIED');
  const code=providerStatusError(response.status);
  throw fail(code==='AI_SEARCH_API_REJECTED'?'AI_FETCH_API_REJECTED':code);
 }
 let payload;
 try{payload=await response.json()}catch{throw fail('AI_FETCH_RESPONSE_INVALID')}
 if(typeof payload?.content!=='string'||payload.content.trim().length<80)
  throw fail('AI_FETCH_RESPONSE_INVALID');
 return {ok:true,status:'READY',kind:MATCH_V2_PREFLIGHT,
  capabilities:[...base.capabilities,'deepseek_fetch'],
  searches_returned:base.searches_returned,
  fetch_content_verified:true};
}
