export type ATSJobSearchable = {id:string;title:string;titleZh?:string;company:string;companyZh?:string;location?:string|null;locationZh?:string|null;domestic?:boolean;remote?:boolean|null;recruitmentType?:string|null;graduationYear?:number|null};
export type SearchFacet = {countryCode:string|null;cityKey:string|null;education:string|null;experienceMinYears:number|null;skills:string[];jobType:string;jobTypeEvidence?:string;original_source_hash?:string};
export type SearchFilters = {q?:string;company?:string;country?:string;location_country?:string;city?:string;remote?:boolean;education?:string;experience?:string;recruitment_type?:string};
export type ParsedSearch = {countryCode:string|null;cityKey:string|null;remote:boolean;education:string|null;experience:string|null;jobType:string|null;graduationYear:number|null;roleKeys:string[];skills:string[];terms:string[]};
export function locationFacts(location?:string|null,domestic?:boolean):{countryCode:string|null;cityKey:string|null};
export function extractRequirementFacts(raw?:string|null):{education:string|null;experienceMinYears:number|null;skills:string[]};
export function classifyJobType(title?:string|null,declared?:string|null):{jobType:string;jobTypeEvidence:string};
export function searchFacts(job:ATSJobSearchable,officialJD:string):SearchFacet;
export function parseNaturalQuery(query:string):ParsedSearch;
export function searchJobs<T extends ATSJobSearchable>(jobs:T[],filters?:SearchFilters,facets?:Map<string,SearchFacet>):
 {rows:T[];interpreted:ParsedSearch;counted:number};
export const countryOptions:{value:string;zh:string;en:string}[];
export const cityOptions:{value:string;zh:string;en:string;country:string}[];
