/**
 * HHBA Career Library V1 — editorial employer taxonomy adapter.
 * Converts old bilingual free tags to a proposal for a stable major→role→hall library.
 * Industry = employer business; profession = route to potential jobs, NOT job eligibility.
 * Do not automatically mark a source VERIFIED, create job records, or replace human review.
 */
export const HALL_IDS=Object.freeze([
 'automotive','machinery','finance','internet','electronics','semiconductors',
 'energy','healthcare','construction','logistics','consumer','media','agriculture',
 'aerospace','diversified'
]);
const PRIMARY_OVERRIDES=Object.freeze({
 '小米':'electronics','京东':'internet','大疆创新':'machinery',
 '美的集团':'electronics','京东方':'semiconductors','OPPO':'electronics',
 'vivo':'electronics','海康威视':'electronics','哔哩哔哩':'media',
 '快手':'media','得物':'consumer','中集集团':'machinery',
 '中国电子信息产业集团':'electronics','中国电子科技集团':'electronics',
 '奥克斯集团':'electronics','深圳地铁集团':'logistics',
 '中国邮政集团':'logistics','宁德时代':'energy',
 '中国宝武集团（宝钢股份专场）':'machinery','潍柴集团':'machinery',
 '中国交通建设集团':'construction','中国中铁集团':'construction',
 '中国中化集团':'diversified','北京首旅集团':'media'
});
const SECONDARY_OVERRIDES=Object.freeze({
 '比亚迪':['energy','electronics'],'小米':['automotive','internet'],
 '京东':['consumer','logistics'],'百度':['automotive'],
 '宁德时代':['automotive'],'大疆创新':['electronics','internet'],
 '美的集团':['machinery','consumer'],'京东方':['electronics'],
 '海康威视':['internet','automotive'],'OPPO':['internet'],'vivo':['internet'],
 '中兴通讯':['semiconductors'],'中国电信':['internet'],
 '国家能源集团':['logistics'],'阿里巴巴':['consumer'],
 '联想集团':['internet'],'海信集团':['automotive'],
 'TCL集团招聘体系':['energy'],'三一集团':['energy'],
 '潍柴集团':['automotive'],'汇川技术':['automotive','internet'],
 '海康机器人':['electronics'],'亿纬锂能':['automotive'],
 '欣旺达':['automotive'],'中国邮政集团':['finance'],
 '蚂蚁集团':['internet'],'携程集团':['internet'],
 '华润集团':['healthcare','consumer','energy','construction'],
 '招商局集团':['logistics','finance'],'中国中化集团':['energy','agriculture'],
 '广东粤海控股集团':['energy','construction'],
 '重庆渝富控股集团':['finance'],'深圳市投资控股':['finance'],
 '中集集团':['logistics'],'中国商飞':['machinery'],
 '中国中车集团':['machinery'],'福耀集团':['machinery'],
 '德赛西威':['electronics'],'华域汽车集团':['machinery'],
 '中国电子信息产业集团':['semiconductors'],
 '中国电子科技集团':['semiconductors'],
 '中国核工业集团':['machinery'],'中国铁建重工':['machinery'],
 '通用技术集团':['healthcare','machinery'],
 '中国宝武集团（宝钢股份专场）':['automotive']
});
const AUTOMOTIVE_SECTION=Object.freeze({
 '比亚迪':'auto-whole','小米':'auto-ev','百度':'auto-adas','宁德时代':'auto-battery',
 '海康威视':'auto-adas','上汽集团':'auto-whole','广汽集团':'auto-whole',
 '长安汽车':'auto-ev','长城汽车':'auto-whole','吉利汽车集团':'auto-ev',
 '理想汽车':'auto-ev','蔚来汽车':'auto-ev','小鹏汽车':'auto-adas',
 '江淮汽车':'auto-whole','零跑汽车':'auto-ev','奇瑞汽车':'auto-whole',
 '东风汽车集团':'auto-whole','东风日产':'auto-whole','广汽丰田':'auto-whole',
 '福耀集团':'auto-parts','华域汽车集团':'auto-parts',
 '德赛西威':'auto-electronics','海信集团':'auto-electronics',
 '潍柴集团':'auto-parts','亿纬锂能':'auto-battery',
 '欣旺达':'auto-battery','汇川技术':'auto-manufacturing'
});
const parseTags=value=>{
 try{
  const tags=Array.isArray(value)?value:JSON.parse(value||'[]');
  return Array.isArray(tags)?tags.filter(x=>typeof x==='string'):null;
 }catch{return null}
};
const tagPrimary=tag=>{
 if(/汽车|车辆|智能出行|^automotive$/.test(tag))return 'automotive';
 if(/农业|农牧/.test(tag))return 'agriculture';
 if(/金融|证券|银行|保险|^finance$/.test(tag))return 'finance';
 if(/半导体|芯片|^semiconductors$/.test(tag))return 'semiconductors';
 if(/能源|电力|电网|石油|核能|光伏|^energy$|^新能源/.test(tag))return 'energy';
 if(/医药|医疗|生物|健康|^healthcare$/.test(tag))return 'healthcare';
 if(/航空|航天|轨道(交通|装备)/.test(tag))return 'aerospace';
 if(/建筑|地产|城市服务|基建工程|^construction$/.test(tag))return 'construction';
 if(/物流|快递|交通(运输|基础设施)|机场|铁路运输|^logistics$/.test(tag))return 'logistics';
 if(/传媒|广告|旅游|酒店|文旅|^media-content$|互联网内容/.test(tag))return 'media';
 if(/食品|饮料|服饰|家居|零售|跨境电商|^consumer-retail$/.test(tag))return 'consumer';
 if(/消费电子|通信|电子制造|计算机及智能设备|家电|智能终端|^telecommunications$/.test(tag))return 'electronics';
 if(/人工智能|互联网|软件|云计算|^software-internet$/.test(tag))return 'internet';
 if(/制造|机械|工业|机器人|冶金|钢铁|^industrial-manufacturing$|高端装备/.test(tag))return 'machinery';
 if(/综合|投资|国企/.test(tag))return 'diversified';
 return null;
};
/** Returns a PROPOSAL; only an editorial-controlled write may persist it. */
export function proposeEmployerHallClassification(row){
 if(!row||typeof row.id!=='string'||!/^hhba-official-[a-z0-9_-]{5,}$/.test(row.id)||
  typeof row.display_name!=='string')return null;
 const industryTags=parseTags(row.industry_tags_json),businessTags=parseTags(row.business_tags_json);
 if(!industryTags?.length||!businessTags?.length)return null;
 const primary=PRIMARY_OVERRIDES[row.display_name]||tagPrimary(industryTags[0]);
 if(!primary||!HALL_IDS.includes(primary))return null;
 const additional=[...new Set((SECONDARY_OVERRIDES[row.display_name]||[])
  .filter(id=>HALL_IDS.includes(id)&&id!==primary))];
 const autoSection=AUTOMOTIVE_SECTION[row.display_name]||null;
 return {id:row.id,name:row.display_name,primary,additional,
  auto_section:primary==='automotive'||additional.includes('automotive')?autoSection:null,
  industry_tags:industryTags,business_tags:businessTags,
  classification_status:'EDITORIAL_PROPOSAL_NOT_JOB_VERIFIED'};
}
