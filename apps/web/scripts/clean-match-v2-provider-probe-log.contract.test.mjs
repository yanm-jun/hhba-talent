import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeProviderProbe,recordProviderProbe,readRecentProviderProbes}
 from '../functions/_lib/clean-match-v2-provider-probe-log.js';
import {readFileSync} from 'node:fs';

test('provider logs contain only sanitized stage, status and counters',()=>{
 const v=sanitizeProviderProbe({
  kind:'CANDIDATE_PREFLIGHT',outcome:'FAILED',stage:'basic_responses',
  error_code:'AI_PROVIDER_UPSTREAM_ERROR',upstream_status:503,duration_ms:48,
  api_key:'SECRET',resume:'PRIVATE_CV',error_body:'SECRET',email:'person@example.com'
 });
 assert.deepEqual(v,{
  kind:'CANDIDATE_PREFLIGHT',outcome:'FAILED',stage:'basic_responses',
  error_code:'AI_PROVIDER_UPSTREAM_ERROR',upstream_status:503,duration_ms:48,
  sources_returned:0
 });
 assert.equal(JSON.stringify(v).includes('SECRET'),false);
 assert.equal(JSON.stringify(v).includes('person@example.com'),false);
});

test('provider logs reject untrusted status, stage and error text',()=>{
 assert.deepEqual(sanitizeProviderProbe({
  kind:'other',outcome:'FAILED',stage:'<script>',upstream_status:1337,
  error_code:'KEY=foo https://example.com',duration_ms:-20,sources_returned:100
 }),{
  kind:'CANDIDATE_PREFLIGHT',outcome:'FAILED',stage:'unknown',
  error_code:null,upstream_status:null,duration_ms:0,sources_returned:0
 });
});

test('provider probe writes anonymous D1 data without any credential',async()=>{
 const captured=[];
 const db={prepare(sql){return {bind(...args){return {async run(){captured.push({sql,args})}}}}}};
 await recordProviderProbe(db,{kind:'CANDIDATE_PREFLIGHT',outcome:'FAILED',
  stage:'structured_json',error_code:'AI_PROVIDER_UPSTREAM_ERROR',
  upstream_status:502,duration_ms:71,
  token:'never-persist',person:'never-persist',prompt:'never-persist'});
 assert.equal(captured.length,1);
 assert.match(captured[0].sql,/INSERT INTO hhba_match_v2_provider_probes/);
 assert.equal(captured[0].args.length,9);
 assert.ok(!JSON.stringify(captured).includes('never-persist'));
 assert.match(captured[0].args[0],/^[0-9a-f-]{36}$/);
});

test('operator read returns only bounded, sanitized log records',async()=>{
 const db={prepare(sql){return {bind(n){assert.equal(n,20);
  return {async all(){return {results:[{
   id:'safe-id',tested_at:'2026-11-24T00:00:00.000Z',
   kind:'CANDIDATE_PREFLIGHT',outcome:'FAILED',stage:'basic_responses',
   error_code:'AI_PROVIDER_UPSTREAM_ERROR',upstream_status:503,duration_ms:31,
   sources_returned:0,private_token:'DO_NOT_INCLUDE'
  }]}}}}}}};
 const results=await readRecentProviderProbes(db,20);
 assert.equal(results.length,1);
 assert.equal(results[0].upstream_status,503);
 assert.ok(!JSON.stringify(results).includes('DO_NOT_INCLUDE'));
});

test('D1 migration is preview-only operationally and has no PII columns',()=>{
 const sql=readFileSync(new URL('../d1/0032_match_v2_provider_probe_logs.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS hhba_match_v2_provider_probes/);
 assert.doesNotMatch(sql,/\b(?:user_id|phone|email|api_key|resume_text|prompt|response_body)\b/i);
});
