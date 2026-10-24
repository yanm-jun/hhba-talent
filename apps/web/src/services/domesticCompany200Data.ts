import draft from '../data/domesticCompanyExpansion200Profiles.json';
import curated from '../data/domesticCompany200VerifiedEditorial.json';

// Source-backed editorial overrides never mutate the original 100 employers or screenshot/media registry.
// New employer content stays visibly draft until specifically verified against cited corporate sources.
const reviewed=(curated.entries||{}) as Record<string,Record<string,unknown>>;
export const domestic200Profiles=Object.fromEntries(
 Object.entries(draft).map(([name,starter])=>[name,{...starter,...(reviewed[name]||{})}])
) as Record<string,(typeof draft)[keyof typeof draft]>;
export const sourceBacked200Count=Object.keys(reviewed).length;
