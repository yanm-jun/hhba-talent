import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, MapPin, RefreshCw } from 'lucide-react';
import { forgetCity, locateRegion, readSavedCity, saveCity } from '../services/jobGeolocation';
import chinaDivisions from '../data/china_pca_2026.json';
import '../styles/job-filters.css';

type Division = { c: string | number; n: string; ch?: Division[] };
const china = chinaDivisions as Division[];
const subdivisions = [...china, { c: 'HK', n: '香港特别行政区' }, { c: 'MO', n: '澳门特别行政区' }, { c: 'TW', n: '台湾地区' }];
const ISO_CODES = 'AW AF AO AI AX AL AD AE AR AM AS AQ TF AG AU AT AZ BI BE BJ BQ BF BD BG BH BS BA BL BY BZ BM BO BR BB BN BT BV BW CF CA CC CH CL CN CI CM CD CG CK CO KM CV CR CU CW CX KY CY CZ DE DJ DM DK DO DZ EC EG ER EH ES EE ET FI FJ FK FR FO FM GA GB GE GG GH GI GN GP GM GW GQ GR GD GL GT GF GU GY HK HM HN HR HT HU ID IM IN IO IE IR IQ IS IL IT JM JE JO JP KZ KE KG KH KI KN KR KW LA LB LR LY LC LI LK LS LT LU LV MO MF MA MC MD MG MV MX MH MK ML MT MM ME MN MP MZ MR MS MQ MU MW MY YT NA NC NE NF NG NI NU NL NO NP NR NZ OM PK PA PN PE PH PW PG PL PR KP PT PY PS PF QA RE RO RU RW SA SD SN SG GS SH SJ SB SL SV SM SO PM RS SS ST SR SK SI SE SZ SX SC SY TC TD TG TH TJ TK TM TL TO TT TN TR TV TW TZ UG UA UM UY US UZ VA VC VE VG VI VN VU WF WS YE ZA ZM ZW'.split(' ');
const professionGroups: { group: string; examples: string[] }[] = [
  { group: '销售', examples: ['销售代表', '汽车销售', '客户经理', '商务拓展', '渠道销售', '销售顾问', '大客户销售', '海外销售', '房产销售', '电话销售'] },
  { group: '技术', examples: ['Java开发', '前端开发', '后端开发', '算法工程师', '人工智能', '测试工程师', '运维工程师', '数据工程师', '网络安全', '嵌入式开发'] },
  { group: '产品', examples: ['产品经理', '产品助理', '产品运营', '用户研究', '项目经理', '产品设计'] },
  { group: '运营', examples: ['用户运营', '电商运营', '内容运营', '社区运营', '活动运营', '增长运营', '商家运营', '游戏运营'] },
  { group: '市场', examples: ['市场营销', '品牌营销', '公关传播', '广告投放', '渠道推广', '商务合作', '活动策划'] },
  { group: '设计', examples: ['UI设计', 'UX设计', '视觉设计', '平面设计', '工业设计', '建筑设计', '动画设计', '服装设计'] },
  { group: '行政人事', examples: ['人力资源', '招聘专员', '薪酬绩效', '培训专员', '行政专员', '秘书', '政府事务'] },
  { group: '金融', examples: ['会计', '财务分析', '审计', '投融资', '风控', '税务', '银行', '证券', '保险'] },
  { group: '教育', examples: ['中小学教师', '大学教师', '幼儿教师', '职业培训', '教研员', '教育顾问', '课程设计'] },
  { group: '医疗', examples: ['临床医生', '护士', '药师', '医学检验', '医疗器械', '公共卫生', '心理咨询'] },
  { group: '制造', examples: ['机械工程师', '电气工程师', '工艺工程师', '质量工程师', '设备维修', '生产主管', '普工', '汽车研发'] },
  { group: '物流', examples: ['物流专员', '仓库管理员', '供应链管理', '采购', '货运司机', '配送', '报关员'] },
  { group: '服务', examples: ['客户服务', '餐饮服务', '酒店管理', '旅游服务', '零售店员', '美容美发', '家政服务'] },
  { group: '建筑', examples: ['土木工程', '施工管理', '造价工程', '结构设计', '工程监理', '房地产开发', '测绘'] },
  { group: '法律', examples: ['律师', '法务', '合规', '知识产权', '法律助理'] },
  { group: '科研', examples: ['科研助理', '研究员', '实验员', '材料科学', '生物技术', '科研管理'] },
  { group: '媒体', examples: ['记者', '编辑', '编导', '摄影摄像', '视频剪辑', '新媒体', '影视制作'] },
  { group: '农业', examples: ['农艺师', '动物养殖', '园艺', '农业技术', '食品加工', '林业'] },
];
export type JobFilterSelection = {
  q: string; country: string; province: string; city: string; district: string;
  occupation: string; recruitment_type: string; education: string; work_mode: string;
};
export const emptyJobFilters: JobFilterSelection = { q: '', country: '', province: '', city: '',
 district: '', occupation: '', recruitment_type: '', education: '', work_mode: '' };
export function filtersToQuery(filters: JobFilterSelection): URLSearchParams {
 const result = new URLSearchParams();
 for (const [key, value] of Object.entries(filters)) if(value && !(key==='province' && ['HK','MO','TW'].includes(filters.country))) result.set(key,value);
 return result;
}
export function JobFilterPanel({ value, onChange }: {value: JobFilterSelection; onChange: (next: JobFilterSelection)=>void}) {
 const [panel,setPanel]=useState<'region'|'occupation'|null>(null);
 const [queryDraft,setQueryDraft]=useState(value.q);
 const [overseas,setOverseas]=useState(value.country!=='' && value.country!=='CN');
 const [activeGroup,setActiveGroup]=useState('销售');
 const [countryQuery,setCountryQuery]=useState('');
 const [locating,setLocating]=useState(false);
 const [rememberCity,setRememberCity]=useState(false);
 const [locationNotice,setLocationNotice]=useState('');
 const [locationSource,setLocationSource]=useState<'osm-pilot'|'configured'|null>(null);
 const latestValue=useRef(value);
 const latestOnChange=useRef(onChange);
 const sequence=useRef(0);
 const controller=useRef<AbortController|null>(null);
 latestValue.current=value;
 latestOnChange.current=onChange;
 useEffect(()=>{
   const saved=readSavedCity();
   if (saved) {
     setRememberCity(true);
     if(!Object.values(latestValue.current).some(Boolean)) {
       latestOnChange.current({...latestValue.current,...saved.region});
       setLocationNotice('已按上次授权保存的城市筛选（24小时内）；想获取当前位置，请点击重新定位。');
     }
   }
   return ()=>{sequence.current++;controller.current?.abort();};
 },[]);
 async function requestDeviceLocation(){
   const request=++sequence.current;
   controller.current?.abort();
   const abort=new AbortController();controller.current=abort;
   setPanel(null);setLocating(true);setLocationNotice('正在请求浏览器定位并识别城市…');
   try{
     const result=await locateRegion(abort.signal);
     if(abort.signal.aborted || request!==sequence.current)return;
     const region=result.region;
     if (!region.province && !region.city){
       setLocationNotice('已识别国家或地区，但未能确定城市；已按国家筛选，可手动细化。');
     } else {
       setLocationNotice('已定位到'+[region.province,region.city].filter(Boolean).join(' · ')+'，正在查询该地区的真实岗位。');
     }
     latestOnChange.current({...latestValue.current,...region});
     if(rememberCity)saveCity(region);
     setLocationSource(result.provider==='osm-pilot'?'osm-pilot':'configured');
     setOverseas(region.country!=='CN');
   }catch(e){
     if(!abort.signal.aborted && request===sequence.current)
       setLocationNotice(e instanceof Error ? e.message : '定位失败，请手动选择地区。');
   }finally{
     if(request===sequence.current){setLocating(false);controller.current=null;}
   }
 }
 function changeRememberCity(checked:boolean){
   setRememberCity(checked);
   if (!checked) {forgetCity();return;}
   if(value.country)saveCity({country:value.country,province:value.province,city:value.city,district:''});
 }
 function cancelInFlightLocation(){
   sequence.current++;controller.current?.abort();controller.current=null;
   if(locating){setLocating(false);setLocationNotice('已保留你手动选择的地区。');}
 }
 const regionCountries=useMemo(()=>{
   const names = new Intl.DisplayNames(['zh-Hans'], {type:'region'});
   return ISO_CODES.filter(code=>!['CN','HK','MO','TW'].includes(code)).map(code=>({code,name:names.of(code)||code}))
       .filter(row=>row.name.includes(countryQuery) || row.code.toLowerCase().includes(countryQuery.toLowerCase()))
       .sort((a,b)=>a.name.localeCompare(b.name,'zh'));
 },[countryQuery]);
 const province = subdivisions.find(p=>p.n===value.province);
 const cities = province?.ch || [];
 const city = cities.find(p=>p.n===value.city);
 const districts = city?.ch || [];
 const set = (patch: Partial<JobFilterSelection>) => {
   if(['country','province','city','district'].some(key=>key in patch)) {
     cancelInFlightLocation();
   }
   const updated={...value,...patch};
   if(rememberCity){
     if(updated.country)saveCity({country:updated.country,province:updated.province,city:updated.city,district:''});
     else forgetCity();
   }
   onChange(updated);
 };
 function setRegion(country: string) {set({country,province:'',city:'',district:''});}
 function setProvince(name:string) {const special=subdivisions.find(p=>p.n===name && ['HK','MO','TW'].includes(String(p.c)));set({country:special?String(special.c):'CN',province:name,city:'',district:''});}
 function setCity(name:string) {set({city:name,district:''});}
 function keywordSubmit(event:FormEvent){ event.preventDefault();set({q:queryDraft.trim()});setPanel(null); }
 const regionLabel=value.district||value.city||value.province||(value.country==='CN'?'中国大陆':value.country?(new Intl.DisplayNames(['zh-Hans'],{type:'region'})).of(value.country):'全国 / 全球');
 const selectedGroup=professionGroups.find(group=>group.group===activeGroup)!;
 const educational=[['','学历不限'],['中专','中专'],['大专','大专'],['本科','本科'],['硕士','硕士'],['博士','博士']];
 const recruitment=[['','全部岗位'],['SOCIAL','社会招聘'],['CAMPUS','校园招聘'],['INTERNSHIP','实习招聘'],['SPECIAL','专项招聘']];
 const modes=[['','工作方式'],['REMOTE','远程办公'],['HYBRID','混合办公'],['ONSITE','现场办公']];
 return <div className="hhba-filter-wrap" aria-label="招聘条件筛选">
  <div className="hhba-filter-head"><div><strong>发现适合你的工作</strong><span>支持国内省市区和全球国家筛选 · 分类按职位名称匹配</span></div>
   <button type="button" className="hhba-filter-clear" onClick={()=>{cancelInFlightLocation();forgetCity();setRememberCity(false);onChange(emptyJobFilters);setQueryDraft('');setPanel(null);setLocationNotice('');}}>重置筛选 ↺</button></div>
  <div className="hhba-nearby-panel">
   <div className="hhba-nearby-head"><MapPin size={18}/><div><strong>优先查看我附近的岗位</strong><small>授权后自动选定所在国家、省份及城市；岗位距离不作猜测</small></div></div>
   <button type="button" className="hhba-nearby-button" onClick={requestDeviceLocation} disabled={locating} aria-label="使用当前位置推荐岗位">{locating?<RefreshCw className="hhba-nearby-spin" size={15}/>:<LocateFixed size={15}/>} {locating?'正在定位…':'使用当前位置推荐'}</button>
  </div>
  <div className="hhba-nearby-preferences">
    <label><input type="checkbox" checked={rememberCity} onChange={e=>changeRememberCity(e.target.checked)}/>在本设备保存城市24小时，下次自动筛选</label>
    <span>位置授权后，约1公里精度坐标会发送到地理编码服务换算城市；HHBA不保存经纬度。{locationSource==='osm-pilot'?'当前使用 OpenStreetMap 试点服务。':''}</span>
  </div>
  {locationNotice && <p className="hhba-nearby-status" role="status">{locationNotice}</p>}
  {locationSource==='osm-pilot' && <div className="hhba-nearby-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></div>}
  <form className="hhba-filter-keyword" onSubmit={keywordSubmit}>
    <span className="hhba-filter-glass" aria-hidden="true">⌕</span>
    <input aria-label="搜索公司或岗位关键词" placeholder="搜索职位 / 企业名称，如：小米、销售、产品经理" value={queryDraft} onChange={e=>setQueryDraft(e.target.value)} maxLength={120}/>
    <button type="submit">搜索职位 →</button>
  </form>
  <div className="hhba-filter-toolbar">
    <div className="hhba-filter-pop-outer">
      <button className={'hhba-filter-pill '+(panel==='region'?'open ':'')+(value.country?'selected':'')} type="button" aria-expanded={panel==='region'} onClick={()=>setPanel(panel==='region'?null:'region')}>📍 {regionLabel} <span>⌄</span></button>
    </div>
    <button className={'hhba-filter-pill '+(panel==='occupation'?'open ':'')+(value.occupation?'selected':'')} type="button" aria-expanded={panel==='occupation'} onClick={()=>setPanel(panel==='occupation'?null:'occupation')}>▦ {value.occupation||'全部职类'} <span>⌄</span></button>
    <label className="hhba-filter-select"><span className="sr-only">招聘类型</span><select value={value.recruitment_type} onChange={e=>set({recruitment_type:e.target.value})}>{recruitment.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
    <label className="hhba-filter-select"><span className="sr-only">学历</span><select value={value.education} onChange={e=>set({education:e.target.value})}>{educational.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
    <label className="hhba-filter-select"><span className="sr-only">工作方式</span><select value={value.work_mode} onChange={e=>set({work_mode:e.target.value})}>{modes.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
  </div>
  {panel==='region' && <section className="hhba-filter-dropdown" aria-label="地区联动筛选">
   <div className="hhba-filter-panel-head"><strong>选择工作地区</strong><button type="button" onClick={()=>setPanel(null)} aria-label="关闭地区选项">✕</button></div>
   <div className="hhba-filter-tabs"><button type="button" className={!overseas?'active':''} onClick={()=>{setOverseas(false);setRegion('CN');}}>国内地区</button><button type="button" className={overseas?'active':''} onClick={()=>{setOverseas(true);setRegion('');}}>海外地区</button><button type="button" onClick={()=>{setRegion('');setPanel(null);}}>不限地区</button></div>
   {!overseas?<div className="hhba-filter-cascade">
    <label>省 / 直辖市 / 自治区<select value={value.province} onChange={e=>setProvince(e.target.value)}><option value="">全国省份</option>{subdivisions.map(p=><option key={p.c} value={p.n}>{p.n}</option>)}</select></label>
    <label>城市 / 地州<select disabled={!cities.length} value={value.city} onChange={e=>setCity(e.target.value)}><option value="">全部城市</option>{cities.map(p=><option key={p.c} value={p.n}>{p.n}</option>)}</select></label>
    <label>区 / 县<select disabled={!districts.length} value={value.district} onChange={e=>set({district:e.target.value})}><option value="">全部区县</option>{districts.map(p=><option key={p.c} value={p.n}>{p.n}</option>)}</select></label>
   </div>:<div className="hhba-filter-overseas">
    <label>国家 / 地区<input placeholder="查找国家或地区..." value={countryQuery} onChange={e=>setCountryQuery(e.target.value)}/></label>
    <div className="hhba-filter-countries">{regionCountries.slice(0,130).map(item=><button className={value.country===item.code?'selected':''} type="button" key={item.code} onClick={()=>set({country:item.code,province:'',city:'',district:''})}>{item.name}</button>)}</div>
    <div className="hhba-filter-cascade"><label>州 / 省 / 行政区域<input value={value.province} onChange={e=>set({province:e.target.value,city:'',district:''})} placeholder="输入州省名称（按原岗位地点匹配）"/></label><label>城市<input value={value.city} onChange={e=>set({city:e.target.value,district:''})} placeholder="输入城市（如：Tokyo）"/></label></div>
    <small>国家列表覆盖 ISO 3166 国家和地区；海外州省及城市提供原文输入，完整海外行政区目录仍在扩展。</small>
   </div>}
   <footer className="hhba-filter-panel-footer"><small>仅筛选岗位实际披露的地点；未公开区县的岗位不会被推断到某个区县。</small><button type="button" onClick={()=>setPanel(null)}>完成选择</button></footer>
  </section>}
  {panel==='occupation' && <section className="hhba-filter-dropdown" aria-label="职业分类">
    <div className="hhba-filter-panel-head"><strong>选择职业分类</strong><button type="button" onClick={()=>setPanel(null)} aria-label="关闭职位类型">✕</button></div>
    <div className="hhba-filter-professions">
     <div className="hhba-filter-prof-groups">{professionGroups.map(g=><button type="button" key={g.group} className={activeGroup===g.group?'active':''} onClick={()=>setActiveGroup(g.group)}>{g.group}</button>)}</div>
     <div className="hhba-filter-prof-children"><button type="button" className="hhba-filter-prof-all" onClick={()=>{set({occupation:activeGroup});setPanel(null);}}>全部{activeGroup}岗位 →</button>
      <div>{selectedGroup.examples.map(name=><button type="button" key={name} className={value.occupation===name?'selected':''} onClick={()=>{set({occupation:name});setPanel(null);}}>{name}</button>)}</div>
     </div>
    </div>
    <footer className="hhba-filter-panel-footer"><small>目前依职位标题进行分类匹配；并非所有职位都已完成标准职业代码映射。</small><button type="button" onClick={()=>{set({occupation:''});setPanel(null);}}>不限职位</button></footer>
  </section>}
  <div className="hhba-filter-tags">
    {Object.entries(value).filter(([key,val])=>key!=='q'&&Boolean(val)).length||value.q?
     <><span>当前选择</span>{Object.entries(value).filter(([,val])=>Boolean(val)).map(([key,val])=><button type="button" key={key} onClick={()=>{if(key==='country')set({country:'',province:'',city:'',district:''});else set({[key]:''}); if(key==='q')setQueryDraft('');}}>{key==='country'?(regionLabel||val):val} ×</button>)}</>:
     <span>可组合筛选地区、岗位、校招/社招/实习、学历与工作方式</span>}
  </div>
 </div>;
}
