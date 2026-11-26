import {terminalV4SavedFailure,normalizeV4RecoveryView} from './v4-task-failure-policy.js';
// Private, generation-bound recovery supplement. It is written atomically
// with the browser view, but never returned to the browser. A newer main
// checkpoint always wins; the existing task lease serializes producers.
export function reportRecoverySnapshot(checkpoint,phaseReplay,capturedAt=Date.now()){
 if(!checkpoint||!['research','verification','reporting'].includes(checkpoint.phase))return undefined;
 return structuredClone({checkpoint,phaseReplay,captured_at:capturedAt});
}
export function restoreReportRecovery(saved,view,generation){
 view=normalizeV4RecoveryView(view,generation);
 const r=view?.report_recovery;
 if(!saved||saved.generation!==generation||view?.generation!==generation||view.status!=='PENDING'||saved.result||terminalV4SavedFailure(saved.failure)||!r?.checkpoint||!Number.isSafeInteger(r.captured_at)||r.captured_at<=(saved.checkpoint_captured_at||0)||!['research','verification','reporting'].includes(r.checkpoint.phase))return null;
 return {...saved,checkpoint:r.checkpoint,checkpoint_captured_at:r.captured_at,phaseReplay:r.phaseReplay,progress:view.progress||saved.progress};
}
