import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SEMICONDUCTOR_BATCH_001_100 as rows} from '../functions/_lib/semiconductor-recruitment-batch-001-100.js';
import {SEMICONDUCTOR_CANDIDATE_SECTIONS as sections,getSemiconductorCandidateSourceHints} from '../functions/_lib/semiconductor-candidate-scope-v1.js';
const sql=readFileSync(new URL('../d1/0029_semiconductor_recruitment_candidates_100_v1.sql',import.meta.url),'utf8');
test('100 categorized unique candidate URLs match SQL migration',()=>{
 assert.equal(rows.length,100);assert.equal(new Set(rows.map(x=>x[1])).size,100);assert.equal(new Set(rows.map(x=>x[2])).size,100);
 assert.equal(new Set(rows.map(x=>x[3])).size,9);
 for(const [i,[n,name,url,section]] of rows.entries()){
  assert.equal(n,i+1);assert.ok(name.length>1);assert.match(url,/^https?:\/\//);assert.ok(sections.includes(section));
  assert.ok(!/access_token=|session_id=|openid=/i.test(url));
  const quote=s=>String(s).replace(/'/g,"''");
  assert.ok(sql.includes("'hhba-semi-candidate-"+String(n).padStart(3,'0')+"',"+n+",'"+quote(name)+"','"+quote(url)+"','"+quote(section)+"'"));
 }
 assert.match(sql,/source_status TEXT NOT NULL DEFAULT 'UNVERIFIED'/);
 assert.doesNotMatch(sql,/INSERT\s+(?:OR IGNORE\s+)?INTO\s+hhba_reviewed_recruitment_sources/i);
});
test('non-preview cannot expose candidate hints and Preview hints remain unverified',async()=>{
 const calls=[];const row={id:'a',collection_sequence:1,employer_display_name:'中芯国际',candidate_url:'https://smics.zhiye.com/campus',section_id:'semi-fab',batch_id:'SEMICONDUCTOR_001_100'};
 const db={prepare(sql){return {bind(...args){calls.push([sql,args]);return {all:async()=>({results:[row]})}}}}};
 assert.deepEqual(await getSemiconductorCandidateSourceHints({HHBA_AUTH_ROLLOUT:'production',HHBA_PNVS_AUTH_DB:db}),[]);
 const res=await getSemiconductorCandidateSourceHints({HHBA_AUTH_ROLLOUT:'preview',HHBA_PNVS_AUTH_DB:db},{sections:['semi-fab','invalid','semi-fab'],limit:300});
 assert.equal(res[0].source_status,'UNVERIFIED');assert.equal(res[0].is_reviewed_whitelist_source,false);
 assert.equal(res[0].primary_hall,'semiconductors');assert.deepEqual(calls[0][1],['semi-fab',200]);
});
