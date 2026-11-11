/**
 * HHBA energy hall third-batch employer candidates, preview-only.
 * These records reflect 100 distinct named companies or subsidiaries; shared
 * parent ATS pages are intentionally reused and NEVER represented as independent hiring sites.
 * No user-facing endpoint or production AI module should import this unreviewed source.
 */
import {ENERGY_CANDIDATE_SECTIONS} from './energy-candidate-scope-v1.js';
const SECTIONS = new Set(ENERGY_CANDIDATE_SECTIONS);

export async function getEnergyEmployerCandidateHints(env,{sections=[],limit=40,offset=0}={}){
 if(env?.HHBA_AUTH_ROLLOUT!=='preview' ||
    typeof env?.HHBA_PNVS_AUTH_DB?.prepare!=='function')return [];
 const selected=Array.isArray(sections)
  ? [...new Set(sections.filter(x=>typeof x==='string'&&SECTIONS.has(x)))]
  : [];
 const cap=Number.isInteger(limit)?Math.max(1,Math.min(100,limit)):40;
 const skip=Number.isInteger(offset)?Math.max(0,Math.min(100,offset)):0;
 const clause=selected.length?' AND section_id IN ('+selected.map(()=>'?').join(',')+')':'';
 const sql='SELECT id,collection_sequence,employer_display_name,candidate_url,section_id,entry_kind,parent_group,batch_id '+
 'FROM hhba_library_energy_employer_candidates '+
 "WHERE source_status='UNVERIFIED'"+clause+
 ' ORDER BY collection_sequence LIMIT ? OFFSET ?';
 try{
   const result=await env.HHBA_PNVS_AUTH_DB.prepare(sql).bind(...selected,cap,skip).all();
   return (Array.isArray(result?.results)?result.results:[]).map(row=>({
     id:row.id,
     display_name:row.employer_display_name,
     recruitment_candidate_url:row.candidate_url,
     primary_hall:'energy',
     energy_section:row.section_id,
     entry_kind:row.entry_kind,
     shared_parent_recruitment_portal:['SHARED_ATS','GROUP_CAREERS'].includes(row.entry_kind),
     parent_group:row.parent_group,
     collection_sequence:row.collection_sequence,
     batch_id:row.batch_id||'ENERGY_EMPLOYERS_201_300',
     source_status:'UNVERIFIED',
     is_reviewed_whitelist_source:false,
     intended_use:'DEEPSEEK_EMPLOYER_AND_OFFICIAL_SOURCE_DISCOVERY_HINT_ONLY'
   }));
 }catch{return [];}
}
