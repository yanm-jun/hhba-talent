import test from 'node:test';
import assert from 'node:assert/strict';
import {fuseDomesticJobRecommendations,isMainlandWorkCity} from '../functions/_lib/domestic-match-fusion.js';
const now=Date.parse('2026-11-08T00:00:00Z');
const tencent='https://careers.tencent.com/jobdesc.html?postId=2097166275703910400';
function domesticInside(id='one',score=70,company='腾讯',title='软件开发工程师',location='深圳'){
 return {id:'ashby-verified-'+id,company,title,location,source_type:'HHBA站内岗位',
  official_url:'https://jobs.ashbyhq.com/verified/'+id,platform:'ashby',source:'verified',
  remote:false,reference_score:score,matched:['有岗位名称依据'],not_evidenced:[],
  needs_verification:['需确认是否仍然招聘'],requirements_basis:'已通过同版官方岗位审查'};
}
function domesticOutside(id='2097166275703910400',overrides={}){
 const u=id==='2097166275703910400'?tencent:
  'https://careers.tencent.com/jobdesc.html?postId='+id;
 const title='软件开发工程师';
 return {id:'careers.tencent.com:'+id,company:'腾讯',title,location:'深圳',
  official_url:u,official_domain:'careers.tencent.com',
  source_type:'站外官方招聘',source_status:'OFFICIAL_DETAIL_FETCHED',
  application_status:'NEEDS_OFFICIAL_CONFIRMATION',has_application_cta:true,
  checked_at:'2026-11-08T00:00:00Z',
  evidence:{title,location:'深圳',requirement:'熟悉 Python、SQL 数据库，至少本科及以上学历，要求具备良好的团队协作及沟通能力。'},
  ...overrides};
}
const profile={education:'BACHELOR',experience_years:3,
 skills:[{name:'Python',evidence:'Python'}],target_roles:['软件开发工程师']};
test('only unambiguous Mainland cities qualify',()=>{
 assert.equal(isMainlandWorkCity('深圳'),true);
 assert.equal(isMainlandWorkCity('Shanghai, China'),true);
 for(const place of ['Hong Kong, China','北京 / 香港','Taipei','Remote, China','San Francisco, USA','']){
  assert.equal(isMainlandWorkCity(place),false,place);
 }
});
test('relevant official external posting competes with internal without becoming verified-open',()=>{
 const result=fuseDomesticJobRecommendations([domesticInside('inside',61,'国内企业甲','数据库开发工程师')],
 [domesticOutside()],profile,{role_hint:'软件开发工程师'},now);
 assert.equal(result.matches.length,2);
 assert.equal(result.matches[0].source_type,'站外官方招聘');
 assert.equal(result.matches[0].application_status,'NEEDS_OFFICIAL_CONFIRMATION');
 assert.ok(result.matches[0].needs_verification.some(x=>x.includes('仍接受申请')));
 assert.equal(result.counts.selected_external,1);
 assert.equal(result.counts.selected_internal,1);
 assert.ok(result.matches[0].reference_score<=90);
});
test('same company same role across sources or cities appears once, with higher score winning',()=>{
 const external=domesticOutside();
 const result=fuseDomesticJobRecommendations([
  domesticInside('original',92,'腾讯','软件开发工程师','深圳'),
  domesticInside('othercity',84,'腾讯','软件开发工程师','上海')],
 [external],profile,{role_hint:'软件开发工程师'},now);
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].id,'ashby-verified-original');
});
test('foreign, stale, nonofficial and inactive external jobs are rejected before scoring',()=>{
 const rows=[
  domesticOutside('2097166275703910401',{location:'香港',evidence:{title:'软件开发工程师',location:'香港',requirement:'熟练 Python，至少本科以上，其他相关应用研发经验。'}}),
  domesticOutside('2097166275703910402',{official_url:'https://evil.example/job'}),
  domesticOutside('2097166275703910403',{application_status:'VERIFIED_OPEN'}),
  domesticOutside('2097166275703910404',{has_application_cta:false}),
  domesticOutside('2097166275703910405',{checked_at:'2026-10-01T00:00:00Z'}),
  domesticOutside('2097166275703910406',{evidence:{title:'岗位已下线',location:'深圳',requirement:'熟练 Python 且有足够经验及相关岗位技能要求。'}}),
 ];
 const out=fuseDomesticJobRecommendations([],rows,profile,{role_hint:'软件开发工程师'},now);
 assert.equal(out.matches.length,0);
 assert.equal(out.counts.external_eligible,0);
});
test('hard education and experience mismatches block false high scores',()=>{
 const jobs=[
  domesticOutside('2097166275703910401',{evidence:{title:'软件开发工程师',location:'深圳',
   requirement:'岗位要求硕士及以上学历，熟练 Python 编程，有软件项目经验和较好的学习能力。'}}),
  domesticOutside('2097166275703910402',{evidence:{title:'软件开发工程师',location:'深圳',
   requirement:'岗位要求 5年以上工作经验，熟练 Python 编程，有软件工程和系统设计经验。'}})
 ];
 const result=fuseDomesticJobRecommendations([],jobs,profile,{role_hint:'软件开发工程师'},now);
 assert.equal(result.matches.length,0);
});
test('skill-only matching is grounded by fetched requirement wording',()=>{
 const result=fuseDomesticJobRecommendations([],
 [domesticOutside('2097166275703910403',{title:'工程平台支持',evidence:{
  title:'工程平台支持',location:'深圳',requirement:'使用 Python 与 SQL 管理数据库、解决平台问题，至少本科及以上，具备排障经验。'}})],
 profile,{role_hint:'金融分析师'},now);
 assert.equal(result.matches.length,1);
 assert.ok(result.matches[0].matched.some(x=>x.includes('Python')));
});
test('no forced 10, keeps distinct employers and caps at ten in a large mixed pool',()=>{
 const inside=[];
 for(let i=0;i<12;i++)inside.push(domesticInside(String(i),65+i,'企业'+String(i%5),'数据分析师'+String(i),'上海'));
 const result=fuseDomesticJobRecommendations(inside,[],profile,{limit:10},now);
 assert.equal(result.matches.length,10);
 const counts={};
 for(const r of result.matches)counts[r.company]=(counts[r.company]||0)+1;
 assert.ok(Math.max(...Object.values(counts))<=2);
 const small=fuseDomesticJobRecommendations([domesticInside()],[],profile,{},now);
 assert.equal(small.matches.length,1);
});
test('no source or no relevant external gives zero, never hallucinates padding',()=>{
 const out=fuseDomesticJobRecommendations([],[],profile,{limit:10},now);
 assert.equal(out.matches.length,0);
 assert.equal(out.counts.selected_internal+out.counts.selected_external,0);
});

test('external Search is opt-in, Preview-gated, and never sends resume text',async()=>{
 const {readFile}=await import('node:fs/promises');
 const component=await readFile(new URL('../src/components/CandidateMatchResultDialog.tsx',import.meta.url),'utf8');
 const service=await readFile(new URL('../src/services/resumeMatch.ts',import.meta.url),'utf8');
 assert.match(component,/externalAvailable&&<section/,'Search button hidden unless Preview flag is enabled');
 assert.match(component,/onClick=\{\(\)=>void findMoreDomesticJobs\(\)\}/);
 assert.match(component,/discoverExternalDomesticJobs\(role,abort.signal\)/);
 assert.match(component,/fuseDomesticJobRecommendations\(/);
 assert.match(component,/result.matches,found.candidates,result.profile/);
 assert.match(service,/body:JSON\.stringify\(\{role_hint:clean,consent_search:true\}\)/);
 assert.doesNotMatch(service.slice(service.indexOf('export async function discoverExternalDomesticJobs')),/resume_id|text:cleaned|profile:|skills:/);
});
