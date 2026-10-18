import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./live_jobs_preview.ts',import.meta.url),'utf8');
test('Chinese reader client is valid JavaScript',()=>{
 const match=source.match(/'<script>'\+\s*("(?:[^"\\]|\\.)*")\s*\+'<\/script><\/body><\/html>';/s);
 assert.ok(match,'must embed self-contained reader script');
 const browser=JSON.parse(match[1]);
 assert.doesNotThrow(()=>new Script(browser));
 assert.match(browser,/translate-part/);
 assert.match(browser,/sessionStorage/);
 assert.match(browser,/sourceHash/);
 assert.match(browser,/document.documentElement.lang/);
 assert.match(browser,/numericRisk/);
 assert.match(browser,/hhba-reader-v2-chinese-only/);
});
test('user reader only reads fixed live posting and never indexes translated full JD',()=>{
 assert.match(source,/function readJobForTranslation/);
 assert.match(source,/humanReaderAllowed/);
 assert.match(source,/private_reading_translation/);
 assert.match(source,/function jdChunks/);
 assert.match(source,/numbersVerified/);
 assert.doesNotMatch(source,/const shown=output\[0\]\+/);
 assert.doesNotMatch(source,/<details class="reader-original"/);
 assert.match(source,/id="show-original-english"/);
 assert.match(source,/FULL_JD_TRANSLATION_AND_REPUBLICATION/);
});
