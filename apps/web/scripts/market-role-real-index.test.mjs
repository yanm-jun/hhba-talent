// End-to-end data acceptance against the REAL approved domestic V2 employer
// records (not fixture placeholders or invented vacancy counts).
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {presentMarketJobs} from '../src/services/marketRolePresentation.mjs';

const server=await createServer({
  root:process.cwd(),appType:'custom',logLevel:'error',
  server:{middlewareMode:true,hmr:false}
});
try{
 const {domesticV2Records,assertDomesticRebuildIntegrity}=
   await server.ssrLoadModule('/src/services/domesticRebuildJobs.ts');
 assertDomesticRebuildIntegrity();
 const original=domesticV2Records;
 assert(original.length>=200,'Approved source must include the existing real employer index');
 const result=presentMarketJobs(original,{pageSize:10,maxPerCompany:2});
 const displayedIds=result.rows.flatMap(row=>row.marketGroup?.variants?.map(v=>v.id)||[row.id]);
 assert.deepEqual(displayedIds.slice().sort(),original.map(row=>row.id).sort(),
  'All approved individual job IDs must survive city aggregation exactly once');
 assert.equal(new Set(displayedIds).size,original.length);
 assert.equal(result.sourceTotal,original.length);
 assert(result.total<=original.length);
 const first=result.rows.slice(0,10);
 assert(new Set(first.map(row=>row.company)).size>=4,
  'First screen must expose several independent employers, not ten similar jobs from one company');
 for(const company of new Set(first.map(row=>row.company))){
  assert(first.filter(row=>row.company===company).length<=2,
   'Overrepresented employer in first screen: '+company);
 }
 // Real source example: two explicitly location-tagged planning algorithm jobs.
 const a='cn-v2-profile-cn-autumn-035-MJ000945';
 const b='cn-v2-profile-cn-autumn-035-MJ000944';
 assert(original.some(row=>row.id===a)&&original.some(row=>row.id===b),
  'Location-specific reviewed source records unexpectedly missing');
 const combined=result.rows.find(row=>row.marketGroup?.variants?.some(v=>v.id===a));
 assert(combined?.marketGroup?.variants.some(v=>v.id===b),
  'Shanghai and Shenzhen versions of the same reviewed algorithm role should share a display card');
 console.log('HHBA_REAL_MARKET_DIVERSITY_GROUPS_OK',{
  original:result.sourceTotal,displayGroups:result.total,
  firstPageEmployers:new Set(first.map(row=>row.company)).size,
  locationVariants:combined.marketGroup.cities
 });
}finally{await server.close();}
