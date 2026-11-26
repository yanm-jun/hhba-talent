import test from 'node:test';
import assert from 'node:assert/strict';
import {v4Call,isV4RetryableProviderError} from '../functions/_lib/simple-match-v4.js';
const provider={kind:'openai',model:'gpt-6.2-sol',baseUrl:'https://provider.invalid/v1',key:'synthetic-only'};
test('V4 distinguishes key, balance, rate and transient failures from no-job results',async()=>{
 for(const [status,code,retryable] of [[401,'AI_PROVIDER_KEY_REJECTED',false],[402,'AI_PROVIDER_BALANCE_INSUFFICIENT',false],[429,'AI_PROVIDER_RATE_LIMITED',true],[503,'AI_PROVIDER_UPSTREAM_ERROR',true]]){
  let calls=0;
  await assert.rejects(v4Call(async()=>{calls++;return new Response('{}',{status});},provider,{input:'synthetic'}),{code});
  assert.equal(calls,1);assert.equal(isV4RetryableProviderError(code),retryable);
 }
});
