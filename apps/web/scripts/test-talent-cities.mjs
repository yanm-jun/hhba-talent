import assert from 'node:assert/strict';
import {TALENT_CITY_INDEX,TALENT_MUNICIPALITIES,TALENT_PREFECTURE_CITIES,TALENT_PROVINCES,
 findTalentCity,findTalentProvince,parseTalentCityQuery,suggestTalentCities,queryTalentCities} from '../src/data/talentCityRegistry.ts';
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('✓ '+name)};
check('297 city entries = exactly 4 municipalities + 293 prefecture-level cities',()=>{
 assert.equal(TALENT_MUNICIPALITIES.length,4);assert.equal(TALENT_PREFECTURE_CITIES.length,293);assert.equal(TALENT_CITY_INDEX.length,297);
});
check('all six-digit codes are unique and geographic level verified',()=>{
 const codes=TALENT_CITY_INDEX.map(x=>x.code);
 assert.ok(codes.every(x=>/^\d{6}$/.test(x)));
 assert.equal(new Set(codes).size,297);
 assert.equal(new Set(TALENT_CITY_INDEX.map(x=>x.name)).size,297);
 assert.ok(TALENT_PREFECTURE_CITIES.every(x=>x.code.endsWith('00')&&!x.code.endsWith('0000')&&x.official.endsWith('市')));
});
check('exact Chinese municipality names and all four direct routes',()=>{
 for(const name of ['北京','天津','上海','重庆']){assert.equal(findTalentCity(name)?.name,name);assert.equal(findTalentCity(name+'市')?.name,name);}
});
check('2025 city codes and Chinese full names',()=>{
 for(const [name,code] of [['临沂','371300'],['聊城','371500'],['济南','370100'],['广州','440100'],['深圳','440300'],['三沙','460300'],['日喀则','540200'],['吐鲁番','650400']]){
  assert.equal(findTalentCity(name)?.code,code);assert.equal(findTalentCity(name+'市')?.code,code);
 }
});
check('pinyin, initials and uppercase names recognized',()=>{
 for(const [query,name] of [['linyi','临沂'],['LINYI','临沂'],['lianyun gang','连云港'],['liaocheng','聊城'],['jinan','济南'],['shenzhen','深圳'],['beijing','北京'],['cq','重庆'],['ri ka ze','日喀则']]){
  assert.equal(findTalentCity(query)?.name,name,query);
 }
});
check('ambiguous initials do not silently open the wrong city',()=>{
 assert.equal(findTalentCity('ly'),null);
 const suggested=suggestTalentCities('ly',30).map(x=>x.name);
 assert.ok(suggested.includes('临沂')&&suggested.includes('龙岩'));
});
check('prefecture cities resolve province-prefixed city phrases without inventing policy',()=>{
 assert.equal(parseTalentCityQuery('山东省临沂市').city,'临沂');
 assert.equal(parseTalentCityQuery('山东临沂硕士补贴').city,'临沂');
 assert.equal(parseTalentCityQuery('重庆青年补贴').city,'重庆');
 assert.equal(parseTalentCityQuery('临沂').cityOnly,true);
 assert.equal(parseTalentCityQuery('广州博士生活补贴').cityOnly,false);
});
check('province filtering uses 27 correct province and autonomous region parent groups',()=>{
 assert.equal(TALENT_PROVINCES.length,27);
 assert.equal(findTalentProvince('山东')?.official,'山东省');
 assert.equal(findTalentProvince('新疆维吾尔自治区')?.name,'新疆');
 assert.equal(queryTalentCities('','山东省').length,16);
 assert.equal(queryTalentCities('山东').length,16);
 assert.equal(queryTalentCities('','直辖市').length,4);
 assert.equal(queryTalentCities('linyi','山东省').length,1);
 assert.equal(queryTalentCities('','广东省').length,21);
});
check('search suggestions return leading 8 while exact city remains accessible',()=>{
 assert.equal(suggestTalentCities('临沂')[0]?.name,'临沂');
 assert.ok(suggestTalentCities('山东省').length<=8);
 assert.ok(suggestTalentCities('san sha').some(x=>x.name==='三沙'));
});
check('preserve former cities and their real photo sources',()=>{
 for(const n of ['杭州','深圳','青岛','济南'])assert.ok(findTalentCity(n)?.photo?.startsWith('https://'));
});
check('excluded non-city administrative levels and county-level cities',()=>{
 for(const n of ['阿里地区','伊犁哈萨克自治州','阿拉善盟','五指山市','济源市','博乐市']){
  assert.equal(findTalentCity(n),null,n);
 }
});
check('unknown city is not misidentified as a city',()=>{
 assert.equal(findTalentCity('不存在的城市'),null);
 assert.equal(parseTalentCityQuery('不存在的城市').matchedCity,false);
});
console.log(JSON.stringify({passed,expected:12,municipalities:4,prefectureCities:293,totalCities:297,provinceGroups:TALENT_PROVINCES.length},null,2));
