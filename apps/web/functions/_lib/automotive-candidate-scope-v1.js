/**
 * HHBA automotive-hall internal source lookup for future DeepSeek Search planning.
 * Reads ONLY unverified candidate URLs, never overrides the separately reviewed
 * employer whitelist and never claims that a job is live or a tenant is official.
 * No user-facing API imports this module.
 */
export const AUTOMOTIVE_CANDIDATE_SCOPE_KIND='HHBA_AUTOMOTIVE_SOURCE_CANDIDATES_V1';
export const AUTOMOTIVE_CANDIDATE_SECTIONS=Object.freeze([
 'auto-whole','auto-ev','auto-parts','auto-adas',
 'auto-electronics','auto-battery','auto-manufacturing','auto-business'
]);
const SECTION_SET=new Set(AUTOMOTIVE_CANDIDATE_SECTIONS);
export async function getAutomotiveCandidateSourceHints(env,{sections=[],limit=40}={}){
 // The underlying D1 migration is currently Preview-only. Production matching
 // must not accidentally treat unreviewed ATS URLs as trusted sources.
 if(env?.HHBA_AUTH_ROLLOUT!=='preview'||
   typeof env?.HHBA_PNVS_AUTH_DB?.prepare!=='function')return [];
 const selected=Array.isArray(sections)?
  [...new Set(sections.filter(s=>typeof s==='string'&&SECTION_SET.has(s)))]:[];
 const capped=Number.isInteger(limit)?Math.max(1,Math.min(200,limit)):40;
 const clause=selected.length?' AND section_id IN ('+selected.map(()=>'?').join(',')+')':'';
 const sql='SELECT id,collection_sequence,employer_display_name,candidate_url,section_id,batch_id '+
  'FROM hhba_library_automotive_recruitment_candidates '+
  "WHERE source_status='UNVERIFIED'"+clause+' ORDER BY collection_sequence LIMIT ?';
 try{
  const result=await env.HHBA_PNVS_AUTH_DB.prepare(sql).bind(...selected,capped).all();
  return (Array.isArray(result?.results)?result.results:[]).map(row=>({
   id:row.id,display_name:row.employer_display_name,
   recruitment_candidate_url:row.candidate_url,
   primary_hall:'automotive',automotive_section:row.section_id,
   collection_sequence:row.collection_sequence,batch_id:row.batch_id,
   source_status:'UNVERIFIED',is_reviewed_whitelist_source:false,
   intended_use:'DEEPSEEK_OFFICIAL_SOURCE_DISCOVERY_HINT_ONLY'
  }));
 }catch{
  // Missing preview migration is not a reason to fail actual job matching.
  return [];
 }
}
