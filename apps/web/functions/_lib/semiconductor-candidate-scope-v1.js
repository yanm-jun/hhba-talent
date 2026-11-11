/** Private search hints. Must not be treated as VERIFIED or live-job URLs. */
export const SEMICONDUCTOR_CANDIDATE_SECTIONS=Object.freeze(["semi-fab","semi-design","semi-analog","semi-eda","semi-equipment","semi-material","semi-packaging","semi-display","semi-global"]);
const valid=new Set(SEMICONDUCTOR_CANDIDATE_SECTIONS);
export async function getSemiconductorCandidateSourceHints(env,{sections=[],limit=40}={}){
 if(env?.HHBA_AUTH_ROLLOUT!=='preview'||typeof env?.HHBA_PNVS_AUTH_DB?.prepare!=='function')return [];
 const selected=Array.isArray(sections)?[...new Set(sections.filter(s=>typeof s==='string'&&valid.has(s)))]:[];
 const cap=Number.isInteger(limit)?Math.max(1,Math.min(200,limit)):40;
 const clause=selected.length?' AND section_id IN ('+selected.map(()=>'?').join(',')+')':'';
 const sql="SELECT id,collection_sequence,employer_display_name,candidate_url,section_id,batch_id FROM hhba_library_semiconductor_recruitment_candidates WHERE source_status='UNVERIFIED'"+clause+' ORDER BY collection_sequence LIMIT ?';
 try{const data=await env.HHBA_PNVS_AUTH_DB.prepare(sql).bind(...selected,cap).all();
 return (Array.isArray(data?.results)?data.results:[]).map(r=>({id:r.id,display_name:r.employer_display_name,recruitment_candidate_url:r.candidate_url,primary_hall:'semiconductors',semiconductor_section:r.section_id,collection_sequence:r.collection_sequence,batch_id:r.batch_id,source_status:'UNVERIFIED',is_reviewed_whitelist_source:false,intended_use:'DEEPSEEK_OFFICIAL_SOURCE_DISCOVERY_HINT_ONLY'}));
 }catch{return []}
}
