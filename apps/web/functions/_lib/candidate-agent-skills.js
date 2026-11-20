/**
 * HHBA Candidate Agent — server-owned skill catalog (stage 1).
 *
 * Skills name REAL HHBA capabilities, not arbitrary prompts supplied by users.
 * Configuration is controlled by Cloudflare environment variables; the
 * applicant can never choose tool names, providers, budgets or permissions.
 * This is intentionally NOT a general-purpose shell/browser agent.
 */
import {safeJobDetailLink} from './deepseek-native-match.js';
import {allowedEmployerJobLink} from './match-employer-source.js';
import {isMainlandJobLocation} from './mainland-job-location.js';
import {redactForModel} from './resume-match-core.js';
import {readAgentPolicy} from './candidate-agent-policy.js';

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

function safeCandidateJob(job){
  return Boolean(job&&typeof job.company==='string'&&job.company.trim()&&
    typeof job.title==='string'&&job.title.trim()&&
    safeJobDetailLink(job.official_url)&&allowedEmployerJobLink(job.official_url)&&
    isMainlandJobLocation(job.location)&&
    (job.match_score===null||job.match_score===undefined||
     (Number.isInteger(job.match_score)&&job.match_score>=0&&job.match_score<=100)));
}

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

export async function candidateAgentRuntimePolicy(env){
  const policy=await readAgentPolicy(env?.HHBA_PNVS_AUTH_DB);
  return {enabled:candidateAgentEnabled(env)&&policy.configured&&policy.enabled,policy};
}

/**
 * Enforce the optional editing Skill at the actual paid rewrite endpoint,
 * not just by hiding a button. Existing non-Agent Word editing is independent.
 */
export async function candidateAgentRewriteAllowed(env){
  if(!candidateAgentEnabled(env))return true;
  const runtime=await candidateAgentRuntimePolicy(env);
  if(!runtime.enabled)return true;
  return runtime.policy.skills.includes('targeted_resume_rewrite')&&
    selectedCandidateSkills(env).includes('targeted_resume_rewrite');
}

export function candidateAgentConfiguration(env,policy=null) {
  const enabled=candidateAgentEnabled(env)&&policy?.configured===true&&policy?.enabled===true;
  let allowed,configurationError=null;
  try{allowed=new Set(selectedCandidateSkills(env).filter(x=>policy?.skills?.includes(x)));}
  catch{allowed=new Set();configurationError='AGENT_SKILLS_INVALID';}
  const skills=CANDIDATE_AGENT_SKILLS.map(({id,name,purpose,phase,approval})=>({
    id,name,purpose,phase,approval,enabled:enabled&&allowed.has(id)
  }));
  return {enabled,version:'candidate-agent-skills-v2',skills,
    policy_revision:policy?.revision??null,policy_reason:policy?.reason??null,
    configuration_error:configurationError};
}

export function requireMatchingSkills(env,policy) {
  if(!candidateAgentEnabled(env)||policy?.configured!==true||policy?.enabled!==true)
    throw Error('AGENT_NOT_ENABLED');
  const enabled=new Set(selectedCandidateSkills(env).filter(x=>policy.skills.includes(x)));
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
  env,policy,redactedResume,roleHint='',limit=10,
  executeSearch,signal=null,onProgress=()=>{},onPartial=()=>{}
}) {
  const phases=requireMatchingSkills(env,policy);
  // Defense in depth: future callers must not accidentally transmit PII.
  const safeResume=redactForModel(redactedResume);
  if(typeof redactedResume!=='string'||redactedResume.length>20000||
    safeResume.replace(/\s/g,'').length<30)throw Error('AGENT_RESUME_INVALID');
  if(typeof executeSearch!=='function'||!Number.isInteger(limit)||limit<1||limit>10)
    throw Error('AGENT_EXECUTION_INVALID');
  const steps=[];
  const report=(skill,status)=>{steps.push({skill,status});};
  report(phases[0],'complete');
  onProgress('preparing');
  // Only the server may supply executeSearch. Resume content stays in memory;
  // execution traces store skill IDs and statuses, never CV or job-page text.
  report(phases[1],'started');
  // Streamed preliminary hits must pass the same safety checks as final jobs.
  // Never expose an invalid URL even for a moment while the model is running.
  const safePartial=matches=>{
    if(!Array.isArray(matches))return;
    const clean=matches.filter(safeCandidateJob).slice(0,limit);
    if(clean.length)onPartial(clean);
  };
  const result=await executeSearch(
    env.HHBA_MATCH_DEEPSEEK_KEY,safeResume,String(roleHint).slice(0,80),limit,
    {signal,onProgress,onPartial:safePartial}
  );
  if(!result||!Array.isArray(result.matches)||result.matches.length>limit)
    throw Error('AGENT_SEARCH_RESULT_INVALID');
  // A provider-produced candidate is not an automatically verified vacancy.
  // Reject unsafe/third-party/non-mainland links even if an injected provider
  // bypasses HHBA's normal Search-first filters.
  if(result.matches.some(job=>!safeCandidateJob(job)))
    throw Error('AGENT_UNTRUSTED_JOB');
  steps[steps.length-1]={skill:phases[1],status:'complete'};
  // The same guard checks source, city and 0–100 score before any display.
  report(phases[2],'complete');
  const canRewrite=new Set(policy.skills.filter(id=>selectedCandidateSkills(env).includes(id)))
    .has('targeted_resume_rewrite');
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
