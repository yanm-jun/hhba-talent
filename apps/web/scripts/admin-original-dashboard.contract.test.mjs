import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const dir=new URL('../../../apps/admin-preview/',import.meta.url);
const read=p=>readFile(new URL(p,dir),'utf8');
test('exact GitHub Pages /admin-preview/ source and seven original navigation groups remain',async()=>{
 const html=await read('index.html'),js=await read('dashboard.js'),css=await read('styles.css');
 for(const x of ['Management Console','数据总览','用户分析','岗位与企业','运营监控','财务成本','融资展示','系统设置'])
  assert(html.includes(x),'missing ORIGINAL admin UI '+x);
 for(const x of ['jobs-count','boards-count','registered-users','active-users','ov-pv','ov-saves','view-users','growth-pv','growth-saves','users-chart','investor-jobs'])
  assert(html.includes('id="'+x+'"'),'missing connected original admin slot: '+x);
 assert(js.includes("fetch('/api/overview'"),'GitHub Pages canonical transform anchor lost');
 assert(js.includes("fetch('/api/metrics/public'"),'Cloudflare public API unconnected');
 assert(js.includes("fetch('/admin-preview/api/metrics?'"),'Cloudflare protected D1 metrics unconnected');
 assert(js.includes("setView(node.dataset.view)"),'original navigation broken');
 assert(css.includes('.kpi-grid')&&css.includes('.sidebar'),'original stylesheet lost');
 assert(!html.includes('admin-metrics/'),'duplicate dashboard prohibited');
});
test('Cloudflare deployment publishes the SAME original source in /admin-preview/',async()=>{
 const source=await readFile(new URL('../scripts/cloudflare-pages-build.py',import.meta.url),'utf8');
 assert(source.includes('original_admin = REPO / "apps" / "admin-preview"'));
 assert(source.includes('cloudflare_admin = WEB / "dist" / "admin-preview"'));
 assert(source.includes('HHBA_CLOUDFLARE_ORIGINAL_ADMIN_READY=/admin-preview/'));
});
test('keeps missing registered users and DAU/MAU as unknown; no fake counts',async()=>{
 const html=await read('index.html'),js=await read('dashboard.js');
 assert(html.includes('id="registered-users">—</div>'));
 assert(html.includes('id="active-users">— / —</div>'));
 assert(js.includes("a?.quality==='collected'?a.registeredUsers:null"));
 assert(js.includes("a?.quality==='collected'&&integer(a.dau)"));
 assert(js.includes('PRIVATE_METRICS_REQUIRE_AUTH'));
});
test('removed separate dashboard and restored other pre-existing preview',async()=>{
 await assert.rejects(stat(new URL('../public/admin-metrics/index.html',import.meta.url)),/ENOENT/);
 const other=await readFile(new URL('../public/preview-admin/unified-workbench.js',import.meta.url),'utf8');
 assert(other.includes('招聘业务')&&other.includes('双评分'),'other existing independent preview preserved');
});
