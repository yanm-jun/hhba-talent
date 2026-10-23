import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const batch=JSON.parse(readFileSync('src/data/domesticCompanyBatch001.json','utf8'));
const roster=JSON.parse(readFileSync('src/data/domesticListedCompanies.json','utf8'));
const profiles=JSON.parse(readFileSync('src/data/domesticCareerProfiles.json','utf8'));
const byName=new Map(roster.companies.map(r=>[r.name,r]));
const previousFull=["华域视觉科技（上海）有限公司","华域汽车","上汽集团","汇川技术","中国中车","美的集团","雷赛智能","正泰电器","英威腾","思源电气","许继电气","亿纬锂能","紫光股份","立讯精密","华安证券","广发证券","中信证券","东方证券","华泰证券","光大证券"];
const approved=(p)=>Boolean(p?.officialSource?.startsWith('https://')&&p.description?.length>=3&&
 p.description.join('').length>=280&&p.business?.length>=3&&p.majorSlugs?.length>=4);
const approvedItems=[];
const pendingItems=[];
const misclassified=[];
const names=[];
const seen=new Set();
for(const row of batch.rows){
 const company=byName.get(row.name);
 if(!company)misclassified.push({name:row.name,error:'not an existing listed-company identity'});
 if(company&&company.code!==row.stockCode)misclassified.push({name:row.name,error:'stock code mismatch'});
 if(seen.has(row.name))misclassified.push({name:row.name,error:'duplicate in batch'});
 seen.add(row.name);
 const p=profiles[row.name];
 const valid=approved(p);
 const expected=valid?'LONGFORM_CONTENT_READY':p?'EXISTING_PARTIAL_REQUIRES_SOURCE_EXPANSION':'OFFICIAL_SOURCE_PENDING';
 if(row.stage!==expected)misclassified.push({name:row.name,error:'stage out of sync',stage:row.stage,expected});
 if(valid){
  approvedItems.push({name:row.name,code:row.stockCode,source:p.officialSource,chars:p.description.join('').length,
   logoApproved:p.brandAssetStatus==='official_logo_visually_verified',photographicEvidence:(p.photos||[]).length,officialRecruitment:p.careersUrl||null});
  if(p.business.some(b=>!b.title||!b.description))misclassified.push({name:row.name,error:'empty business line'});
  if(new Set(p.business.map(x=>x.title)).size!==p.business.length)misclassified.push({name:row.name,error:'repeated business headings'});
 }else pendingItems.push({name:row.name,code:row.stockCode,stage:expected});
 if(row.isNewProfileThisBatch&&!valid)misclassified.push({name:row.name,error:'claimed completed but not approved'});
 names.push(row.name);
}
const summary={
 batchId:batch.batchId,target:batch.target,checked:batch.rows.length,
 upgradedThisBatch:batch.rows.filter(x=>x.isNewProfileThisBatch&&approved(profiles[x.name])).length,
 alreadyLongformInBatch:approvedItems.length-batch.rows.filter(x=>x.isNewProfileThisBatch&&approved(profiles[x.name])).length,
 totalBatchLongform:approvedItems.length,
 batchPartial:pendingItems.filter(x=>x.stage==='EXISTING_PARTIAL_REQUIRES_SOURCE_EXPANSION').length,
 batchSourcePending:pendingItems.filter(x=>x.stage==='OFFICIAL_SOURCE_PENDING').length,
 companyIdentityAdditions:0,issues:misclassified.length,
 verifiedOfficialLogos:approvedItems.filter(x=>x.logoApproved).length,
 withDeclaredPhotos:approvedItems.filter(x=>x.photographicEvidence>0).length,
 withExactCareers:approvedItems.filter(x=>x.officialRecruitment).length
};
mkdirSync('preview-reports',{recursive:true});
writeFileSync('preview-reports/company-batch-001-qa.json',JSON.stringify({summary,approvedItems,pendingItems,misclassified},null,2)+'\n');
writeFileSync('preview-reports/company-batch-001-qa.md',[
 '# HHBA 第一批 100 家现有上市企业：可审计交付',
 '',
 '> 100 家是待处理批次容量，不代表已经完成 100 篇。长文、Logo、实景照片和招聘入口分别验收。',
 '',
 '| 项目 | 数量 |','|---|---:|',
 ...Object.entries(summary).filter(([k,v])=>typeof v==='number').map(([k,v])=>'| '+k+' | '+v+' |'),
 '',
 '## 本轮新增完成的长文文章',
 ...batch.rows.filter(x=>x.isNewProfileThisBatch&&approved(profiles[x.name])).map(x=>'- '+x.name+'（'+x.stockCode+'）来源：'+profiles[x.name].officialSource),
 '',
 '## 尚待正式资料核验的名单',
 ...pendingItems.map(x=>'- '+x.name+'（'+x.code+'） '+x.stage)
 ].join('\n')+'\n');
console.log('HHBA_BATCH_001_QUALITY',JSON.stringify(summary));
test('batch contains exactly 100 old A-share issuers with no added identities',()=>{
 assert.equal(batch.target,100);
 assert.equal(batch.rows.length,100);
 assert.equal(seen.size,100);
 assert.equal(misclassified.length,0,JSON.stringify(misclassified.slice(0,8)));
 for(const x of batch.rows)assert(byName.has(x.name));
});
test('only source-backed unique substantive business articles count as upgrades',()=>{
 assert(summary.upgradedThisBatch>=15);
 assert(summary.totalBatchLongform>=summary.upgradedThisBatch);
 assert(approvedItems.every(x=>x.source.startsWith('https://')));
 for(const record of approvedItems)assert(record.chars>=280);
});
test('unfinished records remain visibly queued rather than being mass-produced filler',()=>{
 assert(summary.batchPartial+summary.batchSourcePending+summary.totalBatchLongform===100);
 assert(summary.batchPartial>0&&summary.batchSourcePending>0);
});
test('each exact-recruitment URL and local media remain independent quality dimensions',()=>{
 const inspected=batch.rows.filter(x=>approved(profiles[x.name]));
 for(const r of inspected){
  const p=profiles[r.name];
  if(p.careersUrl)assert(new URL(p.careersUrl).protocol==='https:');
  assert(p.photoSourcePage?.startsWith('https://'),'Expected verified company source page: '+r.name);
  assert(!p.brandImage||p.brandImageSource,'Untraceable candidate logo: '+r.name);
 }
});
