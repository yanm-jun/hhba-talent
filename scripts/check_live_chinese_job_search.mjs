import {searchJobs,parseNaturalQuery} from '../apps/web/src/services/jobSearchFacets.mjs';
const ROOT='https://yanm-jun.github.io/hhba-talent/data/';
const [feedResponse,facetsResponse,auditResponse]=await Promise.all([
 fetch(ROOT+'jobs.json'),fetch(ROOT+'job-search-facets.json'),fetch(ROOT+'job-sync-status.json')
]);
for(const [name,response] of [['feed',feedResponse],['search_facets',facetsResponse],['audit',auditResponse]])
 if(!response.ok)throw Error(name+' HTTP '+response.status);
const [feed,facets,audit]=await Promise.all([
 feedResponse.json(),facetsResponse.json(),auditResponse.json()]);
if(facets.indexed_as_of!==feed.updated||audit.summary.indexed_as_of!==feed.updated)
 throw Error('The search index, audit and published listings are not from the same official snapshot');
if(facets.kind!=='HHBA_OFFICIAL_JD_SEARCH_FACETS_V1'||facets.jobs.length<8000)
 throw Error('The published source-grounded search facets are missing');
const blocked=new Set(audit.jobs.filter(e=>[
 'MISSING_FROM_OFFICIAL_BOARD','OFFICIAL_URL_CHANGED','OFFICIAL_SOURCE_READ_FAILED',
 'OFFICIAL_TITLE_CHANGED','INVALID_ATS_ID_OR_URL','DUPLICATE_JOB_ID','INVALID_JOB_ID'
].includes(e.status)).map(e=>e.job_id));
const current=feed.jobs.filter(job=>!blocked.has(job.id));
const byId=new Map(facets.jobs.map(f=>[f.id,f]));
const queries=['新加坡软件工程师','美国销售','不限学历的远程工作',
 '新加坡 Python 软件工程师','美国远程销售'];
const output=[];
for(const q of queries){
 const p=parseNaturalQuery(q),matches=searchJobs(current,{q},byId);
 output.push({query:q,parsed:{country:p.countryCode,city:p.cityKey,roles:p.roleKeys,
  education:p.education,remote:p.remote,skills:p.skills},
  matching:matches.counted,
  samples:matches.rows.slice(0,3).map(j=>({company:j.company,title:j.title,location:j.location,id:j.id}))});
}
const usRemote=searchJobs(current,{location_country:'US',remote:true},byId);
const singapore=searchJobs(current,{location_country:'SG',city:'singapore'},byId);
const knownBachelor=searchJobs(current,{education:'BACHELOR'},byId);
const knownExperience=searchJobs(current,{experience:'3-5'},byId);
const noDegree=searchJobs(current,{education:'UNRESTRICTED',remote:true},byId);
const totals={sourceJobs:feed.total,searchableJobs:current.length,sourceVerifiedFacets:facets.extracted_count,
 singapore:singapore.counted,usRemote:usRemote.counted,
 explicitlyBachelor:knownBachelor.counted,experience3to5:knownExperience.counted,
 explicitlyNoDegreeRemote:noDegree.counted};
console.log('HHBA_REAL_CHINESE_QUERY_RESULTS',JSON.stringify({totals,queries:output}));
if(output[0].matching===0||output[1].matching===0)
 throw Error('Singapore software or US sales has zero current official postings; investigate before acceptance');
