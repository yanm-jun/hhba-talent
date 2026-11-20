import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANDIDATE_AGENT_SKILLS,candidateAgentEnabled,
  candidateAgentConfiguration,selectedCandidateSkills,requireMatchingSkills,
  runCandidateAgentMatch
} from '../functions/_lib/candidate-agent-skills.js';

const preview=()=>({
  HHBA_AUTH_ROLLOUT:'preview',
  HHBA_CANDIDATE_AGENT_ENABLED:'1',
  HHBA_MATCH_DEEPSEEK_KEY:'synthetic-key-only-for-tests'
});
const approved={configured:true,enabled:true,revision:1,skills:['resume_evidence','official_job_search','fit_scoring','targeted_resume_rewrite']};
const sampleJob=()=>({
  id:'sample-1',company:'测试企业（虚构）',title:'产品运营',
  location:'北京市',official_url:'https://jobs.lever.co/sample-company/position-123',
  match_score:78,score_basis:'这是合成评分，只用于测试',
  recruitment_source_kind:'EMPLOYER_ATS'
});
const resume='本人曾在真实项目中负责产品内容整理、跨部门协作以及用户反馈分析，具有相关项目经历。';

test('agent is fail-closed by default and production needs a second permission',()=>{
  assert.equal(candidateAgentEnabled({}),false);
  assert.equal(candidateAgentEnabled({HHBA_CANDIDATE_AGENT_ENABLED:'1'}),false);
  assert.equal(candidateAgentEnabled({
    HHBA_CANDIDATE_AGENT_ENABLED:'1',HHBA_MATCH_RUNTIME_MODE:'production'
  }),false);
  assert.equal(candidateAgentEnabled({
    HHBA_CANDIDATE_AGENT_ENABLED:'1',HHBA_MATCH_RUNTIME_MODE:'production',
    HHBA_CANDIDATE_AGENT_PRODUCTION_ALLOWED:'1'
  }),true);
});

test('skills are server-controlled; invalid or duplicate identifiers are rejected',()=>{
  assert.equal(CANDIDATE_AGENT_SKILLS.length,4);
  assert.equal(selectedCandidateSkills(preview()).length,4);
  assert.deepEqual(selectedCandidateSkills({
    HHBA_CANDIDATE_AGENT_SKILLS:'resume_evidence,official_job_search,fit_scoring'
  }),['resume_evidence','official_job_search','fit_scoring']);
  for(const value of [
    'resume_evidence,malicious_shell',
    'fit_scoring,fit_scoring',
    ',',
    'resume_evidence,fit_scoring'
  ]){
    const env={...preview(),HHBA_CANDIDATE_AGENT_SKILLS:value};
    if(value==='resume_evidence,fit_scoring')
      assert.throws(()=>requireMatchingSkills(env,approved),/AGENT_MATCHING_SKILL_DISABLED/);
    else assert.throws(()=>selectedCandidateSkills(env),/AGENT_SKILLS_INVALID/);
  }
});

test('status excludes key material and discloses user approval for rewrite',()=>{
  const cfg=candidateAgentConfiguration(preview(),approved);
  assert.equal(cfg.enabled,true);
  assert.equal(cfg.skills.find(x=>x.id==='targeted_resume_rewrite').phase,'after_job_selection');
  assert.match(JSON.stringify(cfg),/separate_ai_consent_and_final_user_review/);
  assert.doesNotMatch(JSON.stringify(cfg),/synthetic-key-only-for-tests/);
  const invalid=candidateAgentConfiguration({
    ...preview(),HHBA_CANDIDATE_AGENT_SKILLS:'other'
  },approved);
  assert.equal(invalid.configuration_error,'AGENT_SKILLS_INVALID');
  assert.equal(invalid.skills.filter(x=>x.enabled).length,0);
});

test('candidate match invokes actual search adapter and preserves result, without auto applying',async()=>{
  let called=0,steps=[],partial=[];
  const fakeSearch=async(key,text,role,limit,ctx)=>{
    called++;
    assert.equal(key,'synthetic-key-only-for-tests');
    assert.equal(text,resume);
    assert.equal(role,'产品运营');
    assert.equal(limit,10);
    ctx.onProgress('searching');
    ctx.onPartial([sampleJob()]);
    return {matches:[sampleJob()],diagnostic:{searches:2,page_reads:1},incomplete:true};
  };
  const value=await runCandidateAgentMatch({
    env:preview(),policy:approved,redactedResume:resume,roleHint:'产品运营',limit:10,
    executeSearch:fakeSearch,onProgress:s=>steps.push(s),onPartial:j=>partial.push(j)
  });
  assert.equal(called,1);
  assert.deepEqual(steps,['preparing','searching']);
  assert.equal(partial.length,1);
  assert.deepEqual(value.matches,[sampleJob()]);
  assert.equal(value.agent.status,'awaiting_user_selection');
  assert.equal(value.agent.applications_submitted,0);
  assert.equal(value.agent.next_skill,'targeted_resume_rewrite');
  assert.deepEqual(value.agent.skills_executed.map(x=>x.skill),
    ['resume_evidence','official_job_search','fit_scoring']);
  assert.doesNotMatch(JSON.stringify(value.agent),/本人曾在真实项目/);
});

test('agent re-redacts contact information at the final provider boundary',async()=>{
  const source=resume+' 手机号：13800138000，邮箱：candidate@example.com';
  await runCandidateAgentMatch({
    env:preview(),policy:approved,redactedResume:source,
    executeSearch:async(key,sent)=>{
      assert.doesNotMatch(sent,/13800138000|candidate@example.com/);
      assert.match(sent,/手机号已隐藏/);
      assert.match(sent,/邮箱已隐藏/);
      return {matches:[sampleJob()],diagnostic:{}};
    }
  });
});

test('unsafe streamed partial jobs are never exposed to the applicant',async()=>{
  const visible=[];
  const safe=sampleJob();
  const blocked={...sampleJob(),official_url:'https://www.zhipin.com/job_detail/test-id.html'};
  const result=await runCandidateAgentMatch({
    env:preview(),policy:approved,redactedResume:resume,
    onPartial:jobs=>visible.push(jobs),
    executeSearch:async(key,text,role,limit,ctx)=>{
      ctx.onPartial([blocked,safe]);
      ctx.onPartial([blocked]);
      return {matches:[safe],diagnostic:{}};
    }
  });
  assert.equal(result.matches.length,1);
  assert.equal(visible.length,1);
  assert.deepEqual(visible[0],[safe]);
});

test('rewrite skill can be disabled without breaking search and scoring',async()=>{
  const env={...preview(),
    HHBA_CANDIDATE_AGENT_SKILLS:'resume_evidence,official_job_search,fit_scoring'};
  const result=await runCandidateAgentMatch({
    env,policy:approved,redactedResume:resume,limit:1,
    executeSearch:async()=>({matches:[sampleJob()],diagnostic:{}})
  });
  assert.equal(result.agent.next_skill,null);
  assert.equal(result.agent.applications_submitted,0);
});

test('agent rejects missing consent boundary, bad resume, bad scores or unsafe sources',async()=>{
  await assert.rejects(runCandidateAgentMatch({
    env:{},policy:approved,redactedResume:resume,executeSearch:async()=>({matches:[]})
  }),/AGENT_NOT_ENABLED/);
  await assert.rejects(runCandidateAgentMatch({
    env:preview(),policy:approved,redactedResume:'hi',executeSearch:async()=>({matches:[]})
  }),/AGENT_RESUME_INVALID/);
  for(const job of [
    {...sampleJob(),match_score:120},
    {...sampleJob(),location:'东京'},
    {...sampleJob(),official_url:'https://www.zhipin.com/job_detail/test-id.html'},
    {...sampleJob(),official_url:'https://example.com/positions/test'},
    {...sampleJob(),official_url:'http://jobs.lever.co/demo/position-1'}
  ]){
    await assert.rejects(runCandidateAgentMatch({
      env:preview(),policy:approved,redactedResume:resume,executeSearch:async()=>({matches:[job]})
    }),/AGENT_UNTRUSTED_JOB|AGENT_SCORE_INVALID/);
  }
});

test('failed/invalid search never claims success and keeps application count at zero',async()=>{
  await assert.rejects(runCandidateAgentMatch({
    env:preview(),policy:approved,redactedResume:resume,limit:10,
    executeSearch:async()=>({matches:Array.from({length:11},sampleJob)})
  }),/AGENT_SEARCH_RESULT_INVALID/);
  await assert.rejects(runCandidateAgentMatch({
    env:preview(),policy:approved,redactedResume:resume,
    executeSearch:async()=>{throw Error('AI_SEARCH_TIMEOUT')}
  }),/AI_SEARCH_TIMEOUT/);
});
