import {TALENT_PREFECTURE_CITIES,TALENT_MUNICIPALITIES} from '../src/data/talentCityRegistry.ts';
import {TALENT_POLICY_RECORDS} from '../src/data/talentPolicyRecords.ts';
import {TALENT_HOUSING_RECORDS} from '../src/data/talentHousingRecords.ts';
const names=[...TALENT_MUNICIPALITIES,...TALENT_PREFECTURE_CITIES];
const policy=new Map(),housing=new Map();
for(const r of TALENT_POLICY_RECORDS)policy.set(r.city,(policy.get(r.city)||0)+1);
for(const r of TALENT_HOUSING_RECORDS)housing.set(r.city,(housing.get(r.city)||0)+1);
const missing=names.filter(c=>!(policy.get(c.name)||0)&&!(housing.get(c.name)||0));
console.log('NATIONAL_CITY_DATA_AUDIT',JSON.stringify({cityCount:names.length,withAnyData:names.length-missing.length,zeroBoth:missing.length}));
const provinces=[...new Set(names.map(c=>c.province))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
for(const p of provinces){const group=names.filter(c=>c.province===p),gaps=group.filter(c=>!policy.has(c.name)&&!housing.has(c.name));
 console.log('PROVINCE_CITY_DATA_AUDIT',p,'total='+group.length,'zeroBoth='+gaps.length,'names='+gaps.map(x=>x.name).join(','));}
const zhejiang=['杭州','宁波','温州','嘉兴','湖州','绍兴','金华','衢州','舟山','台州','丽水'];
for(const city of zhejiang){const p=policy.get(city)||0,h=housing.get(city)||0;
 if(p===0||h===0)throw Error('ZHEJIANG_CITY_ZERO_CARD '+city+' policies='+p+' housing='+h);
}
console.log('ZHEJIANG_CITY_DATA_NO_ZERO_CARD',zhejiang.length);
