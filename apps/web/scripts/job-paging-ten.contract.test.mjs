import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JOBS_PER_PAGE,FETCH_BATCH_SIZE,pageCount,batchOffsetForPage,
 sliceJobsForPage,validJumpPage,visiblePageTokens} from '../src/services/jobPaging.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('32 actual filtered jobs are displayed 10 / 10 / 10 / 2 without duplicates or missing IDs',()=>{
 const records=Array.from({length:32},(_,i)=>({id:'job-'+(i+1)}));
 const result=[];
 assert.equal(JOBS_PER_PAGE,10);
 assert.equal(FETCH_BATCH_SIZE,30);
 assert.equal(pageCount(records.length),4);
 for(let page=0;page<4;page++){
  const offset=batchOffsetForPage(page);
  const serverBatch=records.slice(offset,offset+FETCH_BATCH_SIZE);
  const displayed=sliceJobsForPage(serverBatch,page);
  assert.equal(displayed.length,page===3?2:10,'page '+page);
  result.push(...displayed.map(x=>x.id));
 }
 assert.deepEqual(result,records.map(x=>x.id));
 assert.equal(new Set(result).size,32);
 assert.deepEqual([0,1,2,3].map(batchOffsetForPage),[0,0,0,30]);
});
test('direct jumps and page windows always stay within the actual total',()=>{
 assert.equal(validJumpPage('4',32),3);
 assert.equal(validJumpPage('1',32),0);
 for(const value of ['0','5','-1','2.5','abc','1e2','','9999999999'])
  assert.equal(validJumpPage(value,32),null,value);
 assert.deepEqual(visiblePageTokens(0,32),[1,2,3,4]);
 assert.deepEqual(visiblePageTokens(5,120),[1,'dots',4,5,6,7,8,'dots',12]);
 assert.equal(pageCount(0),0);
 assert.equal(pageCount(10),1);
 assert.equal(pageCount(11),2);
 assert.equal(pageCount(1000),100);
 assert.throws(()=>batchOffsetForPage(-1),RangeError);
});
test('filtered results use the same ten-item page math without leaking previous filters',()=>{
 const jobs=Array.from({length:78},(_,i)=>({id:'role-'+i,major:i%2?'逻辑学':'机械工程',city:i%3?'杭州':'上海'}));
 const chosen=jobs.filter(x=>x.major==='逻辑学'&&x.city==='杭州');
 const all=[];
 for(let page=0;page<pageCount(chosen.length);page++){
  all.push(...sliceJobsForPage(chosen.slice(batchOffsetForPage(page),
    batchOffsetForPage(page)+FETCH_BATCH_SIZE),page));
 }
 assert.deepEqual(all,chosen);
 assert.ok(all.every(x=>x.major==='逻辑学'&&x.city==='杭州'));
});
test('compact cards, direct role access, persistent filters, mobile layout and real page jump are wired',()=>{
 const market=read('src/components/UnifiedJobMarket.tsx');
 const pager=read('src/components/JobResultPagination.tsx');
 const css=read('src/styles/unified-jobs.css');
 assert.match(market,/className="unified-job-grid unified-role-list"/);
 assert.match(market,/const shown=pagedEligible;/);
 assert.doesNotMatch(market,/eligible\.slice\(0,6\)/,'homepage must not silently truncate to six');
 assert.doesNotMatch(market,/浏览企业资料库/,'the red-box company link must be removed');
 assert.match(market,/\{compact&&<div className="unified-job-browse-links">/);
 assert.match(market,/查看完整招聘市场/);
 assert.match(market,/sliceJobsForPage\(eligible,page\)/);
 assert.match(market,/listJobs\(filters,batchOffsetForPage\(page\),controller.signal\)/);
 assert.match(market,/const state=\{scope:compact\?'home'/);
 assert.match(market,/const previousMajor=useRef\(selectedMajor\)/);
 assert.match(market,/if\(previousMajor.current!==selectedMajor\)/);
 assert.match(market,/setPage\(0\);setFilters/);
 assert.match(market,/const detail='\/candidate\/jobs\/'\+encodeURIComponent\(job.id\)/);
 assert.match(market,/majorSlug=\{selectedMajor\}/);
 assert.match(market,/<SaveJobButton jobId=\{job.id\}/);
 assert.match(market,/<JobResultPagination page=\{page\} total=\{snapshot.total\} pageSize=\{JOBS_PER_PAGE\}/);
 assert.match(market,/!error&&!loading&&snapshot&&<JobResultPagination/,'homepage and full market use the same paginator');
 assert.doesNotMatch(market,/\{compact\?<div className="unified-job-browse-links">/,'homepage link must not replace pagination');

 assert.match(pager,/type="number" inputMode="numeric"/);
 assert.match(pager,/onSubmit=\{submit\}/);
 assert.match(pager,/validJumpPage\(typed,total\)/);
 assert.match(pager,/aria-current=\{n===current\?'page':undefined\}/);
 assert.match(css,/\.unified-job-grid\.unified-role-list\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.unified-role-list \.unified-job-card h3 a::after/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/\.unified-job-page-jump/);
});
