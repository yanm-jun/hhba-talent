export declare const PROFILE_FIELD_LABELS: ReadonlyArray<readonly [string,string]>;
export declare const EMPTY_PROFILE: Readonly<Record<string,string>>;
export declare function cleanProfile(input:unknown): Record<string,string>;
export declare function wordXmlToText(xml:string,options?:{unbounded?:boolean}):string;
export declare function extractDocxText(buffer:ArrayBuffer,options?:{unbounded?:boolean;signal?:AbortSignal}):Promise<string>;
export declare function inferProfileFromText(text:string):Record<string,string>;
