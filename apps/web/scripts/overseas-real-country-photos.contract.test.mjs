import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {overseasCountryPhotos,overseasCountryPhotoCodes} from '../src/data/overseasCountryPhotos.ts';

const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
test('All eight countries use genuine self-hosted WebP photographs with source author and CC licence',()=>{
 assert.deepEqual(overseasCountryPhotoCodes.sort(),['au','ca','de','jp','nz','sg','uk','us']);
 const page=read('../src/pages/OverseasDevelopmentPage.tsx');
 const css=read('../src/styles/overseas-development.css');
 assert.match(page,/<img className="hhba-overseas-country-photo"/);
 assert.match(page,/overseasCountryPhotos\[c\.code\]\.file/);
 assert.match(page,/overseasCountryPhotos\[c\.code\]\.credit/);
 assert.match(page,/overseasCountryPhotos\[c\.code\]\.sourceUrl/);
 assert.ok(!page.includes('<span className="hhba-overseas-banner-flag">{c.flag}</span>'),'must remove placeholder country letters');
 assert.match(css,/object-fit:cover/);
 assert.match(css,/\.hhba-overseas-photo-attribution/);
 for(const country of overseasCountryPhotoCodes){
  const source=overseasCountryPhotos[country];
  assert.ok(source.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'),country+' must cite Commons original');
  assert.ok(source.license.startsWith('CC BY')&&source.licenseUrl.startsWith('https://creativecommons.org/licenses/'),country+' license');
  assert.ok(source.credit.length>=2&&source.alt.includes(source.name),country+' author and alt');
  assert.equal(source.file,country+'.webp');
  const path=fileURLToPath(new URL('../public/overseas/countries/'+source.file,import.meta.url));
  assert.ok(statSync(path).size>12000,country+' needs actual saved photo, not placeholder');
  const bytes=readFileSync(path);
  assert.equal(bytes.toString('ascii',0,4),'RIFF',country+' RIFF header');
  assert.equal(bytes.toString('ascii',8,12),'WEBP',country+' WEBP format');
 }
});
