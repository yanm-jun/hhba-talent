import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createD1TalentEmployerResolver } from '../functions/_lib/talent-search-employer-store.js';

let DatabaseSync=null;
try { ({DatabaseSync}=await import('node:sqlite')); } catch { /* optional SQLite in old Node */ }

const now=new Date('2026-11-15T05:00:00Z');
const company='示例连锁运营集团有限公司';
const root='example-retail.cn';
const employerJob='https://careers.example-retail.cn/jobs/regional-operation-2026';
const atsJob='https://jobs.ashbyhq.com/example-retail/0d72c51b-3441-4a30-bc61-2b8d13e1204e';
const rogueJob='https://jobs.ashbyhq.com/unrelated/0d72c51b-3441-4a30-bc61-2b8d13e1204e';

function wrap(sqlite) {
  return {
    prepare(sql) {
      const statement=sqlite.prepare(sql);
      return {
        bind(...params) {
          return {
            first:async()=>statement.get(...params)||null,
          };
        },
      };
    },
  };
}
async function setup(){
  const sqlite=new DatabaseSync(':memory:');
  const sql=await readFile(new URL('../d1/0020_talent_official_source_proofs.sql',import.meta.url),'utf8');
  sqlite.exec(sql);
  const id='employer-audit-20261115-0001';
  sqlite.prepare(
    'INSERT INTO hhba_talent_employer_proofs_v1' +
    '(id,company,official_domain,aliases_json,careers_url,issuer,status,' +
    'evidence_url,evidence_quote,reviewer_id,verified_at,created_at,updated_at)' +
    ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).run(
    id,company,root,JSON.stringify(['示例连锁运营集团']),
    'https://www.example-retail.cn/careers',
    'independent_company_audit','verified',
    'https://www.example-retail.cn/about',
    '我们是示例连锁运营集团有限公司，官方招聘页面可通过企业主页进入。',
    'reviewer-human-1','2026-11-14T04:00:00Z',
    '2026-11-14T03:00:00Z','2026-11-14T04:00:00Z',
  );
  const atsId='ats-audit-20261115-0001';
  sqlite.prepare(
    'INSERT INTO hhba_talent_ats_tenants_v1' +
    '(id,employer_proof_id,ats_host,tenant_prefix,authorized_careers_url,' +
    'official_link_url,status,reviewer_id,verified_at,created_at,updated_at)' +
    ' VALUES(?,?,?,?,?,?,?,?,?,?,?)',
  ).run(
    atsId,id,'jobs.ashbyhq.com','/example-retail',
    'https://www.example-retail.cn/careers',
    'https://jobs.ashbyhq.com/example-retail',
    'verified','reviewer-human-2','2026-11-14T04:00:00Z',
    '2026-11-14T03:00:00Z','2026-11-14T04:00:00Z',
  );
  return {sqlite,db:wrap(sqlite),id,atsId};
}

test('additive migration creates isolated employer proof, ATS tenant and pending candidate tables',
  {skip:!DatabaseSync},async()=>{
    const {sqlite}=await setup();
    try{
      const names=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name);
      assert.ok(names.includes('hhba_talent_employer_proofs_v1'));
      assert.ok(names.includes('hhba_talent_ats_tenants_v1'));
      assert.ok(names.includes('hhba_talent_source_candidates_v1'));
    }finally{sqlite.close();}
  });

test('verified independent employer record resolves new corporate subdomains with no static company list',
  {skip:!DatabaseSync},async()=>{
    const {sqlite,db,id}=await setup();
    try{
      const resolver=createD1TalentEmployerResolver(db,{now});
      const proof=await resolver.getEmployerProof({url:employerJob});
      assert.equal(proof.record_id,id);
      assert.equal(proof.company,company);
      assert.deepEqual(proof.aliases,['示例连锁运营集团']);
      assert.equal(proof.official_domain,root);
      assert.equal(await resolver.getOfficialCareersUrl(proof),
        'https://www.example-retail.cn/careers');
    }finally{sqlite.close();}
  });

test('approved ATS tenant resolves its own company, not any employer on the shared vendor domain',
  {skip:!DatabaseSync},async()=>{
    const {sqlite,db}=await setup();
    try{
      const resolver=createD1TalentEmployerResolver(db,{now});
      const good=await resolver.getEmployerProof({url:atsJob});
      assert.equal(good.company,company);
      assert.equal(good.ats_tenant_prefix,'/example-retail');
      assert.equal(await resolver.getOfficialCareersUrl(good),
        'https://www.example-retail.cn/careers');
      assert.equal(await resolver.getEmployerProof({url:rogueJob}),null);
    }finally{sqlite.close();}
  });

test('revoked parent employer proof immediately invalidates first-party and ATS source results',
  {skip:!DatabaseSync},async()=>{
    const {sqlite,db,id}=await setup();
    try{
      const resolver=createD1TalentEmployerResolver(db,{now});
      assert.ok(await resolver.getEmployerProof({url:atsJob}));
      sqlite.prepare("UPDATE hhba_talent_employer_proofs_v1 SET status='revoked' WHERE id=?")
        .run(id);
      assert.equal(await resolver.getEmployerProof({url:atsJob}),null);
      assert.equal(await resolver.getEmployerProof({url:employerJob}),null);
    }finally{sqlite.close();}
  });

test('revoked ATS authorization immediately invalidates only the ATS tenant',
  {skip:!DatabaseSync},async()=>{
    const {sqlite,db,atsId}=await setup();
    try{
      const resolver=createD1TalentEmployerResolver(db,{now});
      sqlite.prepare("UPDATE hhba_talent_ats_tenants_v1 SET status='revoked' WHERE id=?")
        .run(atsId);
      assert.equal(await resolver.getEmployerProof({url:atsJob}),null);
      assert.ok(await resolver.getEmployerProof({url:employerJob}));
    }finally{sqlite.close();}
  });

test('provider and job-board links cannot mint corporate provenance or trigger a D1 scan',async()=>{
  let calls=0;
  const resolver=createD1TalentEmployerResolver({
    prepare(){calls++;throw Error('Unexpected D1 read');},
  },{now});
  assert.equal(await resolver.getEmployerProof({url:'https://www.zhipin.com/job_detail/123456.html'}),null);
  assert.equal(await resolver.getEmployerProof({url:'http://127.0.0.1:8080/admin'}),null);
  assert.equal(calls,0);
});

test('D1 errors fail closed without falling back to search snippets as proof',async()=>{
  const resolver=createD1TalentEmployerResolver({
    prepare(){throw Error('no such table or D1 quota exceeded');},
  },{now});
  assert.equal(await resolver.getEmployerProof({url:employerJob}),null);
});

test('records with expired verification are not considered trustworthy',
  {skip:!DatabaseSync},async()=>{
    const {sqlite,db,id}=await setup();
    try{
      sqlite.prepare(
        "UPDATE hhba_talent_employer_proofs_v1 SET verified_at='2025-01-01T00:00:00Z' WHERE id=?",
      ).run(id);
      const resolver=createD1TalentEmployerResolver(db,{now});
      assert.equal(await resolver.getEmployerProof({url:employerJob}),null);
    }finally{sqlite.close();}
  });
