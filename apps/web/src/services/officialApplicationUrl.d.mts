export type OfficialJobLink={official_url?:string|null;recruitment_source_kind?:string|null};
export declare function officialApplicationUrl(job:OfficialJobLink):string|null;
export declare function officialLinkLabel(job:OfficialJobLink):string;
