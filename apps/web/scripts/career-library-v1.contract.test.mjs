import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {proposeEmployerHallClassification,HALL_IDS} from '../functions/_lib/hhba-library-classification-v1.js';
import {automotiveLibrary,careerLibraryIndex,libraryReadable} from '../functions/_lib/hhba-career-library-v1.js';
import {onRequest} from '../functions/api/career-library/[[path]].js';

const snapshot=JSON.parse(readFileSync(new URL('../src/data/hhbaLibraryCompanyMapV1.json',import.meta.url),'utf8'));
const sql24=readFileSync(new URL('../d1/0024_major_industry_library_v1.sql',import.meta.url),'utf8');
const sql25=readFileSync(new URL('../d1/0025_major_industry_library_employers_v1.sql',import.meta.url),'utf8');
const sql26=readFileSync(new URL('../d1/0026_major_specific_automotive_paths_v1.sql',import.meta.url),'utf8');

test('library has 175 distinct reviewed employers and one primary hall each',()=>{
 const rows=snapshot.employers;
 assert.equal(snapshot.schema,'HHBA_CAREER_LIBRARY_V1');
 assert.equal(rows.length,175);
 assert.equal(new Set(rows.map(x=>x.id)).size,175);
 assert.equal(new Set(rows.map(x=>x.name)).size,175);
 assert.equal(HALL_IDS.length,15);
 assert.ok(rows.every(x=>HALL_IDS.includes(x.primary)&&x.additional.every(h=>HALL_IDS.includes(h)&&h!==x.primary)));
 assert.equal(rows.filter(x=>x.primary==='automotive'||x.additional.includes('automotive')).length,29);
 assert.equal(rows.filter(x=>x.auto_section===null&&(x.primary==='automotive'||x.additional.includes('automotive'))).length,1);
 // The orphan is a material supplier corrected by SQL migration 0026.
 assert.match(sql26,/中国宝武集团（宝钢股份专场）/);
 assert.match(sql26,/section_id='auto-parts'/);
 assert.equal(rows.filter(x=>x.name==='小米').length,1);
 assert.equal(rows.find(x=>x.name==='小米')?.primary,'electronics');
 assert.deepEqual(rows.find(x=>x.name==='小米')?.additional,['automotive','internet']);
 assert.ok(sql25.includes('BUSINESS_POSSIBILITY'));
});
test('existing official source reviews remain separate from classification proposals',()=>{
 const x=proposeEmployerHallClassification({
  id:'hhba-official-b02-02-20261111',display_name:'小米',
  industry_tags_json:'["consumer-retail","automotive"]',
  business_tags_json:'["consumer-products","hardware-rd"]'});
 assert.equal(x.primary,'electronics');
 assert.deepEqual(x.additional,['automotive','internet']);
 assert.equal(x.classification_status,'EDITORIAL_PROPOSAL_NOT_JOB_VERIFIED');
 assert.equal(proposeEmployerHallClassification({id:'bad',display_name:'假冒',industry_tags_json:'[]',business_tags_json:'[]'}),null);
});
test('major-specific overrides are the rule when present, not broad group default',()=>{
 assert.match(sql26,/hhba_library_major_role_paths/);
 assert.match(sql26,/120203K/); // accounting
 assert.match(sql26,/130205/); // dance
 assert.match(sql26,/080202/); // mechanical design
 assert.ok(sql24.includes('major_group_role_paths'));
});
function mockDb(){
 const seen=[];
 const db={prepare(sql){return {bind(...values){seen.push({sql,values});
  return {async all(){
   if(sql.includes('FROM hhba_library_halls WHERE'))return {results:[{hall_id:'automotive',display_name:'汽车与智能出行',description:'测试'}]};
   if(sql.includes('FROM hhba_library_halls h LEFT JOIN'))return {results:[{hall_id:'automotive',display_name:'汽车与智能出行',description:'测试',linked_employers:29}]};
   if(sql.includes('FROM hhba_library_hall_sections'))return {results:[{section_id:'auto-ev',display_name:'新能源汽车',sort_order:1}]};
   if(sql.includes('FROM hhba_library_majors ORDER BY'))return {results:[{major_code:'120203K',display_name:'会计学'},{major_code:'080202',display_name:'机械设计制造及其自动化'}]};
   if(sql.includes('FROM hhba_library_majors m JOIN'))return {results:values[0]==='120203K'?[{major_code:'120203K',display_name:'会计学',major_group_id:'commerce',major_group:'管理与工商类'}]:[]};
   if(sql.includes('FROM hhba_library_major_role_paths'))return {results:[
    {role_id:'accounting',display_name:'财务会计与审计',keyword_examples:'会计、审计',route_type:'DIRECT',priority:1},
    {role_id:'operations',display_name:'供应链运营与采购',keyword_examples:'供应链',route_type:'CROSS_SKILL',priority:20}]};
   if(sql.includes('FROM hhba_library_major_group_role_paths'))return {results:[]};
   if(sql.includes('FROM hhba_library_role_families r')&&sql.includes('hr.hall_id=? AND r.role_id=?'))return {results:[]};
   if(sql.includes('FROM hhba_library_role_families r'))return {results:[{role_id:'accounting',display_name:'财务会计与审计',keyword_examples:'会计、审计'}]};
   if(sql.includes('FROM hhba_library_employer_halls h'))return {results:[
    {id:'xiaomi',name:'小米',official_company_url:'https://www.mi.com/',recruitment_base_url:'https://hr.xiaomi.com/',membership_type:'SECONDARY',section_id:'auto-ev',section_name:'新能源汽车',documented_business_role_scope:values[0]==='accounting'?1:0}]};
   return {results:[]};
  }};
 }}}};
 return {db,seen};
}
test('accounting candidate can find Xiaomi automotive hall via finance role, not just electronics',async()=>{
 const {db,seen}=mockDb();
 const r=await automotiveLibrary(db,{major:'120203K',now:new Date('2026-11-11T08:00:00Z')});
 assert.equal(r.major.display_name,'会计学');
 assert.equal(r.roles[0].role_id,'accounting');
 assert.equal(r.roles[0].match_basis,'CURATED_MAJOR');
 assert.equal(r.selected_role,'accounting');
 assert.equal(r.employer_count,1);
 assert.equal(r.employers[0].name,'小米');
 assert.equal(r.employers[0].membership_type,'SECONDARY');
 assert.equal(r.employers[0].documented_business_role_scope,true);
 assert.equal(r.employers[0].position_status,'NOT_CHECKED');
 assert.ok(seen.some(x=>x.sql.includes('s.expires_at>?')&&x.values.includes('automotive')));
 assert.ok(seen.every(x=>!x.sql.includes('120203K'))); // SQL parameters, never interpolation
});
test('no major means no guessed default role; user can still explore cross-major',async()=>{
 const {db}=mockDb();
 const r=await automotiveLibrary(db,{});
 assert.equal(r.major,null);
 assert.equal(r.selected_role,'');
 assert.equal(r.employers[0].documented_business_role_scope,false);
});
test('unknown major cannot masquerade as a valid normalized major',async()=>{
 const {db}=mockDb();
 const result=await automotiveLibrary(db,{major:'not-a-major'});
 assert.equal(result.error,'MAJOR_NOT_IN_PILOT_CATALOG');
 assert.equal(result.status,404);
 assert.equal((await automotiveLibrary(db,{major:'x'.repeat(61)})).status,400);
});
test('career-library route is preview-only, read-only and 404 outside preview',async()=>{
 assert.equal(libraryReadable({HHBA_AUTH_ROLLOUT:'prod'}),false);
 const request=new Request('https://preview.example.com/api/career-library/automotive',{method:'GET'});
 const prod=await onRequest({request,env:{HHBA_AUTH_ROLLOUT:'prod'}});
 assert.equal(prod.status,404);
 const {db}=mockDb();
 const preview=await onRequest({request:new Request('https://preview.example.com/api/career-library/automotive?major=120203K'),env:{HHBA_AUTH_ROLLOUT:'preview',HHBA_PNVS_AUTH_DB:db}});
 assert.equal(preview.status,200);
 const data=await preview.json();
 assert.equal(data.ok,true);
 assert.equal(data.selected_role,'accounting');
 const denied=await onRequest({request:new Request('https://preview.example.com/api/career-library/automotive',{method:'POST'}),env:{HHBA_AUTH_ROLLOUT:'preview',HHBA_PNVS_AUTH_DB:db}});
 assert.equal(denied.status,405);
});
