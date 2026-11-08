// DeepSeek V8 public job discovery usage-based price estimate.
// Provider billing is authoritative; never represent an estimate as an invoice.
export const V8_USAGE_LIMITS=Object.freeze({model:4,search:8,fetch:20});
export const PRICE_SNAPSHOT='DEEPSEEK_CNY_2026_11_08';
export const SEARCH_FETCH_CNY_PER_SUCCESS=0.005;
const MODEL_PRICE={
 peak:{uncached:9,cached:0.30,output:27},
 offpeak:{uncached:4.5,cached:0.15,output:13.5}
}; // CNY per 1 million tokens, deepseek-v4-pro; official snapshot.
export function isPeakBeijingTime(date=new Date()){
 const dt=date instanceof Date?date:new Date(date);
 if(!Number.isFinite(dt.getTime()))return false;
 // Official Mon-Fri: 09:00-12:00 and 14:00-18:00 (Beijing).
 // Chinese public holidays are not built in, so we also report peak upper bound.
 const weekday=new Date(dt.getTime()+8*3600000).getUTCDay();
 const hours=(dt.getUTCHours()+8)%24;
 return weekday>=1&&weekday<=5&&(hours>=9&&hours<12||hours>=14&&hours<18);
}
const valid=(n,max=100000000)=>Number.isInteger(n)&&n>=0&&n<=max?n:0;
const round=(n)=>Math.round((n+Number.EPSILON)*1000000)/1000000;
export function emptyV8CostMeter(){
 return {model_input_tokens:0,model_cached_input_tokens:0,model_output_tokens:0,
  model_responses_with_usage:0,missing_model_usage:0,
  billable_search:0,billable_fetch:0,model_estimated_cny:0,model_peak_ceiling_cny:0};
}
export function observeV8ModelUsage(meter,raw,date=new Date()){
 const input=valid(raw?.input_tokens),cached=Math.min(input,valid(raw?.input_tokens_details?.cached_tokens));
 const output=valid(raw?.output_tokens);
 if(!raw||!Number.isInteger(raw.input_tokens)||!Number.isInteger(raw.output_tokens)){
  meter.missing_model_usage++;return;
 }
 const basis=isPeakBeijingTime(date)?MODEL_PRICE.peak:MODEL_PRICE.offpeak;
 const cost=(input-cached)*basis.uncached/1000000+
  cached*basis.cached/1000000+output*basis.output/1000000;
 const ceiling=(input-cached)*MODEL_PRICE.peak.uncached/1000000+
  cached*MODEL_PRICE.peak.cached/1000000+output*MODEL_PRICE.peak.output/1000000;
 meter.model_input_tokens+=input;
 meter.model_cached_input_tokens+=cached;
 meter.model_output_tokens+=output;
 meter.model_responses_with_usage++;
 meter.model_estimated_cny+=cost;
 meter.model_peak_ceiling_cny+=ceiling;
}
export function buildV8CostReport(usage,meter,{uncertain_provider_failure=false}={}){
 const apiCost=(meter.billable_search+meter.billable_fetch)*SEARCH_FETCH_CNY_PER_SUCCESS;
 return {
  basis:PRICE_SNAPSHOT,currency:'CNY',kind:'PROVIDER_USAGE_BASED_ESTIMATE',
  attempts:{model:valid(usage.model,4),search:valid(usage.search,8),fetch:valid(usage.fetch,20)},
  billable:{search:valid(meter.billable_search,8),fetch:valid(meter.billable_fetch,20)},
  tokens:{input:valid(meter.model_input_tokens),cached_input:valid(meter.model_cached_input_tokens),
   output:valid(meter.model_output_tokens)},
  search_fetch_estimated_cny:round(apiCost),
  model_estimated_cny:round(meter.model_estimated_cny),
  estimated_total_cny:round(meter.model_estimated_cny+apiCost),
  peak_price_upper_estimate_cny:round(meter.model_peak_ceiling_cny+apiCost),
  complete:!uncertain_provider_failure&&meter.missing_model_usage===0,
  note:'按成功且有内容的 Search/Fetch 与模型返回的实际 Token 用量估算；中国法定节假日、服务商调价、超时后可能仍计费等以 DeepSeek 账单为准'
 };
}
