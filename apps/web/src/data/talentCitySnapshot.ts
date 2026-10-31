import {TALENT_POLICY_RECORDS,type TalentPolicyRecord} from './talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS,type TalentHousingRecord} from './talentHousingRecords.ts';
/** Single source for city-page counts and nationwide release audit.
 * No records never means a place has no policy or vacant homes. */
export function getTalentCitySnapshot(city:string):{
 policies:TalentPolicyRecord[];homes:TalentHousingRecord[];policyCount:number;housingCount:number;isEmpty:boolean
}{
 const policies=TALENT_POLICY_RECORDS.filter(p=>p.city===city);
 const homes=TALENT_HOUSING_RECORDS.filter(h=>h.city===city);
 return {policies,homes,policyCount:policies.length,housingCount:homes.length,isEmpty:policies.length===0&&homes.length===0};
}
