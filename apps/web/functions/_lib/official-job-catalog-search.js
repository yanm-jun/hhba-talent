import {normalizeAutonomousQueries} from './autonomous-mainland-search.js';
import {normalizeHits} from './deepseek-search-match.js';
import {safeOfficialJobLocator} from './domestic-search-fetch.js';
import {isMainlandJobLocation} from './mainland-job-location.js';

function publicRow(url,title,cities,duties){
 const locator=safeOfficialJobLocator(url);
 if(!locator||typeof title!=='string'||title.trim().length<2||
    !cities.length||!cities.every(city=>typeof city==='string'&&isMainlandJobLocation(city)))return null;
 return {url:locator.url,title:locator.company+' '+title.trim(),
  site_name:locator.company+'招聘',
  summary:'工作地点：'+cities.join('、')+'。岗位职责：'+String(duties||'').slice(0,300)};
}

async function tencent(keyword,page,fetcher,signal){
 const query=new URLSearchParams({timestamp:String(Date.now()),pageIndex:String(page),
  pageSize:'10',language:'zh-cn',area:'cn',keyword:encodeURIComponent(keyword)});
 const response=await fetcher('https://careers.tencent.com/tencentcareer/api/post/Query?'+query,
  {signal,redirect:'manual',headers:{Accept:'application/json'}});
 if(!response.ok)throw Error('CATALOG_UNAVAILABLE');
 const data=await response.json();
 if(data?.Code!==200||!Array.isArray(data.Data?.Posts))throw Error('CATALOG_INVALID');
 return data.Data.Posts.filter(post=>post?.IsValid===true).map(post=>publicRow(
  'https://careers.tencent.com/jobdesc.html?postId='+post.PostId,post.RecruitPostName,
  [post.LocationName],post.Responsibility)).filter(Boolean);
}

async function meituan(keyword,page,fetcher,signal){
 const response=await fetcher('https://zhaopin.meituan.com/api/official/job/getJobList',{
  method:'POST',signal,redirect:'manual',headers:{Accept:'application/json','Content-Type':'application/json'},
  body:JSON.stringify({page:{pageNo:page,pageSize:10},jobShareType:'1',keywords:keyword,
   cityList:[],department:[],jfJgList:[],jobType:[],typeCode:[],specialCode:[]})
 });
 if(!response.ok)throw Error('CATALOG_UNAVAILABLE');
 const data=await response.json();
 if(data?.status!==1||!Array.isArray(data.data?.list))throw Error('CATALOG_INVALID');
 return data.data.list.filter(post=>post?.jobStatus==='000').map(post=>publicRow(
  'https://zhaopin.meituan.com/web/position/detail?jobUnionId='+post.jobUnionId,post.name,
  Array.isArray(post.cityList)?post.cityList.map(city=>city?.name):[],post.jobDuty)).filter(Boolean);
}

// Public employer searches accept only short job or skill keywords from the
// planner. Resume text, user identifiers and the AI key never go to these sites.
export async function searchOfficialJobCatalogs(values,{fetcher=fetch,signal,page=1}={}){
 const keywords=normalizeAutonomousQueries(values,[],{minLength:2})
  .filter(value=>value.length<=24&&/^[\p{L}\p{N} /+.#-]+$/u.test(value)&&!/[0-9]{5}/.test(value))
  .slice(0,3);
 const timeout=AbortSignal.timeout(8500);
 const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
 const outcomes=await Promise.allSettled(keywords.flatMap(keyword=>
  [tencent,meituan].map(search=>search(keyword,page,fetcher,requestSignal))));
 const results=outcomes.flatMap(item=>item.status==='fulfilled'?item.value:[]);
 return {hits:normalizeHits([{results}],60),searches:outcomes.length,raw:results.length,
  failures:outcomes.filter(item=>item.status==='rejected').length};
}
