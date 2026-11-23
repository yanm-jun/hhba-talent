/**
 * Preview-only, explicitly user-authorized official OpenAI readiness check.
 * No résumé, private account info, API key or candidate job history is sent.
 * This is NOT end-to-end proof that public employer sites can be parsed.
 */
import {openAIJson,openAIEmployerSearch} from './openai-match-v2-provider.js';
export const MATCH_V2_PREFLIGHT='HHBA_OPENAI_V2_LIVE_PROVIDER_PREFLIGHT';
const fail=code=>Object.assign(new Error(code),{code});
export async function checkCleanMatchProvider(provider,{
 fetcher=fetch,signal=null
}={}){
 const check=await openAIJson(fetcher,provider,
  '仅返回 JSON 对象：{"ok":true}。不要输出其他内容。',
  {task:'public model API readiness check; no user information'},20000,signal);
 if(check?.ok!==true)throw fail('AI_PROVIDER_RESPONSE_INVALID');
 // The hosted tool needs its own live check: plain JSON success is not Search.
 const search=await openAIEmployerSearch(fetcher,provider,
  '腾讯官网 社会招聘 职位详情',signal);
 if(!Array.isArray(search?.results)||!search.results.length)
  throw fail('AI_SEARCH_EMPTY_SOURCES');
 return {ok:true,status:'READY',kind:MATCH_V2_PREFLIGHT,
  capabilities:['openai_responses_json','openai_web_search_sources'],
  searches_returned:search.results.length,
  fetch_content_verified:false};
}
