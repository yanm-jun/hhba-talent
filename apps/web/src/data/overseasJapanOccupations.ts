/* 2026-11-04 Japan Immigration Services Agency SSW official field catalogue.
 * "Field" (industry) is not a job offer, and professional examples are not an official occupation whitelist.
 */
export type JapanOccupation={
 id:string;name:string;japanese:string;english:string;group:string;
 pathwayId:'jp-ssw1'|'jp-ssw2'|'jp-engineer';sector:boolean;ssw2Eligible:boolean;
 examples:string[];qualification:string;language:string;experience:string;license:string;salary:string;
 evidence:string[];steps:string[];source:string;sourceLabel:string;status:'open-check'|'closed-new-coe'|'detail-pending';
 caution:string;verifiedOn:string;
};
const base='https://www.ssw.go.jp/en/about/visa/';
export const jpSSWOfficial='https://www.ssw.go.jp/en/about/visa/';
export const jpSSWSteps='https://www.ssw.go.jp/en/about/step/';
export const jpTechOfficial='https://www.moj.go.jp/isa/applications/resources/nyukan_nyukan69.html';
export const jpSSWExam='https://www.ssw.go.jp/en/about/sswv/exam/';
type F=[string,string,string,string,string,string,string,string,boolean,JapanOccupation['status'],string?];
const fields:F[]=[
 ['nursing-care','护理照护','介護','Nursing Care','医疗照护','帮助高龄者和残障者进行沐浴、就餐、排泄与日常生活活动。','护理领域特定技能1号评价考试；另有护理日语评价考试。','nursing_care_1',false,'open-check','N4或JFT-Basic之外还须通过护理日语评价考试（适用豁免条件另查）。'],
 ['building-cleaning','建筑物清洁','ビルクリーニング','Building Cleaning Management','设施服务','商业楼宇内部清洁、建筑物卫生维护。','建筑物清洁领域特定技能1号评价考试。','building_cleaning_management_1',true,'open-check'],
 ['construction','建筑施工','建設','Construction','建设工程','土木施工、建筑工程施工、基础设施设备安装与维护。','建设领域特定技能1号评价考试或官方认可技能检定级别。','construction_1',true,'open-check'],
 ['manufacturing','工业制造','工業製品製造業','Industrial Product Manufacturing','制造与机械','机械零件加工、金属加工、电气电子设备组装、表面处理以及其他官方列明制造工种。','工业产品制造领域的对应特定技能1号评价考试。','industrial_product_manufacturing_1',true,'open-check','工种覆盖范围具体分项不同；电气电子设备组装不等于专业电气工程师的技人国资格。'],
 ['shipbuilding','造船与船用机械','造船・舶用工業','Shipbuilding and Ship Machinery','制造与机械','船体制造、焊接、涂装及船用机械相关作业（具体允许工序以官方说明为准）。','造船·船用机械领域规定的技能评价考试或适用技能检定。','shipbuilding_and_ship_machinery_1',true,'open-check'],
 ['car-repair','汽车维修','自動車整備','Automobile Repair and Maintenance','制造与机械','汽车检查、保养、维修和必要的整备作业。','汽车维修领域特定技能1号评价考试，或官方认可的汽车整备技能资格。','automobile_repair_and_maintenance_1',true,'open-check','汽车维修与汽车生产流水线属于不同工作分类，请先核对岗位实际内容。'],
 ['aviation','航空地勤与维修','航空','Aviation','交通运输','机场地面作业和航空器相关维修工作；具体岗位和训练资格应再核实。','航空领域对应的地勤/航空器维修特定技能评价考试。','aviation_1',true,'open-check'],
 ['accommodation','酒店住宿服务','宿泊','Accommodation','住宿与餐饮','酒店前台、接待、企划宣传、客人服务等住宿行业允许岗位。','住宿领域特定技能1号评价考试。','accommodation_1',true,'open-check','酒店接待并不天然符合技人国；要看实际活动、学历和语言工作性质。'],
 ['automobile-transport','货车、出租车、巴士司机','自動車運送業','Automobile Transportation Business','交通运输','合法商用货车运输、出租车客运和公共巴士驾驶。','相应货车/出租车/巴士特定技能评价考试和日本规定的驾驶执照；巴士出租车还需新人驾驶员培训。','automobile_transportation_business_1',false,'open-check','货车通常JLPT N4或JFT-Basic，出租车和巴士要求JLPT N3及适用驾驶证/培训。'],
 ['railway','铁路运行与维护','鉄道','Railway','交通运输','铁路轨道、车辆维护、站务和驾驶等；具体可做工作以官方铁路领域目录为准。','铁路特定技能评价考试按细分岗位；列车驾驶日语门槛高于普通岗位。','railway_1',false,'open-check','列车驾驶相关作业通常需要JLPT N3或以上，其他铁路工种按官方分类核对。'],
 ['agriculture','农业种植与畜牧','農業','Agriculture','农林渔业','农作物种植、采收与农业生产；畜禽养殖及相关现场作业。','农业领域特定技能1号技能测评。','agriculture_1',true,'open-check'],
 ['fishery','渔业与水产养殖','漁業','Fishery and Aquaculture','农林渔业','远洋/沿岸渔业与水产品养殖相关现场作业。','渔业/养殖对应的特定技能1号评价考试。','fishery_and_aquaculture_1',true,'open-check'],
 ['food-manufacturing','食品饮料制造','飲食料品製造業','Food and Beverage Manufacturing','住宿与餐饮','食品加工制造、包装及饮料生产等工厂作业。','食品饮料制造领域特定技能1号考试。','food_and_beverage_manufacturing_1',true,'open-check','食品生产车间和餐厅外食服务并非同一个特定技能领域。'],
 ['food-service','餐饮服务（新COE暂停）','外食業','Food Service','住宿与餐饮','餐饮店食品加工、顾客接待、门店运营等官方允许的业务。','外食业特定技能1号技能测评（目前新COE暂停签发，必须先核对恢复通知）。','food_service_1',true,'closed-new-coe','日本入管公开说明自2026-04-13起暂停该领域特定技能1号新COE签发；不要把已通过考试理解为当前能办理新COE。'],
 ['forestry','林业','林業','Forestry','农林渔业','植树造林、森林抚育及林业现场作业。','林业领域对应特定技能1号评价考试。','forestry_1',false,'open-check'],
 ['wood','木材加工','木材産業','Wood Industry','制造与机械','制材、木材加工及工厂内规定木制品生产工序。','木材产业领域对应特定技能1号评价考试。','wood_industry_1',false,'open-check'],
 ['resource-recycling','资源循环利用','資源循環','Resource Recycling','设施服务','废弃物处理设施的合规资源回收、分类和循环利用工作。','新设领域，具体考试、执行日及接收程序请以主管部门发布的实施指南为准。','',false,'detail-pending','官方总表已列出该领域，但独立详细页仍标记开发中；不可宣称现在所有职业已有考试和可申请日期。'],
 ['linen','布草洗涤与租赁服务','リネンサプライ','Linen Services','设施服务','酒店医院租赁布草的收取、清洗和管理。','新设领域，具体对应技能考试与实施要求以官方后续发布为准。','',false,'detail-pending','官方总表已列出该领域，细则页仍为准备中；报名和新COE资格需再次核查。'],
 ['logistics-warehouse','物流仓储','物流倉庫','Logistics Warehouse','交通运输','物流仓库收货、库存保管、分拣和发货等工作。','新设领域，具体技能评价考试及正式实施安排待主管部门核实。','',false,'detail-pending','官方总表虽已收录，但独立领域页仍标记准备中，不应将仓库招聘广告等同于已开放签证。']
];
export const jpSSWFields:JapanOccupation[]=fields.map(([id,name,japanese,english,group,examples,skill,slug,ssw2Eligible,status,extra])=>({
 id:'jp-'+id,name,japanese,english,group,pathwayId:'jp-ssw1',sector:true,ssw2Eligible,
 examples:examples.split('；').filter(Boolean),
 qualification:'特定技能1号重在规定的行业技能与语言考试，不设所有19领域统一的本科学位要求。符合规定的技能实习2号良好修了可能豁免部分考试；是否适用须按领域核对。',
 language:extra?.includes('N3')?extra:'一般须具备JLPT N4或JFT-Basic水平；具体领域可能另有专业日语评价考试或更高标准。'+(extra||''),
 experience:'特定技能1号没有适用于所有领域的统一几年工作经验要求；需要通过对应技能测评，企业可另有合法岗位经验要求。不可把企业招聘要求当政府统一资格门槛。',
 license:extra?.includes('驾驶')?'商用驾驶需适用日本驾驶资格、不同车辆类别的许可证和依法完成的训练。':slug===''?'主管部门尚未完整发布的领域考试及许可应标注待核验。':'是否需要额外职业执照应按本行业对应部门的规定查询，不能凭国内证书推断自动互认。',
 salary:'官方特定技能制度要求与从事同等工作的日本人同等待遇。没有适用于全国19领域的统一固定最低月薪数字；应以实际税前工资、法定地区最低工资、加班及扣费条款核对。',
 evidence:['具体行业考试及日语成绩（或法律允许的豁免证明）','日本企业的正式雇佣合同与书面劳动条件','本人身份资料、在留资格认定证明书申请所需文件','工资、岗位职责、工作地点、住房/支持费用的清晰条款'],
 steps:[
  '先在日本入管特定技能官方页面选择“'+name+'”领域，再确认详细工作内容与真实职位吻合。',
  '进入本领域官方详情及考试信息页，核对实际考试类别、举办国、时间和语言要求，记录目前是否开放。',
  '与接收企业确认工资、工时、是否有押金及扣费，并询问接收企业或注册支援机构如何提供生活支持。',
  '由接收企业办理COE或已有身份的资格变更；取得日本使馆签证或批准后再按照许可活动工作。'
 ],
 source:slug?base+slug+'/':base,sourceLabel:slug?'出入国在留管理厅·'+english+'细分领域':'出入国在留管理厅·特定技能19领域总表',
 status,caution:extra||'行业属于特定技能范围，不代表目前有真实雇主、可以随时参加考试或必然取得在留资格。',
 verifiedOn:'2026-11-04'
}));
type Pro=[string,string,string,string,string,string];
const professionals:Pro[]=[
 ['software','软件工程师／软件开发','Software Engineer','信息技术','设计、开发和维护应用软件、系统与专业程序；应有真实的技术知识任务。','计算机、软件工程等相关大学教育或规定的相应经历；实际课程与职责是否相关由入管审查。'],
 ['mechanical','机械工程师','Mechanical Engineer','工程技术','机械设计、设备研发、工艺技术开发与工程分析；不是单纯流水线装配。','机械工程等相关工程教育，或符合规定的相关专业工作经历。'],
 ['electrical','电气与电子工程师','Electrical / Electronics Engineer','工程技术','电力系统、电路设备、电子产品的技术设计与专业工程分析。','电气、电子、自动化等相关专业的实际课程与工程岗位职责对应；单纯维修工另需判断类别。'],
 ['data','数据分析／信息系统','Data Analyst / Information Systems','信息技术','数据建模、系统分析、业务系统设计，要求分析和计算机专业技能。','计算机、统计、信息系统或与工作内容相关的人文/理科知识；招聘广告写“数据”不能自动证明专业性。'],
 ['trading','国际贸易与海外业务','Overseas Business / Trade Specialist','商务与人文','国际贸易合同、海外供应链协调、市场沟通、业务开发等有专业知识的工作。','国际贸易、经济、商科等相关学位或规定专业经验；岗位须真正需要相应知识。'],
 ['marketing','市场营销与品牌企划','Marketing / Brand Planning','商务与人文','品牌策划、广告传播、市场研究和商务推广；纯促销站店工作不能直接套用。','市场营销、传播、商科等相关学历与职责相符；涉外文化敏感性业务可能适用不同经验规则。'],
 ['translation','翻译与口译','Translation / Interpretation','国际业务','企业内部口笔译、跨文化商务沟通和客户交流；不是打着翻译名义常年纯体力劳动。','大学毕业从事翻译/口译/语言教学可能适用特定工作经验例外；其他国际业务通常需要核对3年相关经验条款。'],
 ['product','产品设计与开发','Product Design / Development','设计与工程','工业产品设计、交互设计、服装与室内空间等有专业知识或文化能力的设计。','设计专业学历与相关项目作品；服装、室内设计等国际业务可能触发特殊经验或学校资格条件。'],
 ['accounting','会计与财务分析','Accounting / Financial Planning','商务与人文','财务管理、企业会计、预算分析和经营决策支持等专业活动。','会计、金融、经济等相关大学课程或适用工作经历；涉及法律专属执业内容需独立职业许可。']
];
export const jpEngineerExamples:JapanOccupation[]=professionals.map(([id,name,english,group,task,qualification])=>({
 id:'jp-pro-'+id,name,japanese:name,english,group,pathwayId:'jp-engineer',sector:false,ssw2Eligible:false,
 examples:[task],qualification:'技人国以岗位实际专业活动为中心。'+qualification,
 language:'技人国不存在适用于所有专业岗位的统一JLPT N2或N1法定门槛；雇主可按业务要求另定日语/英语水平。',
 experience:'相关专业大学毕业等是一条途径；其他途径可按规定的专业学校或10年经验标准。部分国际业务如翻译和口译有例外，不能全部套用统一年数。',
 license:'不是所有专业岗位均有统一日本执业证要求；工程监管、会计/法律专业业务等按具体受监管活动分别核实。',
 salary:'签证要求不得低于从事同等工作的日本人报酬，没有全国统一“技人国必须月薪25万日元”的官方普遍门槛。应根据城市、岗位和合同核对。',
 evidence:['大学学历和对应专业课程的毕业/成绩证明','雇主的专业职位描述、合同和同岗薪资依据','工作项目及专业技能证据（走经验途径时尤其重要）','日本企业真实经营证明和COE所需资料'],
 steps:['与日本雇主确认实际工作职责，尤其排除把日常纯体力劳动包装成专业职位。','把学位专业、项目与真实岗位任务逐项对照，必要时咨询入管相关审查说明。','核查日本人同等岗位工资和劳动条件，企业准备COE和正式雇佣资料。','签发签证并入境后按被批准活动工作，涉及工作内容变化时先核查在留资格限制。'],
 source:jpTechOfficial,sourceLabel:'2026-04-15更新·技人国官方审查说明',
 status:'open-check',caution:'本页是按入管允许的活动举出的岗位示例，并非入管发布的封闭“职业白名单”。职位名称本身不能证明符合技人国。',
 verifiedOn:'2026-11-04'
}));
export const jpOccupationRecords=[...jpSSWFields,...jpEngineerExamples];
export const jpSSW2FieldCount=jpSSWFields.filter(x=>x.ssw2Eligible).length;
