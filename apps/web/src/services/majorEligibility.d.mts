export declare function majorFamilies(name:string):string[];
export declare function majorNamesRelated(label:string,selected:string):boolean;
export declare function educationRequirement(value:string|null|undefined):{minimum:string|null;only:string|null};
export declare function educationMatchesApplicant(selection:string,requirement:string|null|undefined):boolean;
