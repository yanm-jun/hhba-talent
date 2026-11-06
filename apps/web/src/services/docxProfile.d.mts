export declare const PROFILE_FIELD_LABELS: ReadonlyArray<readonly [string,string]>;
export declare const EMPTY_PROFILE: Readonly<Record<string,string>>;
export declare function cleanProfile(input:unknown): Record<string,string>;
export declare function wordXmlToText(xml:string):string;
export declare function extractDocxText(buffer:ArrayBuffer):Promise<string>;
export declare function inferProfileFromText(text:string):Record<string,string>;
