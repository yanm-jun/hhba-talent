import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const word=file('../src/components/OriginalWordViewer.tsx');
const preview=file('../src/services/browserWordPreview.ts');
const css=file('../src/styles/word-editor-minimal.css');

test('browser Word AI text is painted on original run, not a guessed font overlay',()=>{
 assert.match(word,/paintBrowserWordSuggestions\(mount,editable,visualSuggestions,MATCH_V4_PREVIEW\)/);
 assert.match(word,/const next=browserWordAnchors\(mount,editable\)/);
 assert.match(word,/visual&&rendererEnabled&&<span className="hhba-word-ai-preview"/);
 assert.match(preview,/node\.replaceChildren\(document\.createTextNode\(prefix\),mark,document\.createTextNode\(suffix\)\)/);
 assert.match(preview,/node\.setAttribute\(attribute,original\)/);
 assert.match(preview,/nodes\?\.length!==1/);
 assert.match(preview,/values\.length!==1/);
 assert.match(preview,/const value=original\?\?span\.textContent\?\?''/);
 assert.match(css,/\.hhba-browser-word-overlay \.hhba-original-resume-anchor\.has-ai-preview\{/);
 assert.match(css,/background:transparent!important;border-color:transparent!important/);
 assert.match(css,/font-size:inherit!important;font-weight:inherit!important/);
 assert.doesNotMatch(css,/\.hhba-browser-word-output \.hhba-word-inline-suggestion\{[^}]*font:inherit!important/s);
});

test('Siri light is permanently on actual Word page, softly breathing and orbiting',()=>{
 assert.match(css,/section\.hhba-native-docx::before/);
 assert.match(css,/section\.hhba-native-docx::after/);
 assert.match(css,/hhba-word-siri-breathe 11s ease-in-out infinite/);
 assert.match(css,/animation:hhba-word-beam-orbit 36s linear infinite/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media print\{/);
});
