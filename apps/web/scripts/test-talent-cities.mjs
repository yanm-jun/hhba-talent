import assert from 'node:assert/strict';
import {TALENT_CITY_INDEX,TALENT_MUNICIPALITIES,TALENT_PREFECTURE_CITIES,TALENT_YUNNAN_PREFECTURES,TALENT_INNER_MONGOLIA_LEAGUES,TALENT_PROVINCES,
 findTalentCity,findTalentProvince,parseTalentCityQuery,suggestTalentCities,queryTalentCities} from '../src/data/talentCityRegistry.ts';
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('✓ '+name)};
check('308 region entries = 4 municipalities + 293 prefecture cities + 8 Yunnan autonomous prefectures + 3 Inner Mongolia leagues',()=>{
 assert.equal(TALENT_MUNICIPALITIES.length,4);assert.equal(TALENT_PREFECTURE_CITIES.length,293);assert.equal(TALENT_YUNNAN_PREFECTURES.length,8);assert.equal(TALENT_INNER_MONGOLIA_LEAGUES.length,3);assert.equal(TALENT_CITY_INDEX.length,308);
});
check('all six-digit codes are unique and geographic level verified',()=>{
 const codes=TALENT_CITY_INDEX.map(x=>x.code);
 assert.ok(codes.every(x=>/^\d{6}$/.test(x)));
 assert.equal(new Set(codes).size,308);
 assert.equal(new Set(TALENT_CITY_INDEX.map(x=>x.name)).size,308);
 assert.ok(TALENT_PREFECTURE_CITIES.every(x=>x.code.endsWith('00')&&!x.code.endsWith('0000')&&x.official.endsWith('市')));
 assert.ok(TALENT_YUNNAN_PREFECTURES.every(x=>x.code.endsWith('00')&&x.province==='云南省'&&x.official.endsWith('自治州')));
 assert.deepEqual(TALENT_YUNNAN_PREFECTURES.map(x=>x.name),['楚雄','红河','文山','西双版纳','大理','德宏','怒江','迪庆']);
 assert.deepEqual(TALENT_INNER_MONGOLIA_LEAGUES.map(x=>x.name),['兴安盟','锡林郭勒盟','阿拉善盟']);
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
 assert.equal(queryTalentCities('','云南省').length,16);
 assert.equal(queryTalentCities('云南省').length,16);
 assert.equal(queryTalentCities('','内蒙古自治区').length,12);
 assert.equal(queryTalentCities('内蒙古').length,12);
 assert.equal(findTalentCity('锡林郭勒盟')?.name,'锡林郭勒盟');
 assert.equal(findTalentCity('a la shan meng')?.name,'阿拉善盟');
 assert.equal(findTalentCity('楚雄彝族自治州')?.name,'楚雄');
 assert.equal(findTalentCity('西双版纳傣族自治州')?.name,'西双版纳');
});
check('search suggestions return leading 8 while exact city remains accessible',()=>{
 assert.equal(suggestTalentCities('临沂')[0]?.name,'临沂');
 assert.ok(suggestTalentCities('山东省').length<=8);
 assert.ok(suggestTalentCities('san sha').some(x=>x.name==='三沙'));
});
check('preserve former cities and their real photo sources',()=>{
 for(const n of ['杭州','深圳','青岛','济南'])assert.ok(findTalentCity(n)?.photo?.startsWith('https://'));
});
check('preserve out-of-scope provinces and county-level cities, while Inner Mongolia leagues are newly included',()=>{
 for(const n of ['阿里地区','伊犁哈萨克自治州','阿坝藏族羌族自治州','五指山市','济源市','博乐市']){
  assert.equal(findTalentCity(n),null,n);
 }
});
check('unknown city is not misidentified as a city',()=>{
 assert.equal(findTalentCity('不存在的城市'),null);
 assert.equal(parseTalentCityQuery('不存在的城市').matchedCity,false);
});
console.log(JSON.stringify({passed,expected:12,municipalities:4,prefectureCities:293,totalCities:308,provinceGroups:TALENT_PROVINCES.length},null,2));
