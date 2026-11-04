/* 真正摄影照片的国家卡片资源表。图片存储在 apps/web/public/overseas/countries/。
 * 页面展示时由 BASE_URL 指向本站自托管图片，不能使用 AI 图或动态图片搜索占位。
 * 原图从 Wikimedia Commons 获取，压缩为 WebP 并做封面裁切；
 * CC 的摄影人、原图与许可证在这里及网页上均保留，详见 PHOTO_CREDITS.md。
 */
export type OverseasCountryPhoto={
  name:string;place:string;filename:string;credit:string;license:string;
  licenseUrl:string;sourceUrl:string;alt:string;position:string;file:string;
};
export const overseasCountryPhotos:Record<'nz'|'au'|'jp'|'de'|'ca'|'uk'|'sg'|'us',OverseasCountryPhoto> = {
  nz: {"name":"新西兰","place":"皇后镇瓦卡蒂普湖与 Remarkables 山脉","filename":"The Remarkables from Queenstown, New Zealand 04.jpg","credit":"Σ64","license":"CC BY 4.0","licenseUrl":"https://creativecommons.org/licenses/by/4.0/","position":"center 53%","sourceUrl":"https://commons.wikimedia.org/wiki/File:The_Remarkables_from_Queenstown%2C_New_Zealand_04.jpg","alt":"新西兰实景摄影：皇后镇瓦卡蒂普湖与 Remarkables 山脉","file":"nz.webp"},
  au: {"name":"澳大利亚","place":"悉尼海港大桥与歌剧院","filename":"Sydney Harbour Bridge and Sydney Opera House panorama.jpg","credit":"Kgbo","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/","position":"center 53%","sourceUrl":"https://commons.wikimedia.org/wiki/File:Sydney_Harbour_Bridge_and_Sydney_Opera_House_panorama.jpg","alt":"澳大利亚实景摄影：悉尼海港大桥与歌剧院","file":"au.webp"},
  jp: {"name":"日本","place":"东京天际线与富士山","filename":"Tokyo - Sunset Skyline.jpg","credit":"Fred Cherrygarden","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/","position":"center 55%","sourceUrl":"https://commons.wikimedia.org/wiki/File:Tokyo_-_Sunset_Skyline.jpg","alt":"日本实景摄影：东京天际线与富士山","file":"jp.webp"},
  de: {"name":"德国","place":"柏林国会大厦","filename":"Reichstag, Berlin 1.jpg","credit":"Mike Peel","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/","position":"center 54%","sourceUrl":"https://commons.wikimedia.org/wiki/File:Reichstag%2C_Berlin_1.jpg","alt":"德国实景摄影：柏林国会大厦","file":"de.webp"},
  ca: {"name":"加拿大","place":"班夫国家公园梦莲湖","filename":"Moraine Lake panorama.jpg","credit":"Adam Bishop","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/","position":"center 53%","sourceUrl":"https://commons.wikimedia.org/wiki/File:Moraine_Lake_panorama.jpg","alt":"加拿大实景摄影：班夫国家公园梦莲湖","file":"ca.webp"},
  uk: {"name":"英国","place":"伦敦威斯敏斯特宫与大本钟","filename":"Westminster Palace and Big Ben.jpg","credit":"Balise42","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/","position":"center 55%","sourceUrl":"https://commons.wikimedia.org/wiki/File:Westminster_Palace_and_Big_Ben.jpg","alt":"英国实景摄影：伦敦威斯敏斯特宫与大本钟","file":"uk.webp"},
  sg: {"name":"新加坡","place":"新加坡滨海湾夜景","filename":"Panorama of Singapore's Marina Bay.jpg","credit":"Rocks n' Scapes","license":"CC BY 2.0","licenseUrl":"https://creativecommons.org/licenses/by/2.0/","position":"center 52%","sourceUrl":"https://commons.wikimedia.org/wiki/File:Panorama_of_Singapore's_Marina_Bay.jpg","alt":"新加坡实景摄影：新加坡滨海湾夜景","file":"sg.webp"},
  us: {"name":"美国","place":"纽约曼哈顿天际线","filename":"New york city skyline panorama.jpg","credit":"matheuslotero","license":"CC BY 2.0","licenseUrl":"https://creativecommons.org/licenses/by/2.0/","position":"center 51%","sourceUrl":"https://commons.wikimedia.org/wiki/File:New_york_city_skyline_panorama.jpg","alt":"美国实景摄影：纽约曼哈顿天际线","file":"us.webp"},
};
export const overseasCountryPhotoCodes=Object.keys(overseasCountryPhotos) as (keyof typeof overseasCountryPhotos)[];
