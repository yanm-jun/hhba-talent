import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const workflow=readFileSync(new URL('../../../.github/workflows/hhba-github-pages-preview.yml',import.meta.url),'utf8');
const names=[...new Set([...workflow.matchAll(/(?:^|[^a-zA-Z0-9_])scripts\/([a-zA-Z0-9._/-]+\.(?:mjs|js|py))/gm)].map(m=>m[1]))];
const missing=names.filter(name=>!existsSync(new URL('./'+name,import.meta.url)));
assert.deepEqual(missing,[], 'GitHub Pages workflow calls deleted source scripts');
assert(names.length>100, 'file guard must cover the full legacy workflow');
console.log('HHBA_PAGES_TEST_REFERENCES_VALID',names.length);
