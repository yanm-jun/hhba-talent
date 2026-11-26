import type {MatchedJob} from './resumeMatch';
export function createLiveCandidateReception(onJobs?: (jobs:MatchedJob[])=>void):{
 receive(event:unknown):boolean;
 snapshot(jobs:MatchedJob[],options?:{final?:boolean}):number;
};
