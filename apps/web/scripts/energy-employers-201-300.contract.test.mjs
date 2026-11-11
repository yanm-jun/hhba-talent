import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENERGY_BATCH_001_100,ENERGY_SECTIONS} from '../functions/_lib/energy-recruitment-batch-001-100.js';
import {ENERGY_BATCH_101_200} from '../functions/_lib/energy-recruitment-batch-101-200.js';
import {ENERGY_EMPLOYERS_201_300} from '../functions/_lib/energy-employer-candidates-201-300.js';
import {getEnergyEmployerCandidateHints} from '../functions/_lib/energy-employer-candidate-scope-v1.js';

const sql=readFileSync(new URL('../d1/0031_energy_employer_candidates_201_300_v1.sql',import.meta.url),'utf8');
const historical=[...ENERGY_BATCH_001_100,...ENERGY_BATCH_101_200];
const rows=ENERGY_EMPLOYERS_201_300;

test('100 new distinct employer names numbered 201..300, not duplicate prior 200 entries',()=>{
 assert.equal(rows.length,100);
 assert.equal(historical.length,200);
 const names=new Set(historical.map(r=>r[1].trim().toLowerCase()));
 const urls=new Set(), ownNames=new Set(),counts={}, kinds={};
 const esc=x=>String(x).replace(/'/g,"''");
 for(const [i,row] of rows.entries()){
  const [n,name,url,section,kind,parent]=row;
  assert.equal(n,i+201);
  assert.ok(name.length>=2 && parent.length>=2);
  assert.ok(ENERGY_SECTIONS.includes(section),'Unknown section '+n);
  assert.ok(['ATS','SHARED_ATS','CAREERS','GROUP_CAREERS','NOTICE','DISCOVERY'].includes(kind));
  assert.match(url,/^https?:\/\//);
  assert.doesNotMatch(url,/openid=|access_token=|session_id=|utm_/i);
  const id=name.trim().toLowerCase();
  assert.ok(!names.has(id),'duplicate from batch 1–2: '+name);
  assert.ok(!ownNames.has(id),'duplicate in batch 3: '+name);
  ownNames.add(id);urls.add(url.toLowerCase().replace(/\/+$/,''));
  counts[section]=(counts[section]||0)+1;
  kinds[kind]=(kinds[kind]||0)+1;
  const snippet="'hhba-energy-employer-"+n+"',"+n+",'"+esc(name)+"','"+esc(url)+"','"+esc(section)+"','"+esc(kind)+"','"+esc(parent)+"'";
  assert.ok(sql.includes(snippet),'Missing SQL row '+n);
 }
 assert.equal(ownNames.size,100);
 assert.equal(urls.size,26,'26 deliberately shared/independent portals; do not fake 100 URLs');
 assert.deepEqual(counts,{'energy-generation':36,'energy-engineering':6,'energy-grid':5,
  'energy-hydro':3,'energy-equipment':29,'energy-wind':7,
  'energy-nuclear':2,'energy-storage':6,'energy-solar':6});
 assert.deepEqual(kinds,{SHARED_ATS:50,GROUP_CAREERS:30,ATS:6,DISCOVERY:3,NOTICE:1,CAREERS:10});
 assert.equal((sql.match(/\('hhba-energy-employer-\d{3}',/g)||[]).length,100);
 assert.match(sql,/employer_display_name TEXT NOT NULL UNIQUE/);
 assert.match(sql,/candidate_url TEXT NOT NULL,/);
 assert.doesNotMatch(sql,/candidate_url TEXT NOT NULL UNIQUE/);
 assert.doesNotMatch(sql,/INSERT\s+(?:OR IGNORE\s+)?INTO\s+hhba_reviewed_recruitment_sources/i);
 assert.match(sql,/source_status TEXT NOT NULL DEFAULT 'UNVERIFIED'/);
});

test('employer candidate lookup is preview-only and explicitly warns of group-shared portals',async()=>{
 const statements=[];
 const row={id:'hhba-energy-employer-201',collection_sequence:201,
  employer_display_name:'深圳能源集团股份有限公司',
  candidate_url:'https://szny2027.zhaopin.com/jobs/index.html',
  section_id:'energy-generation',entry_kind:'SHARED_ATS',
  parent_group:'深圳能源集团',batch_id:'ENERGY_EMPLOYERS_201_300'};
 const env={HHBA_AUTH_ROLLOUT:'preview',HHBA_PNVS_AUTH_DB:{prepare(sql){
  return {bind(...params){statements.push({sql,params});return {all:async()=>({results:[row]})};}};
 }}};
 assert.deepEqual(await getEnergyEmployerCandidateHints({...env,HHBA_AUTH_ROLLOUT:'production'}),[]);
 assert.deepEqual(await getEnergyEmployerCandidateHints({HHBA_AUTH_ROLLOUT:'preview'}),[]);
 const found=await getEnergyEmployerCandidateHints(env,{sections:['energy-generation','energy-generation','bad'],limit:250,offset:0});
 assert.equal(found.length,1);
 assert.equal(found[0].collection_sequence,201);
 assert.equal(found[0].shared_parent_recruitment_portal,true);
 assert.equal(found[0].source_status,'UNVERIFIED');
 assert.equal(found[0].is_reviewed_whitelist_source,false);
 assert.equal(found[0].primary_hall,'energy');
 assert.equal(found[0].batch_id,'ENERGY_EMPLOYERS_201_300');
 assert.deepEqual(statements[0].params,['energy-generation',100,0]);
 assert.ok(statements[0].sql.includes("source_status='UNVERIFIED'"));
 assert.ok(statements[0].sql.includes('IN (?)'));
 assert.deepEqual(await getEnergyEmployerCandidateHints({HHBA_AUTH_ROLLOUT:'preview',
  HHBA_PNVS_AUTH_DB:{prepare(){throw Error('missing migration')}}}),[]);
});
