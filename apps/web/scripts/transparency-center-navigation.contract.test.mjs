import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=(path)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');
const publicPage=source('pages/TransparencyPage.tsx');
const demoPage=source('pages/AidArchiveDemoPage.tsx');
const shell=source('components/Shell.tsx');
const publicCss=source('styles/transparency.css');

test('responsibility and transparency is visible in visitor and candidate top navigation',()=>{
 assert.equal((shell.match(/className="auth hhba-nav-transparency"/g)||[]).length,2);
 assert.equal((shell.match(/to="\/transparency" aria-current/g)||[]).length,2);
 assert.match(shell,/to="\/transparency" className="hhba-fin-footer-link"/);
});

test('official landing has four indexed anchors with actual destination sections',()=>{
 const entries=['public-case-register','public-fund-register','fin-latest-title','public-policy-monitor'];
 for(const id of entries){
  assert.match(publicPage,new RegExp('href="#'+id+'"'));
  assert.match(publicPage,new RegExp('id="'+id+'"'));
 }
 assert.match(publicPage,/className="hhba-resp-open-index-list"/);
 assert.match(publicCss,/\.hhba-resp-open-index-list/);
});

test('only published real reports feed the official fund register',()=>{
 assert.match(publicPage,/fetch\(endpoint\('\/reports'\)/);
 assert.match(publicPage,/reports\.map\(item=><tr key=\{item\.period\}>/);
 for(const key of ['poolReceivedFen','poolSpentFen','closingPoolFen'])assert.match(publicPage,new RegExp('yuan\\(item\\.'+key+'\\)'));
 assert.match(publicPage,/暂无已发布的资金收支报告/);
 assert.match(publicPage,/目前无法核验资金公开记录/);
 assert.doesNotMatch(publicPage,/HHBA-DEMO-OUT-|HHBA-DEMO-001|111350|111,350/);
});

test('official case register is empty until real anonymized files are published',()=>{
 assert.match(publicPage,/暂无通过公开审核的案例档案/);
 assert.match(publicPage,/本中心目前没有可公开查阅的真实个案/);
 assert.match(publicPage,/演示情景填充/);
 assert.match(publicPage,/to="\/transparency\/archive-preview\?view=cases"/);
 assert.match(publicPage,/所有人员、争议、金额和结果均非真实业务/);
});

test('demo deep link opens case directory directly and keeps case-to-fund traceability',()=>{
 assert.match(demoPage,/view==='cases'\|\|view==='funds'/);
 assert.match(demoPage,/setArchiveUrl\(next\)/);
 assert.match(demoPage,/setArchiveUrl\(null\)/);
 assert.match(demoPage,/onOpenFunds=\{\(\)=>open\('funds'\)\}/);
 assert.match(demoPage,/返回模拟资金流水/);
 assert.match(demoPage,/查看关联案件/);
 assert.match(demoPage,/情景模拟，非真实案例/);
});
