/**
 * Color only text added or replaced by a user-confirmed edit. Keep unchanged
 * source characters in their original monochrome styling.
 *
 * Prefix/suffix are calculated by Unicode code point to avoid splitting emoji
 * or supplementary Han characters halfway through a surrogate pair.
 * This is a visual diff only; downloadable resume content is unchanged.
 */
export function splitChangedResumeText(original,updated){
 const before=Array.from(String(original??''));
 const after=Array.from(String(updated??''));
 let prefix=0;
 while(prefix<before.length&&prefix<after.length&&before[prefix]===after[prefix])
  prefix++;
 let suffix=0;
 while(suffix<before.length-prefix&&suffix<after.length-prefix&&
  before[before.length-1-suffix]===after[after.length-1-suffix])suffix++;
 return {
  prefix:after.slice(0,prefix).join(''),
  changed:after.slice(prefix,after.length-suffix).join(''),
  suffix:after.slice(after.length-suffix).join(''),
  hasChange:prefix!==before.length||prefix!==after.length
 };
}
