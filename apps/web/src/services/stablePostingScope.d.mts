/** Stable, account-local storage scope for a canonical employer job URL. */
export function normalizePostingUrl(value: unknown, options?:{unbounded?:boolean}): string | null;
export function stablePostingScope(officialUrl: unknown, postingKey?:string): string | null;
