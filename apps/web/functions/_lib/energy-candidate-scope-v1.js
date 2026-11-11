/** HHBA energy pavilion internal-only, preview-only candidate source reader.
 * Not a verified whitelist, never used as direct user-facing job recommendations.
 */
export const ENERGY_CANDIDATE_SCOPE_KIND='HHBA_ENERGY_SOURCE_CANDIDATES_V1';
export const ENERGY_CANDIDATE_SECTIONS=Object.freeze([
 'energy-grid','energy-generation','energy-nuclear','energy-hydro',
 'energy-engineering','energy-solar','energy-wind','energy-storage','energy-equipment'
]);
const VALID_SECTIONS=new Set(ENERGY_CANDIDATE_SECTIONS);
export async function getEnergyCandidateSourceHints(env,{sections=[],limit=40}={}){
 if(env?.HHBA_AUTH_ROLLOUT!=='preview'||
   typeof env?.HHBA_PNVS_AUTH_DB?.prepare!=='function')return [];
 const selected=Array.isArray(sections)?
   [...new Set(sections.filter(s=>typeof s==='string'&&VALID_SECTIONS.has(s)))]:[];
 const capped=Number.isInteger(limit)?Math.max(1,Math.min(100,limit)):40;
 const clause=selected.length?' AND section_id IN ('+selected.map(()=>'?').join(',')+')':'';
 const sql='SELECT id,collection_sequence,employer_display_name,candidate_url,section_id,entry_kind,parent_group '+
  'FROM hhba_library_energy_recruitment_candidates '+
  "WHERE source_status='UNVERIFIED'"+clause+' ORDER BY collection_sequence LIMIT ?';
 try{
  const result=await env.HHBA_PNVS_AUTH_DB.prepare(sql).bind(...selected,capped).all();
  return (Array.isArray(result?.results)?result.results:[]).map(row=>({
   id:row.id,display_name:row.employer_display_name,
   recruitment_candidate_url:row.candidate_url,primary_hall:'energy',
   energy_section:row.section_id,entry_kind:row.entry_kind,
   parent_group:row.parent_group,collection_sequence:row.collection_sequence,
   batch_id:'ENERGY_BATCH_001_100',source_status:'UNVERIFIED',
   is_reviewed_whitelist_source:false,
   intended_use:'DEEPSEEK_OFFICIAL_SOURCE_DISCOVERY_HINT_ONLY'
  }));
 }catch{return [];}
}
