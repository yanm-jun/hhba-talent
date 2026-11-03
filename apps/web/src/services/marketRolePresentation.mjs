// Presentation-only grouping and employer diversity for HHBA's job market.
// Every original ID survives in its own city variant; never fabricate a role
// or replace the reviewed source records. This runs on the FULL filtered list,
// before the existing 30-result fetch window and 10-card UI pagination.
const norm=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[\s·．.（）()、\\—–-]/g,'').replace(/\//g,'').trim();
const cityName=job=>String(job.locationZh||job.location||'').trim();
const employerKey=job=>norm(job.companyZh||job.company)||norm(job.company)||job.id;
function citiesIn(job){
 const raw=cityName(job);
 if(!raw||/^(?:未知|待定|不限|全国|远程|remote|多城市|地点待核实)$/i.test(raw))return [];
 return raw.replace(/（可选）|\(可选\)/g,'').split(/[、，,;；\/｜|]/)
  .map(x=>x.trim()).filter(Boolean)
  .map(label=>({label,key:norm(label).replace(/(?:省|市)$/,'')}))
  .filter(x=>x.key.length>=2);
}
function baseTitle(job){
 const title=String(job.titleZh||job.title||'').trim();
 const matched=/^(.*?)[（(]([^()（）]{2,20})[）)]\s*$/.exec(title);
 if(!matched)return title;
 const tail=norm(matched[2]);
 return citiesIn(job).some(city=>city.key===tail||city.key===tail.replace(/市$/,''))?matched[1].trim():title;
}
function groupKey(job){
 const title=baseTitle(job), cities=citiesIn(job);
 if(!title||!cities.length)return null;
 // Company, recruiting body, source, work mode and job type must agree.
 // Similar generic titles in different departments are NOT the same role.
 return [employerKey(job),norm(job.source||''),norm(job.positionOrg||''),
  norm(title),norm(job.recruitmentType||''),job.remote===true?'remote':'onsite'].join('::');
}
export function groupMarketRoles(roles){
 if(!Array.isArray(roles))throw new TypeError('INVALID_MARKET_ROWS');
 const groups=[],lookup=new Map();
 for(const job of roles){
  const key=groupKey(job),place=citiesIn(job),eligible=key!==null;
  const candidateGroups=eligible?(lookup.get(key)||[]):[];
  // Never collapse two distinct role IDs advertised in the same city.
  let found=null;
  for(const group of candidateGroups){
   if(place.every(city=>!group.cities.has(city.key))){found=group;break;}
  }
  if(found){
   found.roles.push(job);
   for(const city of place)found.cities.add(city.key);
  }else{
   const group={roles:[job],cities:new Set(place.map(city=>city.key)),title:baseTitle(job)};
   groups.push(group);
   if(eligible)lookup.set(key,[...candidateGroups,group]);
  }
 }
 return groups.map(group=>{
  if(group.roles.length===1)return group.roles[0];
  const variants=group.roles.map(role=>({
   id:role.id,title:role.title,titleZh:role.titleZh,
   location:role.location,locationZh:role.locationZh
  }));
  const distinctCities=[];
  const cityKeys=new Set();
  for(const role of group.roles)for(const city of citiesIn(role)){
   if(!cityKeys.has(city.key)){cityKeys.add(city.key);distinctCities.push(city.label);}
  }
  return {...group.roles[0],marketGroup:{
   title:group.title,cities:distinctCities,variants
  }};
 });
}
// Page-wide soft cap: at most two cards per employer when other employers
// of the SAME relevance tier are available. Never promote unrestricted roles
// above a professional match just to fill a diverse-looking page.
export function spreadEmployers(roles,{pageSize=10,maxPerCompany=2,priorityOf=()=>0,enabled=true}={}){
 if(!enabled||roles.length<2)return roles.slice();
 const tiers=new Map();
 for(const job of roles){
  const priority=Number(priorityOf(job))||0;
  if(!tiers.has(priority))tiers.set(priority,[]);
  tiers.get(priority).push(job);
 }
 const output=[],used=new Map();
 for(const priority of [...tiers.keys()].sort((a,b)=>b-a)){
  const buckets=new Map();
  const ordered=tiers.get(priority);
  for(let i=0;i<ordered.length;i++){
   const job=ordered[i],key=employerKey(job);
   if(!buckets.has(key))buckets.set(key,{key,rows:[],cursor:0});
   buckets.get(key).rows.push({job,index:i});
  }
  const all=[...buckets.values()];
  let left=ordered.length;
  while(left>0){
   if(output.length%pageSize===0)used.clear();
   let chosen=null,bestCount=Infinity,bestIndex=Infinity;
   for(const bucket of all){
    if(bucket.cursor>=bucket.rows.length)continue;
    const count=used.get(bucket.key)||0;
    if(count>=maxPerCompany)continue;
    const index=bucket.rows[bucket.cursor].index;
    if(count<bestCount||(count===bestCount&&index<bestIndex)){
     chosen=bucket;bestCount=count;bestIndex=index;
    }
   }
   // Fallback when there are not enough employers of equal relevance.
   if(!chosen){
    for(const bucket of all){
     if(bucket.cursor>=bucket.rows.length)continue;
     const index=bucket.rows[bucket.cursor].index;
     if(index<bestIndex){chosen=bucket;bestIndex=index;}
    }
   }
   const picked=chosen.rows[chosen.cursor++].job;
   output.push(picked);left--;
   used.set(chosen.key,(used.get(chosen.key)||0)+1);
  }
 }
 return output;
}
export function presentMarketJobs(roles,options={}){
 const grouped=groupMarketRoles(roles);
 const diversified=spreadEmployers(grouped,options);
 return {rows:diversified,total:diversified.length,sourceTotal:roles.length};
}
