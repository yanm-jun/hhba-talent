import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {onRequest} from '../functions/admin-preview/api/financial/[[path]].js';
import {cleanPeriodPayload} from '../functions/_lib/transparency.js';

const dir=dirname(fileURLToPath(import.meta.url));
const read=path=>readFileSync(resolve(dir,path),'utf8');

test('unified finance is inside the ORIGINAL admin cost view; prior KV register preserved',()=>{
 const html=read('../../../apps/admin-preview/index.html');
 const src=read('../../../apps/admin-preview/finance-report.js');
 const builder=read('../scripts/build-standalone-admin.py');
 const original=read('../../../apps/admin-preview/finance.js');
 assert.match(html,/id="view-finance"/);
 assert.match(html,/id="hhba-fin-report-root"/);
 assert.match(html,/src="\/finance\.js"/);
 assert.match(html,/src="\/finance-report\.js"/);
 assert.match(src,/\/admin-preview\/api\/financial\//);
 assert.doesNotMatch(src,/hhba\.work\/transparency\/manage/);
 assert.match(original,/\/admin-preview\/api\/finance/);
 assert.match(builder,/finance-report\.js/);
 assert.match(builder,/finance-report\.css/);
 assert.match(html,/财务成本/);
});
test('finance disclosure API validates password session, dedicated hostname and finance owner',async()=>{
 const request=new Request('https://admin.hhba.work/admin-preview/api/financial/status');
 const response=await onRequest({request,env:{}});
 assert.equal(response.status,401);
 const text=read('../functions/admin-preview/api/financial/[[path]].js');
 assert.match(text,/verifyAdmin\(request,env\)/);
 assert.match(text,/hostname!=='admin\.hhba\.work'/);
 assert.match(text,/HHBA_FINANCE_ADMIN_EMAIL/);
 assert.match(text,/financeDb\(env\)/);
 assert.match(text,/publishReviewed\(db/);
 assert.match(text,/safeOrigin\(request\)/);
 assert.doesNotMatch(text,/HHBA_METRICS_DB/);
});
test('publication still rejects inconsistent, estimated or impossible finance figures',()=>{
 const sample={period:'2026-10',
  revenueFen:100000,refundFen:10000,aiCostFen:8000,infrastructureFen:2000,
  personnelFen:10000,operationsFen:5000,taxesFen:5000,otherCostFen:0,
  adjustmentsFen:0,netResultFen:60000,distributableProfitFen:0,
  openingPoolFen:20000,poolReceivedFen:0,poolSpentFen:0,closingPoolFen:20000,
  beneficiaries:0,basisNote:'合法分配利润按相关法定程序单独核对',
  methodNote:'财务经营费用根据真实原始凭证进行逐项核对',
  poolNote:'帮扶池累计实际结余及分配变动依据真实凭证核对',
  privacyReviewNote:'人工已逐项审查敏感客户信息是否泄露',isAudited:false
 };
 assert.equal(cleanPeriodPayload(sample)?.netResultFen,60000);
 assert.equal(cleanPeriodPayload({...sample,netResultFen:999}),null);
 assert.equal(cleanPeriodPayload({...sample,closingPoolFen:999}),null);
 assert.equal(cleanPeriodPayload({...sample,isAudited:null}),null);
});
test('standalone admin build emits new finance assets',()=>{
 const base=resolve(dir,'../dist/admin-preview');
 if(!existsSync(base))return;
 const html=readFileSync(resolve(base,'index.html'),'utf8');
 assert.match(html,/\.\/finance-report\.js/);
 assert.match(html,/\.\/finance-report\.css/);
 assert.match(html,/hhba-fin-report-root/);
 assert.ok(existsSync(resolve(base,'finance-report.js')));
 assert.ok(existsSync(resolve(base,'finance-report.css')));
});
