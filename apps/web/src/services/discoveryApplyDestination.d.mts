import type {MatchedJob} from './resumeMatch';

export function discoveryApplyDestination(job: Pick<MatchedJob,
 'official_url' | 'excluded_board' | 'excluded_closed' | 'recruitment_source_kind' | 'availability_status'> | null | undefined):string|null;
