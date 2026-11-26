// A known recoverable error overrides a legacy retryable:false marker; explicit
// cancellation, authorization or configuration errors always remain terminal.
const recoverableCodes=new Set(['AI_PHASE_RESOURCE_YIELD','AI_PIPELINE_STATE_INVALID','AI_BACKGROUND_EXECUTION_FAILED','AI_CHECKPOINT_DB_UNAVAILABLE','AI_CHECKPOINT_LEASE_LOST','AI_CHECKPOINT_STORAGE_UNAVAILABLE','AI_BACKGROUND_SCHEDULE_UNAVAILABLE','AI_EDGE_RESOURCE_EXHAUSTED','AI_EDGE_DAILY_LIMIT','AI_PROVIDER_UNAVAILABLE','AI_PROVIDER_NETWORK_ERROR','AI_PROVIDER_UPSTREAM_ERROR','AI_PROVIDER_TIMEOUT','AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_RESPONSE_INVALID','AI_PROVIDER_RESPONSE_EMPTY','AI_PROVIDER_INCOMPLETE','AI_BACKGROUND_RESPONSE_INVALID','AI_BACKGROUND_TRANSPORT_INTERRUPTED','AI_BACKGROUND_RESPONSE_INCOMPLETE','AI_BACKGROUND_HTTP_408','AI_BACKGROUND_HTTP_425','AI_TASK_IN_PROGRESS']);
const terminalCodes=new Set(['AI_AGENT_CANCELLED','AI_BACKGROUND_TICKET_INVALID','AI_CHECKPOINT_EXPIRED','AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT','AI_PROVIDER_NOT_CONFIGURED','AI_PROVIDER_UNSUPPORTED','AI_PROVIDER_REQUEST_REJECTED','AI_PROVIDER_REDIRECT_BLOCKED','AI_BACKGROUND_REQUEST_INVALID','AI_BACKGROUND_REDIRECT_BLOCKED','AI_CHECKPOINT_INVALID','AI_CHECKPOINT_ALREADY_USED','AI_BACKGROUND_TASK_PAUSED']);
export const isV4RetryableTaskFailure=code=>recoverableCodes.has(code);
export const isV4TerminalTaskFailure=code=>terminalCodes.has(code);
export const retryableV4SavedFailure=failure=>!!failure&&!isV4TerminalTaskFailure(failure.error)&&(failure.retryable===true||isV4RetryableTaskFailure(failure.error));
export const terminalV4SavedFailure=failure=>!!failure&&!retryableV4SavedFailure(failure);
export function normalizeV4RecoveryRecord(saved,generation){
 if(saved?.generation!==generation||saved.result||!saved.failure||!retryableV4SavedFailure(saved.failure)||saved.failure.retryable===true)return saved;
 return {...saved,failure:{...saved.failure,retryable:true}};
}
export function normalizeV4RecoveryView(view,generation){
 if(view?.generation!==generation||view.status!=='FAILED'||!retryableV4SavedFailure(view.failure))return view;
 return {...view,status:'PENDING',failure:{...view.failure,retryable:true}};
}
// A host-resource failure asks for a smaller *invocation*, never less research.
export const v4RecoveredResourcePhase=code=>code==='AI_EDGE_RESOURCE_EXHAUSTED'||code==='AI_PHASE_RESOURCE_YIELD';
