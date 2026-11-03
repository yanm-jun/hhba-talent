import type {LiveJob} from './liveRecruitment';
export type MarketPresentationOptions={
 pageSize?:number;maxPerCompany?:number;
 priorityOf?:(job:LiveJob)=>number;
 enabled?:boolean;
};
export declare function groupMarketRoles(roles:LiveJob[]):LiveJob[];
export declare function spreadEmployers(roles:LiveJob[],options?:MarketPresentationOptions):LiveJob[];
export declare function presentMarketJobs(roles:LiveJob[],options?:MarketPresentationOptions):{
 rows:LiveJob[];total:number;sourceTotal:number
};
