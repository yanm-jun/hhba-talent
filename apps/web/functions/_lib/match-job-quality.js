// Quality signals for Search-first recommendations.
// These are *page text signals*, not guarantees that an application can be submitted.
// Never infer "open" from HTTP 200, page age, Search inclusion, or a generic Apply button.
import {decodeSearchText} from './deepseek-native-match.js';
const tidy=s=>decodeSearchText(typeof s==='string'?s:'').replace(/\s+/g,' ').slice(0,4200);
const closed=/(?:该|此|本)?(?:职位|岗位)(?:目前|现已|已经|暂时)?(?:已关闭|已下线|已停止招聘|已结束招聘|已经招满|已招满|已过期|已失效|不再接受(?:申请|简历|投递)|已停止(?:接受|接收)(?:申请|简历))|(?:招聘已结束|招聘已经结束|申请通道已关闭|简历投递已截止|停止接收简历|招聘截止|招聘已截止|已结束投递|职位已经关闭|职位已撤销|position (?:has been )?filled|no longer accepting applications|this job (?:is|has been) closed|position is no longer available|application (?:period|window) (?:is )?closed)/i;
const open=/(?:该|此|本)(?:岗位|职位)(?:目前)?(?:正在招聘|仍在招聘|开放申请|开放投递|接受申请|接受投递|招聘中)|(?:简历投递通道已开放|正在接受申请|仍在接受申请|currently accepting applications|applications are open)/i;
const excerpt=(text,re)=>{const m=re.exec(text);if(!m)return '';return text.slice(Math.max(0,m.index-36),Math.min(text.length,m.index+m[0].length+36));};
export function classifyJobAvailability(hit,{fetched=false,checkedAt=new Date().toISOString()}={}){
 const text=tidy(fetched?(hit?.content||''):(hit?.summary||hit?.snippet||''));
 if(fetched && text.length>60){
  const evidence=excerpt(text,closed);
  if(evidence)return {status:'CLOSED_LISTED',evidence,checked_at:checkedAt};
  const affirmative=excerpt(text,open);
  if(affirmative)return {status:'OPEN_LISTED',evidence:affirmative,checked_at:checkedAt};
  return {status:'UNKNOWN',evidence:'未从职位详情发现明确的开放投递状态',checked_at:checkedAt};
 }
 const suspicious=excerpt(text,closed);
 return {status:suspicious?'POSSIBLY_CLOSED':'UNKNOWN',
  evidence:suspicious||'搜索摘要不能证明仍可投递',checked_at:null};
}
export function isRecommendationEligible(hit){
 return hit?.availability?.status!=='CLOSED_LISTED'&&hit?.availability?.status!=='POSSIBLY_CLOSED';
}
export function applicationStatusLabel(status){
 if(status==='OPEN_LISTED')return '页面显示在招（仍需核验）';
 if(status==='POSSIBLY_CLOSED')return '疑似已停止招聘';
 if(status==='CLOSED_LISTED')return '页面显示已停止招聘';
 return '投递状态待确认';
}
export function normalizeMatchScore(score,basis){
 // No numeric score when the model omitted its evidence.
 const value=typeof score==='number'?score:typeof score==='string'&&/^\d+(?:\.\d+)?$/.test(score)?Number(score):NaN;
 if(!Number.isFinite(value)||!Number.isInteger(value)||value<0||value>100)return null;
 if(typeof basis!=='string'||basis.trim().length<14)return null;
 return value;
}
export function sortByMatchScore(jobs){
 return jobs.map((job,i)=>({job,i})).sort((a,b)=>{
  const left=Number.isInteger(a.job.match_score)?a.job.match_score:-1;
  const right=Number.isInteger(b.job.match_score)?b.job.match_score:-1;
  return right-left||a.i-b.i;
 }).map(x=>x.job);
}
