export declare const JOBS_PER_PAGE:10;
export declare const FETCH_BATCH_SIZE:30;
export declare function pageCount(total:number):number;
export declare function batchOffsetForPage(page:number):number;
export declare function sliceJobsForPage<T>(rows:readonly T[],page:number):T[];
export declare function validJumpPage(value:string,total:number):number|null;
export declare function visiblePageTokens(page:number,total:number):Array<number|'dots'>;
