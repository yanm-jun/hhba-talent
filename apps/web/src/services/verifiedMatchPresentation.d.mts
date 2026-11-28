import type {MatchedJob} from './resumeMatch';
export function isVerifiedMatchReport(job:MatchedJob|undefined|null):boolean;
export function verifiedMatchReports(jobs:MatchedJob[]):MatchedJob[];

export function orderVerifiedMatchReports(jobs:MatchedJob[],mode?:'recommendation'|'score'):MatchedJob[];
