import raw from '../data/verifiedBrandAssets.json';
import type { LiveJob } from './liveRecruitment';

export type BrandIdentity=Pick<LiveJob,'company'|'platform'|'source'>;
export type VerifiedBrand={
 company:string;platform:string;source:string;file:string;color:string;
 wide:boolean;kind:'original-source'|'source-traced-vector'|'brand-site-icon'|'brand-board-icon';
};
const filePattern=/^(?:(?:openai|claude|spacex|si-[a-z0-9]{2,40})\.svg|brand-[a-z0-9]{2,60}\.(?:png|svg))$/;
const records=(raw.records as VerifiedBrand[]).filter(x=>
 x.company&&x.company.length<=120&&x.platform&&x.source&&filePattern.test(x.file)&&
 /^#[a-fA-F0-9]{6}$/.test(x.color)&&
 (x.kind==='original-source'||x.kind==='source-traced-vector'||x.kind==='brand-site-icon'||x.kind==='brand-board-icon')
);
const key=(p:BrandIdentity)=>JSON.stringify([p.company,p.platform,p.source]);
const registry=new Map<string,VerifiedBrand>(records.map(x=>[key(x),x]));
// Exact three-part recruitment-source identity only. Never infer from a
// substring, search similarity, arbitrary URL or unverified corporate group.
export function verifiedBrandForEmployer(identity:BrandIdentity):VerifiedBrand|null{
 if(!identity||!identity.company||!identity.platform||!identity.source)return null;
 return registry.get(key(identity))||null;
}
export function verifiedBrandCount(){return registry.size}
// Reuse the same vetted employer identities and bundled source assets in the homepage strip.
export function verifiedBrandRecords():readonly VerifiedBrand[]{return [...registry.values()]}

export function verifiedBrandAssetUrl(identity:BrandIdentity):string|null{
 const brand=verifiedBrandForEmployer(identity);
 return brand?import.meta.env.BASE_URL+'brands/'+brand.file:null;
}
