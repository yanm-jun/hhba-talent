// Chinese-first query expansion for official ATS job metadata.
// Fail closed on location and work-mode filters; never infer degrees from missing fields.
const roleRules = [
  {pattern:/软件工程师|软件开发|程序员|软件研发/i, terms:["software engineer","software developer","full stack","fullstack","frontend engineer","front-end engineer","backend engineer","back-end engineer"]},
  {pattern:/销售|业务拓展|商务拓展|客户经理/i, terms:["sales","account executive","business development","account manager","sales development"]},
  {pattern:/数据分析|数据科学/i, terms:["data analyst","data scientist","analytics","business intelligence"]},
  {pattern:/产品经理/i, terms:["product manager","product lead"]},
  {pattern:/设计师|产品设计/i, terms:["designer","design"]},
  {pattern:/市场营销|市场推广/i, terms:["marketing","growth"]},
  {pattern:/运营/i, terms:["operations","operation specialist"]},
  {pattern:/实习/i, terms:["intern","internship"]}
];
const locations = [
  {pattern:/新加坡|singapore|\bsg\b/i, names:["singapore"]},
  {pattern:/美国|美國|united states|\busa\b|san francisco|new york|seattle|boston|austin|los angeles|chicago/i,
   names:["united states","usa","u.s.","us","san francisco","new york","seattle","boston","austin","los angeles","chicago","washington dc","washington, d.c.","palo alto","mountain view","menlo park","nyc","california","texas"]},
  {pattern:/英国|英國|united kingdom|\buk\b/i, names:["united kingdom","uk","london","manchester","edinburgh","cambridge, uk"]},
  {pattern:/日本|japan|tokyo|osaka/i, names:["japan","tokyo","osaka"]},
  {pattern:/加拿大|canada/i, names:["canada","toronto","vancouver","montreal"]},
  {pattern:/澳大利亚|澳洲|australia/i, names:["australia","sydney","melbourne","brisbane"]},
  {pattern:/香港|hong kong/i, names:["hong kong","香港"]},
  {pattern:/德国|德國|germany/i, names:["germany","berlin","munich"]},
  {pattern:/法国|法國|france/i, names:["france","paris"]}
];
function includesLocation(location, candidate) {
  const text=String(location||"").toLowerCase();
  // Exact token boundary for short country codes; never match "US" inside "Business".
  if(candidate.length<=4 && /^[a-z.]+$/.test(candidate)) {
    const literal=candidate.replaceAll(".","\\.");
    return new RegExp("(?:^|[^a-z])"+literal+"(?:$|[^a-z])","i").test(text);
  }
  return text.includes(candidate);
}
export function parseJobQuery(value) {
  const raw=String(value||"").trim().slice(0,100);
  let rest=raw;
  const role=roleRules.find(x=>x.pattern.test(rest));
  if(role)rest=rest.replace(role.pattern," ");
  const location=locations.find(x=>x.pattern.test(rest));
  if(location)rest=rest.replace(location.pattern," ");
  const remote=/非远程|线下办公|现场办公|on.?site/i.test(rest)?false:/远程|remote/i.test(rest)?true:null;
  rest=rest.replace(/非远程|线下办公|现场办公|远程|remote|on.?site/gi," ");
  const degreeUnknown=/不限学历|学历不限|没有学历要求|不要求学历|无需学历|无需学位|no degree|degree not required/i.test(rest);
  rest=rest.replace(/不限学历|学历不限|没有学历要求|不要求学历|无需学历|无需学位|no degree|degree not required/gi," ");
  rest=rest.replace(/(?:招聘|工作|职位|岗位|求职|的|找|在|适合|一个|一些)/g," ").trim();
  const residual=rest.toLowerCase().replace(/\s+/g," ").trim();
  return {raw,role:role?.terms||null,location:location?.names||null,remote,degreeUnknown,residual,
    warnings:degreeUnknown?["索引尚未核实学历要求；以下结果只按其他已知条件筛选，不代表岗位不限学历。"]:[]};
}
export function matchesJobQuery(job,query,remoteOverride=null) {
  const title=String(job?.title||"").toLowerCase();
  const fields=[job?.title,job?.company,job?.location].map(x=>String(x||"").toLowerCase()).join(" ");
  const remote=remoteOverride===null?query.remote:remoteOverride;
  if(remote!==null && job.remote!==remote)return false;
  if(query.location && !query.location.some(candidate=>includesLocation(job.location,candidate)))return false;
  if(query.role && !query.role.some(term=>title.includes(term)))return false;
  if(query.residual && !fields.includes(query.residual))return false;
  return true;
}

// Unverified old observations never mix into the default fresh search.
export function matchesJobStatus(job,status){return job.status===(status==="stale"?"stale":"fresh");}
