import type {OverseasCategory} from './overseasNewZealand';
export type UsGuideSource={label:string;url:string;purpose:string};
export type UsGuideFaq={question:string;answer:string};
export type UsPathway={
 id:string;name:string;english:string;category:OverseasCategory;summary:string;audience:string;
 requirements:string[];documents:string[];steps:string[];fees:string[];rights:string[];risks:string[];
 timing:string[];future:string[];faq:UsGuideFaq[];highlights:string[];
 officialUrl:string;sources:UsGuideSource[];
};
