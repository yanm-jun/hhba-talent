import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readAiUsage} from '../functions/_lib/ai-token-usage.js';
import {onRequestGet} from '../functions/api/admin/metrics.js';
test('dedicated admin metrics cannot query without password session',async()=>{
 let queries=0;
 const env={HHBA_ADMIN_CONSOLE_ENABLED:'1',HHBA_ADMIN_AUTH_MODE:'password',HHBA_ADMIN_AUTH_DB:{prepare(){throw Error('unexpected query')}},HHBA_METRICS_DB:{prepare(){queries++;throw Error('unauthorized')}}};
 const response=await onRequestGet({request:new Request('https://admin.hhba.work/admin-preview/api/metrics?days=30'),env});
 assert.ok([401,403,503].includes(response.status));assert.equal(queries,0);
});
test('aggregate read uses existing metrics database and no mock data',async()=>{
 const row={day:'2026-11-25',model:'gpt-6.2-sol',stage:'score',effort:'medium',status:'completed',calls:1,usage_calls:1,total_tokens:100};
 const db={prepare(sql){assert.match(sql,/hhba_ai_usage_daily/);return {bind(a,b){assert.equal(a,'2026-11-25');assert.equal(b,a);return this},all:async()=>({results:[row]})}}};
 const env={HHBA_ADMIN_CONSOLE_ENABLED:'1',HHBA_ADMIN_AUTH_DB:{},HHBA_METRICS_DB:db};
 assert.deepEqual((await readAiUsage(env,'2026-11-25','2026-11-25')).rows,[row]);
 assert.equal((await readAiUsage({},'2026-11-25','2026-11-25')).quality,'unavailable');
});
test('production dashboard has native token navigation and manual authenticated read',async()=>{
 const html=await readFile(new URL('../../../apps/admin-preview/index.html',import.meta.url),'utf8');
 const js=await readFile(new URL('../../../apps/admin-preview/dashboard.js',import.meta.url),'utf8');
 assert.match(html,/data-view="ai-usage"/);assert.match(html,/id="view-ai-usage"/);assert.match(html,/id="ai-usage-refresh"/);
 assert.match(js,/['"]ai-usage['"].*includes\(view\)/);assert.match(js,/fetch\('\/admin-preview\/api\/metrics\?days='/);
 assert.match(js,/credentials:'same-origin'/);
});
