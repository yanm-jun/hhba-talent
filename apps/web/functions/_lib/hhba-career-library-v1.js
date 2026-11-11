/**
 * HHBA Career Library V1 — preview-only read layer.
 * Business taxonomy is a navigation map, NOT a job inventory or eligibility engine.
 * The recruiter URLs come only from source-verified database records.
 * SQL values are always bound; no private resumes or company ATS APIs are queried here.
 */
export const LIBRARY_KIND='HHBA_CAREER_LIBRARY_V1';
const text=(value,max)=>typeof value==='string'?
 value.normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g,' ').trim().slice(0,max):'';
const all=async(db,sql,params=[])=>{
 const prepared=db.prepare(sql);
 const result=await prepared.bind(...params).all();
 return Array.isArray(result?.results)?result.results:[];
};
const label='搜索导航线索，不代表当前在招、专业准入或录用概率';
export const libraryReadable=env=>env?.HHBA_AUTH_ROLLOUT==='preview'&&
 typeof env?.HHBA_PNVS_AUTH_DB?.prepare==='function';

export async function careerLibraryIndex(db){
 const halls=await all(db,
  'SELECT h.hall_id,h.display_name,h.description,h.sort_order,'+
  'COUNT(e.employer_source_id) AS linked_employers '+
  'FROM hhba_library_halls h LEFT JOIN hhba_library_employer_halls e ON e.hall_id=h.hall_id '+
  'GROUP BY h.hall_id ORDER BY h.sort_order');
 return {kind:LIBRARY_KIND,version:'1',disclaimer:label,
  halls:halls.map(h=>({...h,development_status:h.hall_id==='automotive'?'PILOT':'STRUCTURE_ONLY'})),
  pilot_hall:'automotive'};
}
export async function automotiveLibrary(db,{major='',role='',now=new Date()}={}){
 const inputMajor=text(major,60);
 const inputRole=text(role,60);
 if(typeof major!=='string'||major.length>60||typeof role!=='string'||role.length>60)
  return {error:'INVALID_SEARCH',status:400};
 const [hall]=await all(db,'SELECT hall_id,display_name,description FROM hhba_library_halls WHERE hall_id=?',['automotive']);
 if(!hall)return {error:'LIBRARY_MIGRATION_MISSING',status:503};
 const sections=await all(db,
  'SELECT section_id,display_name,sort_order FROM hhba_library_hall_sections '+
  'WHERE hall_id=? ORDER BY sort_order',['automotive']);
 let majorInfo=null,rolePaths=[];
 if(inputMajor){
  const [m]=await all(db,
   'SELECT m.major_code,m.display_name,m.major_group_id,g.display_name AS major_group '+
   'FROM hhba_library_majors m JOIN hhba_library_major_groups g '+
   'ON g.major_group_id=m.major_group_id '+
   'WHERE m.major_code=? OR m.display_name=? ORDER BY m.major_code LIMIT 1',
   [inputMajor,inputMajor]);
  if(!m)return {error:'MAJOR_NOT_IN_PILOT_CATALOG',status:404,major:inputMajor};
  majorInfo=m;
  const curated=await all(db,
   'SELECT r.role_id,r.display_name,r.keyword_examples,p.route_type,p.priority '+
   'FROM hhba_library_major_role_paths p '+
   'JOIN hhba_library_role_families r ON r.role_id=p.role_id '+
   'JOIN hhba_library_hall_role_paths hr ON hr.role_id=p.role_id AND hr.hall_id=? '+
   'WHERE p.major_code=? ORDER BY CASE p.route_type WHEN \'DIRECT\' THEN 0 ELSE 1 END,p.priority,r.display_name',
   ['automotive',m.major_code]);
  if(curated.length){
   rolePaths=curated.map(x=>({...x,match_basis:'CURATED_MAJOR',requires_skill_evidence:x.route_type==='CROSS_SKILL'}));
  }else{
   rolePaths=(await all(db,
    'SELECT r.role_id,r.display_name,r.keyword_examples,p.pathway_kind AS route_type,0 AS priority '+
    'FROM hhba_library_major_group_role_paths p '+
    'JOIN hhba_library_role_families r ON r.role_id=p.role_id '+
    'JOIN hhba_library_hall_role_paths hr ON hr.role_id=p.role_id AND hr.hall_id=? '+
    'WHERE p.major_group_id=? ORDER BY CASE p.pathway_kind WHEN \'POSSIBLE\' THEN 0 ELSE 1 END,r.display_name',
    ['automotive',m.major_group_id])).map(x=>({...x,match_basis:'GROUP_FALLBACK',requires_skill_evidence:x.route_type==='ADJACENT'}));
  }
 }else{
  rolePaths=(await all(db,
   'SELECT r.role_id,r.display_name,r.keyword_examples FROM hhba_library_role_families r '+
   'JOIN hhba_library_hall_role_paths hr ON hr.role_id=r.role_id '+
   'WHERE hr.hall_id=? ORDER BY r.display_name',['automotive']))
   .map(x=>({...x,route_type:'OPEN_TO_ALL',match_basis:'HALL',requires_skill_evidence:false}));
 }
 if(inputRole&&!rolePaths.some(x=>x.role_id===inputRole)){
  // Do not prevent cross-major exploration. Still require a valid automotive role.
  const [entry]=await all(db,
   'SELECT r.role_id,r.display_name,r.keyword_examples FROM hhba_library_role_families r '+
   'JOIN hhba_library_hall_role_paths hr ON r.role_id=hr.role_id '+
   'WHERE hr.hall_id=? AND r.role_id=?',['automotive',inputRole]);
  if(!entry)return {error:'UNKNOWN_HALL_ROLE',status:404};
  rolePaths.push({...entry,route_type:'USER_CHOSEN',match_basis:'EXPLICIT_EXPLORATION',requires_skill_evidence:true});
 }
 const effectiveRole=inputRole||rolePaths[0]?.role_id||'';
 const employers=await all(db,
  'SELECT s.id,s.display_name AS name,s.official_company_url,s.recruitment_base_url,'+
  'h.membership_type,h.section_id,sec.display_name AS section_name,'+
  'CASE WHEN er.role_id IS NULL THEN 0 ELSE 1 END AS documented_business_role_scope '+
  'FROM hhba_library_employer_halls h '+
  'JOIN hhba_reviewed_recruitment_sources s ON s.id=h.employer_source_id '+
  'LEFT JOIN hhba_library_hall_sections sec ON sec.section_id=h.section_id '+
  'LEFT JOIN hhba_library_employer_role_scopes er '+
  'ON er.employer_source_id=s.id AND er.role_id=? '+
  'WHERE h.hall_id=? AND s.review_status=\'VERIFIED\' AND s.expires_at>? '+
  'ORDER BY documented_business_role_scope DESC,CASE h.membership_type WHEN \'PRIMARY\' THEN 0 ELSE 1 END,s.display_name LIMIT 100',
  [effectiveRole,'automotive',now.toISOString()]);
 return {kind:LIBRARY_KIND,hall:{...hall,development_status:'PILOT'},
  major:majorInfo,roles:rolePaths,
  selected_role:effectiveRole,
  sections,employers:employers.map(e=>({...e,
   documented_business_role_scope:Boolean(e.documented_business_role_scope),
   position_status:'NOT_CHECKED',
   advisory:label})),
  employer_count:employers.length,
  note:'行业归馆和专业路径用于 DeepSeek 官方招聘搜索优先级。企业属于某行业，不代表其正在招收该岗位；必须检索并核实真实招聘详情。'};
}
