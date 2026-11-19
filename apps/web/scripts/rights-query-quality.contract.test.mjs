import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const dictionary=read('src/data/laborRightsSearchIntents.json');
const examples=read('src/data/laborRightsQueryFixtures.json');
const topics=read('src/data/laborRightsTopics.json');
const subtopics=read('src/data/laborRightsSubtopics.json');
const originalGuide=readFileSync(new URL('../src/data/hhbaWorkValueGuide.ts',import.meta.url),'utf8');
const tips=JSON.parse(originalGuide.match(/export const GUIDE_TIPS:GuideTip\[\]=([\s\S]*);\s*$/)?.[1]||'null');
const tipIds=new Set(tips.map(t=>t.id));

// Mirror the real browser's string normalization and intent matching.
const normal=s=>s.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]+/gu,'');
function match(query){
 const q=normal(query);
 return dictionary.intents.filter(intent=>intent.phrases.some(phrase=>q.includes(normal(phrase))));
}

test('85 distinct human-phrased questions form a stable, inspectable regression corpus',()=>{
 assert.equal(examples.schemaVersion,1);
 assert.equal(examples.cases.length,85);
 assert.equal(examples.cases.filter(x=>x.expectedIntent!==null).length,70);
 assert.equal(examples.cases.filter(x=>x.expectedIntent===null).length,15);
 assert.equal(new Set(examples.cases.map(x=>x.id)).size,85);
 assert(examples.cases.every(item=>item.query.length>=5));
});

test('all 70 everyday phrased questions identify their intended legal information category',()=>{
 const errors=[];
 for(const item of examples.cases){
  const matches=match(item.query);
  if(item.expectedIntent===null){
   if(matches.length)errors.push(item.id+' should be out of scope; returned '+matches.map(m=>m.id).join(','));
  }else if(!matches.some(m=>m.id===item.expectedIntent)){
   errors.push(item.id+' expected '+item.expectedIntent+' but got '+matches.map(m=>m.id).join(','));
  }
 }
 assert.deepEqual(errors,[]);
});

test('intent targets and all curated action links are live local data, not placeholder IDs',()=>{
 const mainIds=new Set(topics.topics.map(t=>t.slug));
 const subIds=new Set(subtopics.topics.map(t=>t.slug));
 assert.equal(dictionary.intents.length,14);
 for(const intent of dictionary.intents){
  assert(mainIds.has(intent.primary),intent.id+' missing main source-backed topic');
  assert(intent.subtopics.every(slug=>subIds.has(slug)),intent.id+' has unpublished subtopic');
  assert.equal(intent.featuredActions.length,3,intent.id+' should have three first steps');
  assert.equal(new Set(intent.featuredActions).size,3,intent.id+' duplicates first steps');
  assert(intent.featuredActions.every(id=>tipIds.has(id)),intent.id+' missing featured action');
 }
});

test('spaced queries, punctuation and fullwidth typing normalize consistently',()=>{
 assert.equal(normal('工 资，一 直 没 到 账！'),normal('工资一直没到账'));
 assert.equal(normal('ＡＢＣ，试 用 期'),normal('abc试用期'));
 assert.equal(normal('（试用期）不交社保'),normal('试用期不交社保'));
 assert(match('工 资，一 直 没 到 账！').some(x=>x.id==='unpaid'));
 assert(match('（试用期）不交社保').some(x=>x.id==='insurance'));
});
