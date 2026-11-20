export type ChangedResumeText={prefix:string;changed:string;suffix:string;hasChange:boolean};
export declare function splitChangedResumeText(original:string|null|undefined,updated:string|null|undefined):ChangedResumeText;
