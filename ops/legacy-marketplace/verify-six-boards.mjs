import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const content=await readFile('railway-function-20261018.ts','utf8');
const pattern=/\{platform:"(greenhouse|ashby|lever)",company:"([^"]+)",slug:"([^"]+)"\}/g;
const found=[...content.matchAll(pattern)].map(m=>({platform:m[1],company:m[2],slug:m[3]}));
const names=new Set();
for(const c of found){const k=c.platform+':'+c.slug; assert(!names.has(k), 'Duplicate ATS source: '+k);names.add(k);}
const newBoards=[
 ['greenhouse','spacex','SpaceX'],
 ['greenhouse','spacexglobal','SpaceX Global'],
 ['greenhouse','anthropic','Anthropic'],
 ['greenhouse','doordashusa','DoorDash'],
 ['ashby','deepgram','Deepgram'],
 ['ashby','cohere','Cohere']
];
for(const [platform,slug,company]of newBoards){
 assert(found.some(x=>x.platform===platform&&x.slug===slug&&x.company===company),
   'Missing independently verified official board '+platform+':'+slug);
}
assert(found.length>=46,'Existing ATS boards removed during expansion');
assert(content.includes('return {id:id(board.platform,board.slug,native)') &&
  content.includes('const safe=urlOK(url,board.slug,board.platform)'),
  'Existing official ID and validated job links must remain unchanged');
assert(content.includes('async function officialDetail(job:Job)'),
  'Existing green detail/translation reader must remain present');
console.log('HHBA_6_VERIFIED_BOARDS_INCLUDED',JSON.stringify({all_board_sources:found.length,
 added_sources:newBoards.map(x=>x[0]+':'+x[1])}));
