import {TALENT_POLICY_RECORDS,type TalentPolicyRecord} from './talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS,type TalentHousingRecord} from './talentHousingRecords.ts';
import {findTalentCity} from './talentCityRegistry.ts';
/** Single source for city-page counts and nationwide release audit.
 * No records never means a place has no policy or vacant homes. */
export function getTalentCitySnapshot(city:string):{
 policies:TalentPolicyRecord[];homes:TalentHousingRecord[];policyCount:number;housingCount:number;isEmpty:boolean
}{
 // Nationwide city entries use a short canonical name, while public URLs and
 // government documents often use the official suffix (e.g. 银川市). Resolve
 // exactly through the registry, not by stripping a random last character.
 const canonical=findTalentCity(city)?.name||city.trim();
 const policies=TALENT_POLICY_RECORDS.filter(p=>p.city===canonical);
 const homes=TALENT_HOUSING_RECORDS.filter(h=>h.city===canonical);
 return {policies,homes,policyCount:policies.length,housingCount:homes.length,isEmpty:policies.length===0&&homes.length===0};
}
