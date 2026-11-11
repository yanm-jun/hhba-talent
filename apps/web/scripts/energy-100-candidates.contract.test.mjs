import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENERGY_BATCH_001_100,ENERGY_SECTIONS} from '../functions/_lib/energy-recruitment-batch-001-100.js';
import {getEnergyCandidateSourceHints} from '../functions/_lib/energy-candidate-scope-v1.js';
const migration=readFileSync(new URL('../d1/0029_energy_recruitment_candidate_links_100_v1.sql',import.meta.url),'utf8');
const expected={'energy-grid':3,'energy-generation':12,'energy-nuclear':5,'energy-hydro':5,
 'energy-engineering':20,'energy-solar':18,'energy-wind':10,'energy-storage':15,'energy-equipment':12};
test('100 candidate links are valid, unique and classified',()=>{
 assert.equal(ENERGY_BATCH_001_100.length,100);
 assert.equal(ENERGY_SECTIONS.length,9);
 const urls=new Set(),counts={};
 for(const [j,row] of ENERGY_BATCH_001_100.entries()){
  const [n,name,url,section,kind,parent]=row;
  assert.equal(n,j+1);
  assert.ok(name.length>=2&&parent.length>0);
  assert.ok(ENERGY_SECTIONS.includes(section),'section '+n);
  assert.ok(['ATS','CAREERS','NOTICE','DISCOVERY'].includes(kind));
  assert.match(url,/^https?:\/\//);
  assert.doesNotMatch(url,/openid=|access_token=|session_id=|utm_/i);
  const normalized=url.toLowerCase().replace(/\/+$/,'');
  assert.ok(!urls.has(normalized),'duplicate URL '+n);
  urls.add(normalized);
  counts[section]=(counts[section]||0)+1;
  const sqlEscape=v=>String(v).replace(/'/g,"''");
  const values="'hhba-energy-candidate-"+String(n).padStart(3,'0')+"',"+n+",'"+
   sqlEscape(name)+"','"+sqlEscape(url)+"','"+sqlEscape(section)+"','"+
   sqlEscape(kind)+"','"+sqlEscape(parent)+"'";
  assert.ok(migration.includes(values),'missing SQL row '+n);
 }
 assert.equal(urls.size,100);
 assert.deepEqual(counts,expected);
 assert.equal((migration.match(/\('hhba-energy-candidate-\d{3}',/g)||[]).length,100);
 assert.match(migration,/source_status TEXT NOT NULL DEFAULT 'UNVERIFIED'/);
 assert.doesNotMatch(migration,/INSERT\s+(?:OR IGNORE\s+)?INTO\s+hhba_reviewed_recruitment_sources/i);
});
test('preview-only lookup never converts a candidate to a trusted source',async()=>{
 const calls=[];
 const row={id:'hhba-energy-candidate-001',collection_sequence:1,
  employer_display_name:'国家电网',candidate_url:'https://zhaopin.sgcc.com.cn/',
  section_id:'energy-grid',entry_kind:'ATS',parent_group:'国家电网'};
 const env={HHBA_AUTH_ROLLOUT:'preview',HHBA_PNVS_AUTH_DB:{prepare(sql){
  return {bind(...params){calls.push({sql,params});return {all:async()=>({results:[row]})};}};
 }}};
 assert.deepEqual(await getEnergyCandidateSourceHints({...env,HHBA_AUTH_ROLLOUT:'production'}),[]);
 const found=await getEnergyCandidateSourceHints(env,{sections:['energy-grid','energy-grid','invalid'],limit:200});
 assert.equal(found.length,1);
 assert.equal(found[0].source_status,'UNVERIFIED');
 assert.equal(found[0].is_reviewed_whitelist_source,false);
 assert.equal(found[0].primary_hall,'energy');
 assert.equal(found[0].energy_section,'energy-grid');
 assert.equal(found[0].entry_kind,'ATS');
 assert.ok(!('reviewer' in found[0]));
 assert.ok(calls[0].sql.includes("source_status='UNVERIFIED'"));
 assert.ok(calls[0].sql.includes('IN (?)'));
 assert.deepEqual(calls[0].params,['energy-grid',100]);
 assert.deepEqual(await getEnergyCandidateSourceHints({HHBA_AUTH_ROLLOUT:'preview',
  HHBA_PNVS_AUTH_DB:{prepare(){throw Error('table missing')}}}),[]);
});
