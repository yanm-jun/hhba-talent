import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SEMICONDUCTOR_BATCH_001_100} from '../functions/_lib/semiconductor-recruitment-batch-001-100.js';
import {SEMICONDUCTOR_BATCH_101_200} from '../functions/_lib/semiconductor-recruitment-batch-101-200.js';
import {SEMICONDUCTOR_CANDIDATE_SECTIONS} from '../functions/_lib/semiconductor-candidate-scope-v1.js';
const sql=readFileSync(new URL('../d1/0030_semiconductor_recruitment_candidates_101_200_v1.sql',import.meta.url),'utf8');
const firstSql=readFileSync(new URL('../d1/0029_semiconductor_recruitment_candidates_100_v1.sql',import.meta.url),'utf8');
test('200 semiconductor candidates: unique names, unique URLs, sequential IDs, nine categories, SQL parity',()=>{
 const all=[...SEMICONDUCTOR_BATCH_001_100,...SEMICONDUCTOR_BATCH_101_200];
 assert.equal(SEMICONDUCTOR_BATCH_001_100.length,100);assert.equal(SEMICONDUCTOR_BATCH_101_200.length,100);
 assert.equal(all.length,200);assert.equal(new Set(all.map(x=>x[1])).size,200);
 assert.equal(new Set(all.map(x=>x[2].toLowerCase().replace(/\/+$/,''))).size,200);
 assert.equal(new Set(all.map(x=>x[3])).size,9);
 for(const [i,[n,name,url,section]] of all.entries()){
 assert.equal(n,i+1);assert.ok(name.length>1);assert.ok(SEMICONDUCTOR_CANDIDATE_SECTIONS.includes(section));
 assert.match(url,/^https?:\/\//);
 assert.ok(!/access_token=|session_id=|openid=/i.test(url));
 if(n>100){const q=v=>String(v).replace(/'/g,"''");
 assert.ok(sql.includes("'hhba-semi-candidate-"+String(n).padStart(3,'0')+"',"+n+",'"+q(name)+"','"+q(url)+"','"+q(section)+"'"),'missing migration row '+n);
 }
 }
 assert.match(firstSql,/collection_sequence INTEGER NOT NULL UNIQUE CHECK\(collection_sequence BETWEEN 1 AND 200\)/);
 assert.doesNotMatch(sql,/INSERT\s+(?:OR IGNORE\s+)?INTO\s+hhba_reviewed_recruitment_sources/i);
 assert.equal((sql.match(/\('hhba-semi-candidate-\d{3}',/g)||[]).length,100);
});
