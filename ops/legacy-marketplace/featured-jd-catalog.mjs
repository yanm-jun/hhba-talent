/**
 * Merge featured, independently verified native-index jobs into the existing
 * ATS reader queue. Do not invent missing jobs or mark the source complete
 * when at least one highlighted job could not be independently verified.
 */
export function mergeFeaturedATS(catalog, featured, ids){
 if(!catalog||!Array.isArray(catalog.rows)||!Array.isArray(featured)||
    !Array.isArray(ids)||new Set(ids).size!==ids.length)
  throw Error('INVALID_FEATURED_JD_CATALOG');
 const mapped=new Map(catalog.rows.map(j=>[j.id,j]));
 let missing=0;
 for(let i=0;i<ids.length;i++){
  const job=featured[i],id=ids[i];
  if(!job||job.id!==id||!['ashby','greenhouse','lever'].includes(job.platform)||
    typeof job.url!=='string'||!job.url.startsWith('https://')){
   missing++;
   continue;
  }
  mapped.set(id,job);
 }
 return {...catalog,rows:[...mapped.values()],
  failures:catalog.failures+(missing>0?1:0),featuredReady:ids.length-missing};
}
