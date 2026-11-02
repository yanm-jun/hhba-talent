// Adapter ONLY. The original /preview-admin/ DOM, navigation, page layout and modules remain unchanged.
// No mock values: production account statistics are explicitly null until production auth is enabled.
const integer=value=>Number.isSafeInteger(value)&&value>=0?value:null;
export function normalizePublicMetrics(raw){
 if(raw?.kind!=='HHBA_CLOUDFLARE_PUBLIC_METRICS_V1'||!raw.counts)throw Error('CLOUDFLARE_PUBLIC_SOURCE_INVALID');
 const c=raw.counts;
 return {
  kind:'HHBA_PUBLIC_RECRUITMENT_OVERVIEW_V2',quality:raw.quality,
  asOf:raw.sourceTime,auditCheckedAt:raw.auditCheckedAt,
  counts:{
   indexedJobs:integer(c.indexedJobs),displayableJobs:integer(c.displayableJobs),
   auditedJobRequirements:integer(c.auditedJobRequirements),
   distinctIndexedCompanies:integer(c.distinctIndexedCompanies),
   checkedAtsSources:integer(c.checkedAtsSources),failedAtsSources:integer(c.failedAtsSources)
  },
  definitions:{
   indexedJobs:'同批次 Cloudflare 官方来源索引总记录数，非当前可申请岗位',
   displayableJobs:raw.definitions?.displayableJobs||'已排除无效记录的展示数量，非真实投递数',
   auditedJobRequirements:raw.definitions?.auditedJobRequirements||'官方岗位说明和任职要求均有核验证据',
   distinctIndexedCompanies:'按名称去重收录企业，非入驻或签约企业'
  }
 }
}
export function normalizePrivateMetrics(raw){
 if(raw?.kind!=='HHBA_CLOUDFLARE_PRIVATE_METRICS_V1'||!raw.traffic||!raw.devices||!raw.account)throw Error('CLOUDFLARE_PRIVATE_SOURCE_INVALID');
 const t=raw.traffic,b=raw.devices;
 return {
  kind:'HHBA_PRIVATE_GROWTH_V1',asOf:raw.asOf,
  period:{from:raw.period?.start,to:raw.period?.end,days:raw.period?.days,timezone:'UTC'},
  traffic:{
   quality:t.quality,pv:integer(t.pv),dailyUvSum:integer(t.dailyUvSum),jobViews:integer(t.jobViews),
   searches:integer(t.searches),applyClicks:integer(t.outboundClicks),
   series:Array.isArray(t.series)?t.series.map(x=>({date:x.day,pv:integer(x.pv),uv:integer(x.dailyUv)})):[]
  },
  bookmarks:{
   quality:b.quality,totalActive:integer(b.savedJobs),devicesWithBookmarks:integer(b.devicesWithSavedJobs),
   added:integer(b.added),removed:integer(b.removed)
  },
  account:{
   quality:raw.account.quality,registeredUsers:integer(raw.account.registeredUsers),
   dau:integer(raw.account.dau),mau:integer(raw.account.mau),reason:raw.account.reason
  },
  definitions:{
   pv:'已同意匿名统计的页面浏览，按设备和事件每分钟去重',
   dailyUvSum:'每天去重访客之和，并非整段时间独立人数',
   bookmarks:'Cloudflare 匿名设备级持久收藏，非真实注册用户数'
  }
 }
}
