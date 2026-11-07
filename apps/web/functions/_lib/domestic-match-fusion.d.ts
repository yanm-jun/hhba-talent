import type {MatchProfile,MatchedJob,ExternalOfficialCandidate} from '../../src/services/resumeMatch';
export declare const FUSION_VERSION:'HHBA_DOMESTIC_MATCH_FUSION_V1';
export declare function isMainlandWorkCity(value:string):boolean;
export declare function fuseDomesticJobRecommendations(
 inside:MatchedJob[],outside:ExternalOfficialCandidate[],profile:MatchProfile,
 options:{role_hint?:string;limit?:number},now?:number|Date
):{
 kind:'HHBA_DOMESTIC_MATCH_FUSION_V1';scope:'CN_MAINLAND_ONLY';matches:MatchedJob[];
 counts:{internal_eligible:number;external_reviewed:number;external_eligible:number;
 distinct_verified_sources:number;selected_internal:number;selected_external:number};
 disclaimer:string;
};
