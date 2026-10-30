export type IndexedEmployerRole={id:string;title:string;city?:string;majorNames?:string[];editorialRelatedMajors?:string[];majorUnrestricted?:boolean};
export type IndexedEmployer<T extends IndexedEmployerRole=IndexedEmployerRole>={name:string;englishName?:string;aliases?:string[];jobs:T[]};
export type SearchRoleResult<P extends IndexedEmployer>={profile:P;jobs:P['jobs'];matchedBy:'major'|'company'|'role'};
export declare function isMajorSearch(query:string,knownMajors?:readonly string[]):boolean;
export declare function matchesJobMajor(job:IndexedEmployerRole,major:string):boolean;
export declare function searchEmployersByIndividualRoles<P extends IndexedEmployer>(
 employers:readonly P[],query:string,options?:{selectedMajor?:string;knownMajors?:readonly string[]}
):SearchRoleResult<P>[];
