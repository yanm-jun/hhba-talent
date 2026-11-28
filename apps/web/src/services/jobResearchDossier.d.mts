import type {MatchedJob} from './resumeMatch';
export type JobResearchMilestone={
 id:'identity'|'jd'|'evidence'|'judgement';
 title:string;state:'complete'|'reference'|'partial'|'pending'|'attention';
 label:string;summary:string;count?:number;
};
export function jobResearchDossier(job:MatchedJob):{
 stages:JobResearchMilestone[];finished:number;officialJd:boolean;
 identityVerified:boolean;referenceJd:boolean;groundedScore:boolean;
 referenceScore:boolean;reportFinished:boolean;
};
