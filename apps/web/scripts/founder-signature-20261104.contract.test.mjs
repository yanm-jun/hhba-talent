import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const page = readFileSync(resolve(root, 'src/pages/JoinUsPage.tsx'), 'utf8');
const css = readFileSync(resolve(root, 'src/styles/join-vision.css'), 'utf8');
const signature = readFileSync(resolve(root, 'public/images/hhba-founder-signature-2026.svg'), 'utf8');

test('join founder signoff references the new authentic signature with its original proportions', () => {
  assert.match(page, /images\/hhba-founder-signature-2026\.svg/);
  assert.match(page, /width=\{1301\} height=\{691\}/);
  assert.match(page, /创办者 · 闫明骏/);
  assert.match(page, /HHBA — Human Capability Network/);
});

test('signature is a background-free SVG trace containing meaningful hand-drawn path data', () => {
  assert.match(signature, /<svg[^>]*viewBox="0 0 1301 691"/);
  assert.match(signature, /<path d="M[\d, ]+/);
  assert.match(signature, /fill-rule="evenodd"/);
  assert.doesNotMatch(signature, /<image|<rect|<foreignObject|data:image|base64|<style[^>]*background/i);
  assert.ok((signature.match(/ M\d+,\d+/g) || []).length >= 9, 'retain the detailed autograph contours');
});

test('signature is sized responsively without blend modes or cropping', () => {
  assert.match(css, /\.join-manifesto-signature\{[\s\S]*?width:265px;max-width:76%;height:auto/);
  assert.match(css, /object-fit:contain;opacity:\.94/);
  assert.match(css, /\.join-manifesto-signature\{width:225px\}/);
  assert.doesNotMatch(css.match(/\.join-manifesto-signature\{[^}]+\}/)?.[0] ?? '', /mix-blend-mode/);
});

test('isolated signoff static preview includes the actual new vector asset', () => {
  const preview = readFileSync(resolve(root, '../../previews/join-founder-signature-20261104/index.html'), 'utf8');
  assert.match(preview, /HHBA \/join/);
  assert.match(preview, /创办者 · 闫明骏/);
  assert.match(preview, /viewBox="0 0 1301 691"/);
  assert.match(preview, /未部署正式网站/);
});
