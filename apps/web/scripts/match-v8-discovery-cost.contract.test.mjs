import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 V8_USAGE_LIMITS,PRICE_SNAPSHOT,SEARCH_FETCH_CNY_PER_SUCCESS,
 isPeakBeijingTime,emptyV8CostMeter,observeV8ModelUsage,buildV8CostReport
} from '../functions/_lib/deepseek-discovery-billing.js';

test('V8 resource ceilings are model 4, Search 8, Fetch 20',()=>{
 assert.deepEqual(V8_USAGE_LIMITS,{model:4,search:8,fetch:20});
});
test('counts billable Search/Fetch separately from attempts; costs based on actual successes',()=>{
 const m=emptyV8CostMeter();
 observeV8ModelUsage(m,{input_tokens:1200,input_tokens_details:{cached_tokens:400},
  output_tokens:180},new Date('2026-11-08T11:00:00Z'));
 m.billable_search=2;m.billable_fetch=3;
 const report=buildV8CostReport({model:1,search:8,fetch:20},m);
 assert.deepEqual(report.attempts,{model:1,search:8,fetch:20});
 assert.deepEqual(report.billable,{search:2,fetch:3});
 assert.deepEqual(report.tokens,{input:1200,cached_input:400,output:180});
 assert.equal(SEARCH_FETCH_CNY_PER_SUCCESS,0.005);
 assert.equal(report.search_fetch_estimated_cny,0.025);
 assert.equal(report.model_estimated_cny,0.00609);
 assert.equal(report.estimated_total_cny,0.03109);
 assert.equal(report.peak_price_upper_estimate_cny,0.03718);
 assert.equal(report.basis,PRICE_SNAPSHOT);
 assert.equal(report.kind,'PROVIDER_USAGE_BASED_ESTIMATE');
 assert.equal(report.complete,true);
});
test('peak price quote reports more than weekend/offpeak and is not called an invoice',()=>{
 assert.equal(isPeakBeijingTime(new Date('2026-11-08T02:00:00Z')),false); // Sunday
 assert.equal(isPeakBeijingTime(new Date('2026-11-09T02:00:00Z')),true); // Mon 10 Beijing
 assert.equal(isPeakBeijingTime(new Date('2026-11-09T05:00:00Z')),false); // Mon 13 Beijing
 assert.equal(isPeakBeijingTime(new Date('2026-11-09T07:00:00Z')),true); // Mon 15 Beijing
 const m=emptyV8CostMeter();
 observeV8ModelUsage(m,{input_tokens:1000,input_tokens_details:{cached_tokens:0},
  output_tokens:500},new Date('2026-11-09T02:00:00Z'));
 const r=buildV8CostReport({model:1,search:0,fetch:0},m);
 assert.equal(r.model_estimated_cny,0.0225);
 assert.equal(r.estimated_total_cny,0.0225);
 assert.equal(r.peak_price_upper_estimate_cny,0.0225);
 assert.match(r.note,/账单/);
});
test('failed or missing provider usage does not produce a false complete cost record',()=>{
 const m=emptyV8CostMeter();
 observeV8ModelUsage(m,undefined,new Date('2026-11-08T11:00:00Z'));
 const r=buildV8CostReport({model:1,search:0,fetch:0},m);
 assert.equal(r.complete,false);
 assert.equal(r.estimated_total_cny,0);
 assert.equal(buildV8CostReport({model:2,search:0,fetch:0},emptyV8CostMeter(),
  {uncertain_provider_failure:true}).complete,false);
});
test('D1 accounting migration retains only numeric usage and salted account identifiers',async()=>{
 const schema=await readFile(new URL('../d1/0019_match_v8_discovery_accounting.sql',import.meta.url),'utf8');
 assert.match(schema,/CREATE TABLE IF NOT EXISTS hhba_match_discovery_accounting/);
 assert.match(schema,/model_attempts INTEGER/);
 assert.match(schema,/search_attempts INTEGER NOT NULL CHECK\(search_attempts BETWEEN 0 AND 8\)/);
 assert.match(schema,/fetch_attempts INTEGER NOT NULL CHECK\(fetch_attempts BETWEEN 0 AND 20\)/);
 assert.match(schema,/billable_search/);
 assert.match(schema,/model_cached_input_tokens/);
 assert.match(schema,/total_estimated_cny/);
 assert.match(schema,/estimate_complete/);
 assert.doesNotMatch(schema,/resume_text|search_query|job_url|telephone|email_address/);
});
