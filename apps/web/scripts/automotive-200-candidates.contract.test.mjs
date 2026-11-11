import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BATCH_001_100} from '../functions/_lib/automotive-recruitment-batch-001-100.js';
import {BATCH_101_200} from '../functions/_lib/automotive-recruitment-batch-101-200.js';
import {
 AUTOMOTIVE_CANDIDATE_SECTIONS,getAutomotiveCandidateSourceHints
} from '../functions/_lib/automotive-candidate-scope-v1.js';

const rows=[...BATCH_001_100,...BATCH_101_200];
const migration=readFileSync(new URL('../d1/0028_automotive_recruitment_candidate_links_200_v1.sql',import.meta.url),'utf8');
test('200 source links are classified, unique, and remain UNVERIFIED',()=>{
 assert.equal(BATCH_001_100.length,100);
 assert.equal(BATCH_101_200.length,100);
 assert.equal(rows.length,200);
 const urls=new Set();
 for(const [index,row] of rows.entries()){
  const [n,name,url,section]=row;
  assert.equal(n,index+1);
  assert.ok(name.length>=2);
  assert.ok(AUTOMOTIVE_CANDIDATE_SECTIONS.includes(section),String(n));
  assert.match(url,/^https?:\/\//);
  assert.ok(!/openid=|access_token=|session_id=/i.test(url),String(n));
  const canonical=url.toLowerCase().replace(/\/+$/,'');
  assert.ok(!urls.has(canonical),'duplicate: '+n);
  urls.add(canonical);
  const escaped=v=>String(v).replace(/'/g,"''");
  assert.ok(migration.includes(
   "'hhba-auto-candidate-"+String(n).padStart(3,'0')+"',"+n+",'"+escaped(name)+"','"+escaped(url)+"','"+escaped(section)+"'"),
   'missing database row: '+n);
 }
 assert.equal(urls.size,200);
 assert.equal(rows.filter(row=>row[2].startsWith('http:')).length,2);
 assert.match(migration,/source_status TEXT NOT NULL DEFAULT 'UNVERIFIED'/);
 assert.doesNotMatch(migration,/INSERT\s+(?:OR IGNORE\s+)?INTO\s+hhba_reviewed_recruitment_sources/i);
 assert.equal((migration.match(/\('hhba-auto-candidate-\d{3}',/g)||[]).length,200);
});
test('private scoped lookup returns unverified hints, never a verified employer source',async()=>{
 const statements=[];
 const source={id:'hhba-auto-candidate-011',collection_sequence:11,employer_display_name:'华域视觉',
  candidate_url:'https://hascovision.zhiye.com/social',section_id:'auto-electronics',batch_id:'BATCH_001_100'};
 const env={HHBA_AUTH_ROLLOUT:'preview',HHBA_PNVS_AUTH_DB:{
  prepare(sql){return {bind(...params){statements.push({sql,params});
   return {all:async()=>({results:[source]})};}}}
 }};
 assert.deepEqual(await getAutomotiveCandidateSourceHints({...env,HHBA_AUTH_ROLLOUT:'production'}),[]);
 const hints=await getAutomotiveCandidateSourceHints(env,{sections:['auto-electronics','invalid','auto-electronics'],limit:9999});
 assert.equal(hints.length,1);
 assert.equal(hints[0].source_status,'UNVERIFIED');
 assert.equal(hints[0].is_reviewed_whitelist_source,false);
 assert.equal(hints[0].primary_hall,'automotive');
 assert.equal(hints[0].automotive_section,'auto-electronics');
 assert.ok(!('reviewer' in hints[0]));
 assert.ok(statements[0].sql.includes('source_status='));
 assert.ok(statements[0].sql.includes('IN (?)'));
 assert.deepEqual(statements[0].params,['auto-electronics',200]);
 assert.equal((await getAutomotiveCandidateSourceHints({
  HHBA_AUTH_ROLLOUT:'preview',HHBA_PNVS_AUTH_DB:{prepare(){throw Error('missing migration')}}
 })).length,0);
});
