import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupMarketRoles,spreadEmployers,presentMarketJobs} from '../src/services/marketRolePresentation.mjs';
import {JOBS_PER_PAGE,FETCH_BATCH_SIZE,batchOffsetForPage,pageCount,sliceJobsForPage}
 from '../src/services/jobPaging.mjs';

const job=(id,company,title,city,extra={})=>({
 id,company,companyZh:company,title,titleZh:title,
 location:city,locationZh:city,source:company+'-official',
 recruitmentType:'SOCIAL',...extra
});
const ids=rows=>rows.flatMap(j=>j.marketGroup?.variants?.map(x=>x.id)||[j.id]);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('group only genuinely equivalent roles from different cities; preserve every original ID',()=>{
 const originals=[
  job('1','毕马威','财务咨询顾问','北京'),
  job('2','毕马威','财务咨询顾问','上海'),
  job('3','毕马威','财务咨询顾问','上海'), // Two distinct postings in the same city
  job('4','毕马威','财务咨询顾问','深圳',{recruitmentType:'CAMPUS'}),
  job('5','毕马威','财务咨询顾问','广州',{positionOrg:'财务风险咨询部'}),
  job('6','毕马威','金融风险咨询顾问','南京'),
  job('7','华安证券','财务咨询顾问','北京'),
  job('8','毕马威','财务咨询顾问','成都',{source:'independent-recruiting-portal'})
 ];
 const groups=groupMarketRoles(originals);
 assert.equal(groups.length,7);
 assert.deepEqual(groups[0].marketGroup.cities,['北京','上海']);
 assert.deepEqual(groups[0].marketGroup.variants.map(j=>j.id),['1','2']);
 assert(groups.some(j=>j.id==='3'&&!j.marketGroup));
 assert(groups.some(j=>j.id==='4'&&!j.marketGroup));
 assert(groups.some(j=>j.id==='5'&&!j.marketGroup));
 assert.deepEqual(ids(groups).sort(),originals.map(j=>j.id).sort());
 assert.equal(new Set(ids(groups)).size,originals.length);
 assert.equal(originals[0].marketGroup,undefined,'Do not mutate the approved source record');
});
test('city suffixes in titles are stripped only when matching the actual city',()=>{
 const original=[
  job('sh','佑驾创新','27届-规划模型算法工程师（上海）','上海'),
  job('sz','佑驾创新','27届-规划模型算法工程师（深圳）','深圳'),
  job('bsp','佑驾创新','嵌入式开发工程师（BSP）','上海'),
  job('sdk','佑驾创新','嵌入式开发工程师（SDK）','深圳')
 ];
 const groups=groupMarketRoles(original);
 assert.equal(groups.length,3);
 assert.equal(groups[0].marketGroup.title,'27届-规划模型算法工程师');
 assert.deepEqual(groups[0].marketGroup.variants.map(x=>x.id),['sh','sz']);
 assert(!groups[1].marketGroup&&!groups[2].marketGroup,'Subspecializations are not cities');
});
test('multiple-city and same-city overlaps are never merged into a false new vacancy',()=>{
 const a=job('multi','A','软件工程师','深圳 / 北京');
 const b=job('single','A','软件工程师','深圳');
 const c=job('other','A','软件工程师','上海');
 const d=job('same','A','软件工程师','上海市');
 const groups=groupMarketRoles([a,b,c,d]);
 assert.equal(groups.length,2);
 assert.deepEqual(ids(groups).sort(),['multi','single','other','same'].sort());
 assert(groups.every(x=>x.marketGroup?.variants.length===2));
});
test('ten-card pages show different companies and never drop or repeat a group',()=>{
 const original=[
  ...Array.from({length:10},(_,i)=>job('a'+i,'毕马威','部门'+i,'北京')),
  ...Array.from({length:6},(_,i)=>job('b'+i,'施耐德电气','技术'+i,'上海')),
  ...Array.from({length:6},(_,i)=>job('c'+i,'华安证券','金融'+i,'合肥')),
  ...Array.from({length:6},(_,i)=>job('d'+i,'安克创新','产品'+i,'深圳')),
  ...Array.from({length:6},(_,i)=>job('e'+i,'辉瑞','医学'+i,'北京'))
 ];
 const result=presentMarketJobs(original,{pageSize:10,maxPerCompany:2});
 assert.equal(result.total,34);
 assert.equal(result.sourceTotal,34);
 const first=result.rows.slice(0,10);
 assert.equal(new Set(first.map(x=>x.company)).size,5);
 for(const c of new Set(first.map(x=>x.company)))
  assert(first.filter(x=>x.company===c).length<=2,c+' must not dominate');
 const displayed=[];
 for(let page=0;page<pageCount(result.total);page++){
  const batch=result.rows.slice(batchOffsetForPage(page),batchOffsetForPage(page)+FETCH_BATCH_SIZE);
  displayed.push(...sliceJobsForPage(batch,page));
 }
 assert.deepEqual(displayed.map(j=>j.id),result.rows.map(j=>j.id));
 assert.equal(new Set(displayed.map(j=>j.id)).size,result.total);
});
test('one-company searches are never capped, even with many different roles',()=>{
 const original=Array.from({length:25},(_,i)=>job('k'+i,'毕马威','风险咨询方向'+i,'上海'));
 const result=presentMarketJobs(original,{enabled:false});
 assert.equal(result.rows.length,25);
 assert.deepEqual(result.rows.map(x=>x.id),original.map(x=>x.id));
 const automatic=presentMarketJobs(original);
 assert.equal(automatic.rows.length,25,'A single available company is a natural fallback');
});
test('major rank never loses to diversity; unrestricted must remain last',()=>{
 const originals=[
  ...Array.from({length:12},(_,i)=>job('r'+i,'毕马威','专业相关 '+i,'北京',{rank:3})),
  ...Array.from({length:5},(_,i)=>job('u'+i,'华安证券','不限专业 '+i,'上海',{rank:1})),
  ...Array.from({length:3},(_,i)=>job('m'+i,'施耐德电气','其他相关 '+i,'深圳',{rank:3})),
  ...Array.from({length:3},(_,i)=>job('x'+i,'安克创新','要求未披露 '+i,'广州',{rank:2}))
 ];
 const ordered=presentMarketJobs(originals,{priorityOf:j=>j.rank});
 assert.deepEqual(ordered.rows.map(x=>x.rank),[
  ...Array(15).fill(3),...Array(3).fill(2),...Array(5).fill(1)
 ]);
 assert.deepEqual(ids(ordered.rows).sort(),originals.map(x=>x.id).sort());
});
test('production static market uses the display groups before offset and retains stable bookmark links',()=>{
 const service=read('src/services/liveRecruitment.ts');
 const component=read('src/components/UnifiedJobMarket.tsx');
 const css=read('src/styles/unified-jobs.css');
 assert.match(service,/const result=presentMarketJobs\(rows,/);
 assert.match(service,/return \{jobs:result\.rows\.slice\(offset,offset\+30\),total:result\.total,sourceTotal:result\.sourceTotal/);
 assert.match(service,/return \{\.\.\.marketPage\(allowed,filters,offset\),/);
 assert.match(service,/return \{\.\.\.data,\.\.\.marketPage\(relevant,filters,offset\)\}/);
 assert.match(service,/return \{\.\.\.marketPage\(ranked,filters,offset\)/);
 assert.match(component,/job\.marketGroup!\.variants\.map\(variant=>/);
 assert.match(component,/<SaveJobButton jobId=\{variant\.id\} compact\/>/);
 assert.match(component,/encodeURIComponent\(variant\.id\)/);
 assert.match(component,/<JobResultPagination page=\{page\} total=\{snapshot\.total\}/);
 assert.match(css,/\.unified-role-list \.unified-job-variants/);
 assert.match(css,/z-index:3/);
});
