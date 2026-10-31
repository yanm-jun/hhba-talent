import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const legacy=['Kpmg','Schneider','Pfizer','Csair','SfExpress','NeteaseGames','Hypergryph','Anker','Laifen','Shkp'];
const main=read('src/main.tsx');
for(const [i,n] of legacy.entries()){
 const id='cn-autumn-'+String(i+1).padStart(3,'0');
 const t=read('src/pages/'+n+'CompactProfilePage.tsx');
 assert(main.includes("route==='/companies/autumn/"+id+"'"),id+' route lost');
 assert(t.includes('data-company-template="unified-v2"'),id+' shared V2 page semantics missing');
 assert(t.includes('data-four-block-contract="hero,majors,jobs,business"'),id+' four panel contract missing');
 assert(t.includes('data-employer-id="'+id+'"'),id+' wrong company');
 assert(t.includes('hhba-kpmg-hero')&&t.includes('hhba-kpmg-photo-grid'),id+' logo/photos panel missing');
 assert(t.includes('<CompanyMajorJobs companyRoute="/companies/autumn/'+id+'"'),id+' major + individual job panels missing');
 assert(t.includes('主要业务与专业服务'),id+' service panel missing');
}
const ui=read('src/pages/UnifiedV2CompanyPage.tsx');
assert(ui.includes("p.recruitment.status==='archived_source'?'查看招聘公告（非网申）'"),'archived source must never be mislabeled official recruitment');
const market=read('src/components/DomesticAutumnMarket.tsx');
assert(market.includes('archiveLink(e)')&&market.includes('公开招聘公告（非官方网申）'),'market directory must distinguish evidence-only links');
const ids=['049','050','054','055','056','062','063','064','065'];
const official=['054','056','063'];
let changed=0;
for(const id of ids){
 const p=JSON.parse(read('src/data/employerProfiles/cn-autumn-'+id+'.json'));
 assert.equal(p.recruitment.status,official.includes(id)?'official_portal':'archived_source',id+' destination status mismatch');
 assert(p.recruitment.url.startsWith('https://'));
 assert(p.jobs.every(x=>x.url===p.recruitment.url),id+' job URL must track source classification');
 assert(p.jobs.every(x=>x.currentOpenVerified===false),id+' cannot claim live 2027 slots');
 changed++;
}
const unspecified=JSON.parse(read('src/data/employerProfiles/cn-autumn-030.json')).jobs.find(j=>j.id==='trainee-general');
assert(!unspecified.majorUnrestricted&&!unspecified.majorNames.length&&!unspecified.editorialRelatedMajors.length,'unverified majors must not be fabricated');
console.log('HHBA_P2_CONTRACT_PASS',JSON.stringify({unifiedLegacyPages:legacy.length,reclassifiedRecruitment:changed,officialPortals:official.length,archivedSources:changed-official.length,unknownMajorExplicit:true}));
