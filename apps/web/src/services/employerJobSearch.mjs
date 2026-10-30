// Shared, data-only filtering for the ONE HHBA recruitment search.
// Company-name searches may show a whole employer, but major/role searches
// always narrow down to the matching individual job directions.
import {majorFamilies,majorNamesRelated} from './majorEligibility.mjs';

const clean=s=>String(s??'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
const majorKey=s=>clean(s).replace(/\s+/g,'');
export const isMajorSearch=(query,knownMajors=[])=>{
 const q=majorKey(query);
 if(!q)return false;
 return majorFamilies(q).length>0||knownMajors.some(name=>majorKey(name)===q);
};
export const matchesJobMajor=(job,major)=>{
 if(!major)return true;
 // The official/curated per-job major evidence is required. An unrestricted
 // job is NOT disguised as a dedicated mechanical-major job.
 return [...(job.majorNames||[]),...(job.editorialRelatedMajors||[])]
  .some(name=>majorNamesRelated(name,major));
};
export function searchEmployersByIndividualRoles(employers,query,{selectedMajor='',knownMajors=[]}={}){
 const raw=clean(query);
 if(!raw)return [];
 const terms=raw.split(' ').filter(Boolean);
 const majorIntent=isMajorSearch(raw,knownMajors);
 return employers.flatMap(profile=>{
  const labels=[profile.name,profile.englishName,...(profile.aliases||[])].map(clean);
  const matchedCompany=!majorIntent&&terms.every(t=>labels.some(label=>label.includes(t)));
  const jobs=(profile.jobs||[]).filter(job=>{
   if(selectedMajor&&!matchesJobMajor(job,selectedMajor))return false;
   if(majorIntent)return matchesJobMajor(job,raw);
   if(matchedCompany)return true;
   const evidence=clean([job.title,job.city,...(job.majorNames||[]),...(job.editorialRelatedMajors||[])].join(' '));
   return terms.every(t=>evidence.includes(t));
  });
  return jobs.length?[{profile,jobs,matchedBy:majorIntent?'major':matchedCompany?'company':'role'}]:[];
 });
}
