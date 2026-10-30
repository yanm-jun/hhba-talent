/** V4.1 city dictionary. This release targets only the four municipalities.
 * Existing non-municipality cities stay as legacy indexed cities; 293 prefecture-level
 * cities are NOT claimed as implemented. No placeholder records are invented. */
export type TalentCity={
 name:string;official:string;province:string;level:'municipality'|'prefecture-preview';
 intro:string;aliases:string[];photo:string;credit:string;photoPage:string
};
export const TALENT_MUNICIPALITIES:TalentCity[]=[
 {name:'北京',official:'北京市',province:'北京',level:'municipality',intro:'首都人才发展、就业与住房保障',aliases:['北京','北京市','beijing','bj'],photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Guomao_Skyline.jpg?width=1280',credit:'郭友柏 · Wikimedia Commons',photoPage:'https://commons.wikimedia.org/wiki/File:Guomao_Skyline.jpg'},
 {name:'天津',official:'天津市',province:'天津',level:'municipality',intro:'海河英才、人才引育与安居支持',aliases:['天津','天津市','tianjin','tj'],photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/%E5%A4%A9%E6%B4%A5%E5%A4%A9%E9%99%85%E7%BA%BF202507.jpg?width=1280',credit:'Tyngrwey · Wikimedia Commons',photoPage:'https://commons.wikimedia.org/wiki/File:%E5%A4%A9%E6%B4%A5%E5%A4%A9%E9%99%85%E7%BA%BF202507.jpg'},
 {name:'上海',official:'上海市',province:'上海',level:'municipality',intro:'青年就业、人才落户与保障租赁住房',aliases:['上海','上海市','shanghai','sh'],photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Shanghai_skyline.jpg?width=1280',credit:'Rose Abrams · Wikimedia Commons',photoPage:'https://commons.wikimedia.org/wiki/File:Shanghai_skyline.jpg'},
 {name:'重庆',official:'重庆市',province:'重庆',level:'municipality',intro:'青年人才发展、就业补贴与住房服务',aliases:['重庆','重庆市','chongqing','cq'],photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/%E9%87%8D%E5%BA%86%E6%B4%AA%E5%B4%96%E6%B4%9E%E5%A4%9C%E6%99%AF.jpg?width=1280',credit:'kmahyyg · CC BY-SA 4.0',photoPage:'https://commons.wikimedia.org/wiki/File:%E9%87%8D%E5%BA%86%E6%B4%AA%E5%B4%96%E6%B4%9E%E5%A4%9C%E6%99%AF.jpg'}
];
export const TALENT_LEGACY_CITIES:TalentCity[]=[
 {name:'杭州',official:'杭州市',province:'浙江',level:'prefecture-preview',intro:'数字经济、先进制造与青年人才发展',aliases:['杭州','杭州市','hangzhou'],photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/%E6%9D%AD%E5%B7%9E%E9%92%B1%E6%B1%9F%E6%96%B0%E5%9F%8E.jpg?width=1280',credit:'EditQ · CC BY-SA 4.0',photoPage:'https://commons.wikimedia.org/wiki/File:%E6%9D%AD%E5%B7%9E%E9%92%B1%E6%B1%9F%E6%96%B0%E5%9F%8E.jpg'},
 {name:'深圳',official:'深圳市',province:'广东',level:'prefecture-preview',intro:'科技创新、产业人才与城市安居',aliases:['深圳','深圳市','shenzhen'],photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Skyline_in_Shenzhen_%2820250327%29.jpg?width=1280',credit:'Fumikas Sagisavas · CC0',photoPage:'https://commons.wikimedia.org/wiki/File:Skyline_in_Shenzhen_(20250327).jpg'},
 {name:'青岛',official:'青岛市',province:'山东',level:'prefecture-preview',intro:'海洋产业、先进制造与青年就业',aliases:['青岛','青岛市','qingdao'],photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/%E9%9D%92%E5%B2%9B%E5%A4%A9%E9%99%85%E7%BA%BF201809.jpg?width=1280',credit:'WFan · CC BY-SA 4.0',photoPage:'https://commons.wikimedia.org/wiki/File:%E9%9D%92%E5%B2%9B%E5%A4%A9%E9%99%85%E7%BA%BF201809.jpg'},
 {name:'济南',official:'济南市',province:'山东',level:'prefecture-preview',intro:'省会就业机会与青年人才支持',aliases:['济南','济南市','jinan'],photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Jinan_CBD_skyline_June_2023.jpg?width=1280',credit:'Percival Kestreltail · CC BY-SA 4.0',photoPage:'https://commons.wikimedia.org/wiki/File:Jinan_CBD_skyline_June_2023.jpg'}
];
export const TALENT_CITY_INDEX=[...TALENT_MUNICIPALITIES,...TALENT_LEGACY_CITIES];
function normalize(value:string){return value.trim().toLowerCase().replace(/[\s，。,.、]/g,'')}
export function findTalentCity(input:string){
 const q=normalize(input);if(!q)return null;
 return TALENT_CITY_INDEX.find(c=>c.aliases.some(a=>normalize(a)===q))||null;
}
export function parseTalentCityQuery(input:string,fallback='北京'){
 const q=normalize(input);
 // Match longest city alias first to avoid a short name swallowing its municipality suffix.
 const pairs=TALENT_CITY_INDEX.flatMap(city=>city.aliases.map(alias=>({city,alias:normalize(alias)})))
   .sort((a,b)=>b.alias.length-a.alias.length);
 const found=pairs.find(p=>q.startsWith(p.alias))||pairs.find(p=>q.includes(p.alias));
 if(!found)return {city:fallback,matchedCity:false,cityOnly:false,query:input.trim()};
 const city=found.city.name;
 const remaining=q.replace(found.alias,'').replace(/^(市)/,'');
 const cityOnly=!remaining||/^(人才)?(政策|服务|政策查询)?$/.test(remaining);
 return {city,matchedCity:true,cityOnly,query:input.trim()};
}
export function suggestTalentCities(input:string,limit=6){
 const q=normalize(input);
 if(!q)return TALENT_MUNICIPALITIES;
 return TALENT_CITY_INDEX.map(city=>{
   const score=city.aliases.reduce((best,alias)=>{
    const a=normalize(alias);
    return Math.min(best,a===q?0:a.startsWith(q)?1:q.startsWith(a)?2:a.includes(q)?3:100);
   },100);
   return {city,score};
 }).filter(x=>x.score<100).sort((a,b)=>a.score-b.score||(a.city.level==='municipality'?-1:1)).slice(0,limit).map(x=>x.city);
}
