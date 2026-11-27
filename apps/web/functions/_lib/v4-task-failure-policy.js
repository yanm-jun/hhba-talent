// A known recoverable error overrides a legacy retryable:false marker; explicit
// cancellation, authorization or configuration errors always remain terminal.
const recoverableCodes=new Set(['AI_PHASE_RESOURCE_YIELD','AI_PIPELINE_STATE_INVALID','PIPELINE_DISCOVERY_PHASE_INVALID','AI_BACKGROUND_EXECUTION_FAILED','AI_CHECKPOINT_DB_UNAVAILABLE','AI_CHECKPOINT_LEASE_LOST','AI_CHECKPOINT_STORAGE_UNAVAILABLE','AI_BACKGROUND_SCHEDULE_UNAVAILABLE','AI_EDGE_RESOURCE_EXHAUSTED','AI_EDGE_DAILY_LIMIT','AI_PROVIDER_UNAVAILABLE','AI_PROVIDER_NETWORK_ERROR','AI_PROVIDER_UPSTREAM_ERROR','AI_PROVIDER_TIMEOUT','AI_PROVIDER_RATE_LIMITED','AI_PROVIDER_RESPONSE_INVALID','AI_PROVIDER_RESPONSE_EMPTY','AI_PROVIDER_INCOMPLETE','AI_BACKGROUND_RESPONSE_INVALID','AI_BACKGROUND_TRANSPORT_INTERRUPTED','AI_BACKGROUND_RESPONSE_INCOMPLETE','AI_BACKGROUND_HTTP_408','AI_BACKGROUND_HTTP_425','AI_TASK_IN_PROGRESS']);
const terminalCodes=new Set(['AI_AGENT_CANCELLED','AI_TASK_USER_CANCELLED','AI_AUTH_SESSION_EXPIRED','AI_TASK_SUPERSEDED','AI_TASK_CLOSED','AI_TASK_NOT_ACTIVE','AI_BACKGROUND_TICKET_INVALID','AI_CHECKPOINT_EXPIRED','AI_PROVIDER_KEY_REJECTED','AI_PROVIDER_BALANCE_INSUFFICIENT','AI_PROVIDER_NOT_CONFIGURED','AI_PROVIDER_UNSUPPORTED','AI_PROVIDER_REQUEST_REJECTED','AI_PROVIDER_REDIRECT_BLOCKED','AI_BACKGROUND_REQUEST_INVALID','AI_BACKGROUND_REDIRECT_BLOCKED','AI_CHECKPOINT_INVALID','AI_CHECKPOINT_ALREADY_USED','AI_BACKGROUND_TASK_PAUSED']);
export const isV4RetryableTaskFailure=code=>recoverableCodes.has(code);
export const isV4TerminalTaskFailure=code=>terminalCodes.has(code);
export const retryableV4SavedFailure=failure=>!!failure&&!isV4TerminalTaskFailure(failure.error)&&(failure.retryable===true||isV4RetryableTaskFailure(failure.error));
export const terminalV4SavedFailure=failure=>!!failure&&!retryableV4SavedFailure(failure);
export function normalizeV4RecoveryRecord(saved,generation){
 if(saved?.generation!==generation||saved.result||!saved.failure||!retryableV4SavedFailure(saved.failure)||saved.failure.retryable===true)return saved;
 return {...saved,failure:{...saved.failure,retryable:true}};
}
export function normalizeV4RecoveryView(view,generation){
 if(view?.generation!==generation||!['FAILED','PENDING'].includes(view.status)||!retryableV4SavedFailure(view.failure))return view;
 if(view.status==='PENDING'&&view.failure.retryable===true)return view;
 return {...view,status:'PENDING',failure:{...view.failure,retryable:true}};
}
// A host-resource failure asks for a smaller *invocation*, never less research.
export const v4RecoveredResourcePhase=code=>code==='AI_EDGE_RESOURCE_EXHAUSTED'||code==='AI_PHASE_RESOURCE_YIELD';

// Keep relay transport remediation scoped to one encrypted task generation.
// Only a specific SSE failure warrants JSON failover; ordinary HTTP 5xx and
// network failures retain the configured transport until evidence says otherwise.
export const v4RecoveredTransportMode=(checkpoint,failure,recoveryHint)=>
 checkpoint?.transport_mode==='json'||failure?.upstream_kind==='SSE_FAILED'||
 // Legacy in-flight tasks predating upstream-kind diagnostics only have the
 // durable retry error. A matching Workflow recovery hint confirms another
 // attempt of the same failed stage, so try the alternate transport once.
 (recoveryHint==='AI_PROVIDER_UPSTREAM_ERROR'&&failure?.error==='AI_PROVIDER_UPSTREAM_ERROR')||
 // A completed Pages response lost its SSE terminal marker. Switch only
 // this task generation to the provider's non-SSE transport for the next
 // attempt; keep the same saved research checkpoint and model capability.
 recoveryHint==='AI_BACKGROUND_RESPONSE_INCOMPLETE'||recoveryHint==='AI_BACKGROUND_TRANSPORT_INTERRUPTED'
 ?'json':'sse';
export const v4StampTransport=(checkpoint,mode)=>
 mode==='json'&&checkpoint?{...checkpoint,transport_mode:'json'}:checkpoint;
