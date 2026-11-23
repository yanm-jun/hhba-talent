/**
 * Compact, non-secret configuration for HHBA Match V2 on Cloudflare Pages Free.
 *
 * Workers Free counts secret + plain bindings together. A JSON text binding
 * carries only the V2 model/approved base URL and preview release flags.
 * Never put a token or private candidate data in this value.
 *
 * Old individual env flags remain supported for rollback and unit fixtures.
 * The compact preview flags are NEVER trusted for production enablement.
 */
export function matchV2Runtime(env){
 let compact={};
 const raw=env?.HHBA_MATCH_V2_RUNTIME;
 if(typeof raw==='string'&&raw.length>0&&raw.length<=1024){
  try{
   const parsed=JSON.parse(raw);
   if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))compact=parsed;
  }catch{}
 }
 const preview=env?.HHBA_AUTH_ROLLOUT==='preview'&&
  env?.HHBA_PREVIEW_AI_DIAG_ENABLED==='1';
 return {
  baseUrl:env?.HHBA_MATCH_OPENAI_BASE_URL||compact.baseUrl||'https://api.openai.com/v1',
  model:env?.HHBA_MATCH_OPENAI_MODEL||compact.model||'gpt-6.2-astra',
  matchEnabled:env?.HHBA_MATCH_CLEAN_V2_ENABLED==='1'||
   (preview&&compact.matchEnabled===true),
  wordEnabled:env?.HHBA_MATCH_OPENAI_WORD_V2_ENABLED==='1'||
   (preview&&compact.wordEnabled===true)
 };
}
