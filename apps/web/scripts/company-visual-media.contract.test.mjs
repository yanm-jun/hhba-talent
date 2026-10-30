import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const data=JSON.parse(read('../src/data/companyVisualProfiles.json'));
const brands=JSON.parse(read('../src/data/verifiedBrandAssets.json')).records;
const id=x=>JSON.stringify([x.platform,x.source,x.company]);
const validLicenses=new Set(['CC BY 2.0','CC BY 4.0','CC BY-SA 4.0','CC0 1.0']);
const validMedia=m=>{
 assert.match(m.file,/^[^/?#<>:]{3,180}[.](?:jpe?g|png|webp)$/i);
 assert.ok(validLicenses.has(m.license),m.file+' has unapproved license');
 assert.ok(m.author.trim().length>=2);
 assert.ok(m.caption.zh&&m.caption.en);
 assert.ok(m.location.zh&&m.location.en);
};
test('50 marquee brand identities are individually mapped to exact-source visual records',()=>{
 assert.equal(data.records.length,50);
 assert.ok(data.records.every(x=>x.people.length>=1),'every brand source needs named founding-person attribution');
 assert.equal(new Set(data.records.map(id)).size,50);
 assert.deepEqual(new Set(data.records.map(id)),new Set(brands.map(id)));
});
test('founder facts have identity sources, never backfill unknown names or face images',()=>{
 let count=0,photos=0;
 for(const company of data.records){
  assert.ok(Array.isArray(company.people)&&Array.isArray(company.workplaces));
  for(const person of company.people){
   count++;
   assert.ok(person.name.length>=3 && /\b[Ff]ounder\b/.test(person.role.en));
   const u=new URL(person.source);
   assert.equal(u.protocol,'https:');
   if(person.photo){photos++;validMedia(person.photo);}
  }
 }
 assert.ok(count>=100);
 assert.ok(photos>=10);
 const binance=data.records.find(x=>x.company==='Binance');
 assert.equal(binance.platform,'lever');
 assert.equal(binance.source,'binance');
 assert.ok(binance.people.some(p=>p.name==='Changpeng Zhao'&&p.photo?.file==='Changpeng Zhao (2018).jpg'));
});
test('office / headquarters photos are genuinely dated, located and licensed',()=>{
 let photos=0;
 for(const company of data.records)for(const place of company.workplaces){
  photos++;validMedia(place);
  assert.match(place.takenAt,/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/);
  assert.ok(['office-building','workplace'].includes(place.kind));
 }
 assert.ok(photos>=8);
 const first=data.records.find(x=>x.company==='Airbnb');
 assert.ok(first.workplaces.some(x=>x.file.includes('Atrium')&&x.takenAt.startsWith('2017')));
});
test('both profile variants render real attribution and never substitute generated stock image',()=>{
 const component=read('../src/components/CompanyVisualStory.tsx');
 const generic=read('../src/pages/IndexedCompanyPage.tsx');
 const named=read('../src/pages/CompanyProfilePage.tsx');
 const service=read('../src/services/companyVisualProfiles.ts');
 const css=read('../src/styles/company-visual-story.css');
 assert.ok(component.includes('commonsImage(photo,portrait?420:780)'));
 assert.ok(component.includes('commonsCredit(photo)'));
 assert.ok(component.includes('loading="lazy"'));
 assert.ok(component.includes('onError={()=>setBroken(true)}'));
 assert.ok(component.includes('Portrait not yet reviewed'));
 assert.ok(component.includes('not represented as current headquarters'));
 assert.ok(generic.includes('<CompanyVisualStory identity={identity} lang={lang}/>'));
 assert.ok(named.includes('<CompanyVisualStory identity={{company:profile.name'));
 assert.ok(service.includes('verifiedBrandRecords()'));
 assert.ok(service.includes('commons.wikimedia.org/wiki/File:'));
 assert.ok(css.includes('@media(max-width:720px)'));
 assert.ok(!component.includes('unsplash')&&!component.includes('picsum')&&!component.includes('imagegen'));
});
