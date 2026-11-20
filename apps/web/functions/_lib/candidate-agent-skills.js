/**
 * HHBA Candidate Agent — server-owned skill catalog (stage 1).
 *
 * Skills name REAL HHBA capabilities, not arbitrary prompts supplied by users.
 * Configuration is controlled by Cloudflare environment variables; the
 * applicant can never choose tool names, providers, budgets or permissions.
 * This is intentionally NOT a general-purpose shell/browser agent.
 */
export const CANDIDATE_AGENT_SKILLS = Object.freeze([
  Object.freeze({
    id:'resume_evidence',
    name:'简历证据准备',
    purpose:'读取本人明确授权的简历文字并脱敏，不推断未知资历',
    phase:'matching',
    approval:'upload_and_ai_consent'
  }),
  Object.freeze({
    id:'official_job_search',
    name:'企业招聘岗位发现',
    purpose:'调用 HHBA 现有 DeepSeek Search / Fetch 与企业招聘来源过滤',
    phase:'matching',
    approval:'upload_and_ai_consent'
  }),
  Object.freeze({
    id:'fit_scoring',
    name:'岗位匹配与评分',
    purpose:'复用现有岗位匹配评分与证据说明；分数不代表录用概率',
    phase:'matching',
    approval:'upload_and_ai_consent'
  }),
  Object.freeze({
    id:'targeted_resume_rewrite',
    name:'定向简历优化',
    purpose:'用户选定具体岗位后调用已有简历编辑 Agent，必须本人确认',
    phase:'after_job_selection',
    approval:'separate_ai_consent_and_final_user_review'
  })
]);

const DEFAULT_IDS = Object.freeze(CANDIDATE_AGENT_SKILLS.map(x=>x.id));
const known = new Set(DEFAULT_IDS);
const matchingIds = Object.freeze(DEFAULT_IDS.filter(id=>id!=='targeted_resume_rewrite'));

export function candidateAgentEnabled(env) {
  // Never enable in production merely because a key happens to exist.
  return env?.HHBA_CANDIDATE_AGENT_ENABLED==='1' &&
    (env?.HHBA_AUTH_ROLLOUT==='preview' ||
      (env?.HHBA_MATCH_RUNTIME_MODE==='production' &&
       env?.HHBA_CANDIDATE_AGENT_PRODUCTION_ALLOWED==='1'));
}

export function selectedCandidateSkills(env) {
  const raw=env?.HHBA_CANDIDATE_AGENT_SKILLS;
  if(raw===undefined||raw===null||raw==='')return [...DEFAULT_IDS];
  if(typeof raw!=='string'||raw.length>250)throw Error('AGENT_SKILLS_INVALID');
  const ids=raw.split(',').map(s=>s.trim()).filter(Boolean);
  if(ids.length===0||ids.length>DEFAULT_IDS.length||
    new Set(ids).size!==ids.length||ids.some(id=>!known.has(id)))
    throw Error('AGENT_SKILLS_INVALID');
  return ids;
}

export function candidateAgentConfiguration(env) {
  const enabled=candidateAgentEnabled(env);
  let allowed,configurationError=null;
  try{allowed=new Set(selectedCandidateSkills(env));}
  catch{allowed=new Set();configurationError='AGENT_SKILLS_INVALID';}
  const skills=CANDIDATE_AGENT_SKILLS.map(({id,name,purpose,phase,approval})=>({
    id,name,purpose,phase,approval,enabled:enabled&&allowed.has(id)
  }));
  return {enabled,version:'candidate-agent-skills-v1',skills,
    configuration_error:configurationError};
}

export function requireMatchingSkills(env) {
  if(!candidateAgentEnabled(env))throw Error('AGENT_NOT_ENABLED');
  const enabled=new Set(selectedCandidateSkills(env));
  if(matchingIds.some(id=>!enabled.has(id)))throw Error('AGENT_MATCHING_SKILL_DISABLED');
  return matchingIds;
}

/**
 * Stage 1 orchestrator: each step maps to an existing, auditable HHBA tool.
 * The DeepSeek search/matching model still chooses candidate roles and jobs
 * inside executeSearch. The runtime never invents additional openings, changes
 * the score or sends an application.
 *
 * executeSearch is injected for testability; production passes HHBA's
 * runSearchFirstMatch, with its existing provider timeouts and source checks.
 */
export async function runCandidateAgentMatch({
  env,redactedResume,roleHint='',limit=10,
  executeSearch,signal=null,onProgress=()=>{},onPartial=()=>{}
}) {
  const phases=requireMatchingSkills(env);
  if(typeof redactedResume!=='string'||
    redactedResume.replace(/\s/g,'').length<30||
    redactedResume.length>20000)throw Error('AGENT_RESUME_INVALID');
  if(typeof executeSearch!=='function'||!Number.isInteger(limit)||limit<1||limit>10)
    throw Error('AGENT_EXECUTION_INVALID');
  const steps=[];
  const report=(skill,status)=>{steps.push({skill,status});};
  report(phases[0],'complete');
  onProgress('preparing');
  // Only the server may supply executeSearch. Resume content stays in memory;
  // execution traces store skill IDs and statuses, never CV or job-page text.
  report(phases[1],'started');
  const result=await executeSearch(
    env.HHBA_MATCH_DEEPSEEK_KEY,redactedResume,String(roleHint).slice(0,80),limit,
    {signal,onProgress,onPartial}
  );
  if(!result||!Array.isArray(result.matches)||result.matches.length>limit)
    throw Error('AGENT_SEARCH_RESULT_INVALID');
  steps[steps.length-1]={skill:phases[1],status:'complete'};
  // Existing Search-first step supplies its own evidence-based match scores.
  // Unknown scores remain null; do not manufacture numeric values.
  if(result.matches.some(job=>job&&job.match_score!==null&&
     job.match_score!==undefined&&
     (!Number.isInteger(job.match_score)||job.match_score<0||job.match_score>100)))
    throw Error('AGENT_SCORE_INVALID');
  report(phases[2],'complete');
  const canRewrite=new Set(selectedCandidateSkills(env)).has('targeted_resume_rewrite');
  const agent={
    kind:'HHBA_CANDIDATE_AGENT_V1',
    status:'awaiting_user_selection',
    skills_executed:steps,
    next_skill:canRewrite?'targeted_resume_rewrite':null,
    next_requires_user_approval:true,
    applications_submitted:0
  };
  return {...result,agent};
}
