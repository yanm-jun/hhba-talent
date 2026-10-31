/** V4.1 city dictionary. This release targets only the four municipalities.
 * Existing non-municipality cities stay as legacy indexed cities; 293 prefecture-level
 * cities are NOT claimed as implemented. No placeholder records are invented. */
export type TalentCity={
 name:string;official:string;province:string;level:'municipality'|'prefecture-preview'|'prefecture';
 intro:string;aliases:string[];photo?:string;credit?:string;photoPage?:string;code?:string;pinyin?:string;initials?:string
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
 {name:'济南',official:'济南市',province:'山东',level:'prefecture-preview',intro:'省会就业机会与青年人才支持',aliases:['济南','济南市','jinan'],photo:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Jinan_CBD_skyline_June_2023.jpg?width=1280',credit:'Percival Kestreltail · CC BY-SA 4.0',photoPage:'https://commons.wikimedia.org/wiki/File:Jinan_CBD_skyline_June_2023.jpg'},
 {name:'临沂',official:'临沂市',province:'山东',level:'prefecture-preview',intro:'临沂青年人才津贴、首次购房补贴、首次创业扶持与租赁型人才公寓政策；2026年人才公寓批次已截止',aliases:['临沂','临沂市','linyi','lin yi']},
 {name:'东营',official:'东营市',province:'山东',level:'prefecture-preview',intro:'2026年8月人才新政与旧补贴衔接、首次创业支持及人才安居资料核验',aliases:['东营','东营市','dongying','dong ying']},
 {name:'济宁',official:'济宁市',province:'山东',level:'prefecture-preview',intro:'青年引才补贴、首次创业、OPC企业用工支持、主城区租房补贴及保租房政策入口；住房项目空房以官方公告为准',aliases:['济宁','济宁市','jining','ji ning']},
 {name:'滨州',official:'滨州市',province:'山东',level:'prefecture-preview',intro:'2026年大学生购房与生活补助历史批次、创业与灵活就业补贴、邹平天健苑及创新人才公寓资料',aliases:['滨州','滨州市','binzhou','bin zhou']},
 {name:'唐山',official:'唐山市',province:'河北',level:'prefecture-preview',intro:'凤凰英才2024/2026奖补对照、博士硕士本科生活与购房政策、高新区数字经济产业园青年公寓及市级租赁制度',aliases:['唐山','唐山市','tangshan','tang shan']},
 {name:'衡水',official:'衡水市',province:'河北',level:'prefecture-preview',intro:'2024引才新十四条：毕业生安家补助、湖城英才卡租购房、人才公寓和技能奖励；2026办理入口及在租项目待核',aliases:['衡水','衡水市','hengshui','heng shui','hs']},
 {name:'张家口',official:'张家口市',province:'河北',level:'prefecture-preview',intro:'2026硕博引进博士住房15万历史批次、医院硕博专项资助、高创园人才公寓与创业办公扶持、桥东2026保障房改造事实核查',aliases:['张家口','张家口市','zhangjiakou','zhang jia kou','zjk']},
 {name:'廊坊',official:'廊坊市',province:'河北',level:'prefecture-preview',intro:'2025租购房人才补贴分档、2026公租房冀时办申请、固安人才家园和人才住房历史项目资料',aliases:['廊坊','廊坊市','langfang','lang fang','lf']},
];

const prefectureRaw=`130100|石家庄市|河北省|shi jia zhuang
130200|唐山市|河北省|tang shan
130300|秦皇岛市|河北省|qin huang dao
130400|邯郸市|河北省|han dan
130500|邢台市|河北省|xing tai
130600|保定市|河北省|bao ding
130700|张家口市|河北省|zhang jia kou
130800|承德市|河北省|cheng de
130900|沧州市|河北省|cang zhou
131000|廊坊市|河北省|lang fang
131100|衡水市|河北省|heng shui
140100|太原市|山西省|tai yuan
140200|大同市|山西省|da tong
140300|阳泉市|山西省|yang quan
140400|长治市|山西省|chang zhi
140500|晋城市|山西省|jin cheng
140600|朔州市|山西省|shuo zhou
140700|晋中市|山西省|jin zhong
140800|运城市|山西省|yun cheng
140900|忻州市|山西省|xin zhou
141000|临汾市|山西省|lin fen
141100|吕梁市|山西省|lv liang
150100|呼和浩特市|内蒙古自治区|hu he hao te
150200|包头市|内蒙古自治区|bao tou
150300|乌海市|内蒙古自治区|wu hai
150400|赤峰市|内蒙古自治区|chi feng
150500|通辽市|内蒙古自治区|tong liao
150600|鄂尔多斯市|内蒙古自治区|e er duo si
150700|呼伦贝尔市|内蒙古自治区|hu lun bei er
150800|巴彦淖尔市|内蒙古自治区|ba yan nao er
150900|乌兰察布市|内蒙古自治区|wu lan cha bu
210100|沈阳市|辽宁省|shen yang
210200|大连市|辽宁省|da lian
210300|鞍山市|辽宁省|an shan
210400|抚顺市|辽宁省|fu shun
210500|本溪市|辽宁省|ben xi
210600|丹东市|辽宁省|dan dong
210700|锦州市|辽宁省|jin zhou
210800|营口市|辽宁省|ying kou
210900|阜新市|辽宁省|fu xin
211000|辽阳市|辽宁省|liao yang
211100|盘锦市|辽宁省|pan jin
211200|铁岭市|辽宁省|tie ling
211300|朝阳市|辽宁省|chao yang
211400|葫芦岛市|辽宁省|hu lu dao
220100|长春市|吉林省|chang chun
220200|吉林市|吉林省|ji lin shi
220300|四平市|吉林省|si ping
220400|辽源市|吉林省|liao yuan
220500|通化市|吉林省|tong hua
220600|白山市|吉林省|bai shan
220700|松原市|吉林省|song yuan
220800|白城市|吉林省|bai cheng
230100|哈尔滨市|黑龙江省|ha er bin
230200|齐齐哈尔市|黑龙江省|qi qi ha er
230300|鸡西市|黑龙江省|ji xi
230400|鹤岗市|黑龙江省|he gang
230500|双鸭山市|黑龙江省|shuang ya shan
230600|大庆市|黑龙江省|da qing
230700|伊春市|黑龙江省|yi chun
230800|佳木斯市|黑龙江省|jia mu si
230900|七台河市|黑龙江省|qi tai he
231000|牡丹江市|黑龙江省|mu dan jiang
231100|黑河市|黑龙江省|hei he
231200|绥化市|黑龙江省|sui hua
320100|南京市|江苏省|nan jing
320200|无锡市|江苏省|wu xi
320300|徐州市|江苏省|xu zhou
320400|常州市|江苏省|chang zhou
320500|苏州市|江苏省|su zhou
320600|南通市|江苏省|nan tong
320700|连云港市|江苏省|lian yun gang
320800|淮安市|江苏省|huai an
320900|盐城市|江苏省|yan cheng
321000|扬州市|江苏省|yang zhou
321100|镇江市|江苏省|zhen jiang
321200|泰州市|江苏省|tai zhou
321300|宿迁市|江苏省|su qian
330100|杭州市|浙江省|hang zhou
330200|宁波市|浙江省|ning bo
330300|温州市|浙江省|wen zhou
330400|嘉兴市|浙江省|jia xing
330500|湖州市|浙江省|hu zhou
330600|绍兴市|浙江省|shao xing
330700|金华市|浙江省|jin hua
330800|衢州市|浙江省|qu zhou
330900|舟山市|浙江省|zhou shan
331000|台州市|浙江省|tai zhou
331100|丽水市|浙江省|li shui
340100|合肥市|安徽省|he fei
340200|芜湖市|安徽省|wu hu
340300|蚌埠市|安徽省|beng bu
340400|淮南市|安徽省|huai nan
340500|马鞍山市|安徽省|ma an shan
340600|淮北市|安徽省|huai bei
340700|铜陵市|安徽省|tong ling
340800|安庆市|安徽省|an qing
341000|黄山市|安徽省|huang shan
341100|滁州市|安徽省|chu zhou
341200|阜阳市|安徽省|fu yang
341300|宿州市|安徽省|su zhou
341500|六安市|安徽省|lu an
341600|亳州市|安徽省|bo zhou
341700|池州市|安徽省|chi zhou
341800|宣城市|安徽省|xuan cheng
350100|福州市|福建省|fu zhou
350200|厦门市|福建省|xia men
350300|莆田市|福建省|pu tian
350400|三明市|福建省|san ming
350500|泉州市|福建省|quan zhou
350600|漳州市|福建省|zhang zhou
350700|南平市|福建省|nan ping
350800|龙岩市|福建省|long yan
350900|宁德市|福建省|ning de
360100|南昌市|江西省|nan chang
360200|景德镇市|江西省|jing de zhen
360300|萍乡市|江西省|ping xiang
360400|九江市|江西省|jiu jiang
360500|新余市|江西省|xin yu
360600|鹰潭市|江西省|ying tan
360700|赣州市|江西省|gan zhou
360800|吉安市|江西省|ji an
360900|宜春市|江西省|yi chun
361000|抚州市|江西省|fu zhou
361100|上饶市|江西省|shang rao
370100|济南市|山东省|ji nan
370200|青岛市|山东省|qing dao
370300|淄博市|山东省|zi bo
370400|枣庄市|山东省|zao zhuang
370500|东营市|山东省|dong ying
370600|烟台市|山东省|yan tai
370700|潍坊市|山东省|wei fang
370800|济宁市|山东省|ji ning
370900|泰安市|山东省|tai an
371000|威海市|山东省|wei hai
371100|日照市|山东省|ri zhao
371300|临沂市|山东省|lin yi
371400|德州市|山东省|de zhou
371500|聊城市|山东省|liao cheng
371600|滨州市|山东省|bin zhou
371700|菏泽市|山东省|he ze
410100|郑州市|河南省|zheng zhou
410200|开封市|河南省|kai feng
410300|洛阳市|河南省|luo yang
410400|平顶山市|河南省|ping ding shan
410500|安阳市|河南省|an yang
410600|鹤壁市|河南省|he bi
410700|新乡市|河南省|xin xiang
410800|焦作市|河南省|jiao zuo
410900|濮阳市|河南省|pu yang
411000|许昌市|河南省|xu chang
411100|漯河市|河南省|luo he
411200|三门峡市|河南省|san men xia
411300|南阳市|河南省|nan yang
411400|商丘市|河南省|shang qiu
411500|信阳市|河南省|xin yang
411600|周口市|河南省|zhou kou
411700|驻马店市|河南省|zhu ma dian
420100|武汉市|湖北省|wu han
420200|黄石市|湖北省|huang shi
420300|十堰市|湖北省|shi yan
420500|宜昌市|湖北省|yi chang
420600|襄阳市|湖北省|xiang yang
420700|鄂州市|湖北省|e zhou
420800|荆门市|湖北省|jing men
420900|孝感市|湖北省|xiao gan
421000|荆州市|湖北省|jing zhou
421100|黄冈市|湖北省|huang gang
421200|咸宁市|湖北省|xian ning
421300|随州市|湖北省|sui zhou
430100|长沙市|湖南省|chang sha
430200|株洲市|湖南省|zhu zhou
430300|湘潭市|湖南省|xiang tan
430400|衡阳市|湖南省|heng yang
430500|邵阳市|湖南省|shao yang
430600|岳阳市|湖南省|yue yang
430700|常德市|湖南省|chang de
430800|张家界市|湖南省|zhang jia jie
430900|益阳市|湖南省|yi yang
431000|郴州市|湖南省|chen zhou
431100|永州市|湖南省|yong zhou
431200|怀化市|湖南省|huai hua
431300|娄底市|湖南省|lou di
440100|广州市|广东省|guang zhou
440200|韶关市|广东省|shao guan
440300|深圳市|广东省|shen zhen
440400|珠海市|广东省|zhu hai
440500|汕头市|广东省|shan tou
440600|佛山市|广东省|fo shan
440700|江门市|广东省|jiang men
440800|湛江市|广东省|zhan jiang
440900|茂名市|广东省|mao ming
441200|肇庆市|广东省|zhao qing
441300|惠州市|广东省|hui zhou
441400|梅州市|广东省|mei zhou
441500|汕尾市|广东省|shan wei
441600|河源市|广东省|he yuan
441700|阳江市|广东省|yang jiang
441800|清远市|广东省|qing yuan
441900|东莞市|广东省|dong guan
442000|中山市|广东省|zhong shan
445100|潮州市|广东省|chao zhou
445200|揭阳市|广东省|jie yang
445300|云浮市|广东省|yun fu
450100|南宁市|广西壮族自治区|nan ning
450200|柳州市|广西壮族自治区|liu zhou
450300|桂林市|广西壮族自治区|gui lin
450400|梧州市|广西壮族自治区|wu zhou
450500|北海市|广西壮族自治区|bei hai
450600|防城港市|广西壮族自治区|fang cheng gang
450700|钦州市|广西壮族自治区|qin zhou
450800|贵港市|广西壮族自治区|gui gang
450900|玉林市|广西壮族自治区|yu lin
451000|百色市|广西壮族自治区|bai se
451100|贺州市|广西壮族自治区|he zhou
451200|河池市|广西壮族自治区|he chi
451300|来宾市|广西壮族自治区|lai bin
451400|崇左市|广西壮族自治区|chong zuo
460100|海口市|海南省|hai kou
460200|三亚市|海南省|san ya
460300|三沙市|海南省|san sha
460400|儋州市|海南省|dan zhou
510100|成都市|四川省|cheng du
510300|自贡市|四川省|zi gong
510400|攀枝花市|四川省|pan zhi hua
510500|泸州市|四川省|lu zhou
510600|德阳市|四川省|de yang
510700|绵阳市|四川省|mian yang
510800|广元市|四川省|guang yuan
510900|遂宁市|四川省|sui ning
511000|内江市|四川省|nei jiang
511100|乐山市|四川省|le shan
511300|南充市|四川省|nan chong
511400|眉山市|四川省|mei shan
511500|宜宾市|四川省|yi bin
511600|广安市|四川省|guang an
511700|达州市|四川省|da zhou
511800|雅安市|四川省|ya an
511900|巴中市|四川省|ba zhong
512000|资阳市|四川省|zi yang
520100|贵阳市|贵州省|gui yang
520200|六盘水市|贵州省|liu pan shui
520300|遵义市|贵州省|zun yi
520400|安顺市|贵州省|an shun
520500|毕节市|贵州省|bi jie
520600|铜仁市|贵州省|tong ren
530100|昆明市|云南省|kun ming
530300|曲靖市|云南省|qu jing
530400|玉溪市|云南省|yu xi
530500|保山市|云南省|bao shan
530600|昭通市|云南省|zhao tong
530700|丽江市|云南省|li jiang
530800|普洱市|云南省|pu er
530900|临沧市|云南省|lin cang
540100|拉萨市|西藏自治区|la sa
540200|日喀则市|西藏自治区|ri ka ze
540300|昌都市|西藏自治区|chang du
540400|林芝市|西藏自治区|lin zhi
540500|山南市|西藏自治区|shan nan
540600|那曲市|西藏自治区|na qu
610100|西安市|陕西省|xi an
610200|铜川市|陕西省|tong chuan
610300|宝鸡市|陕西省|bao ji
610400|咸阳市|陕西省|xian yang
610500|渭南市|陕西省|wei nan
610600|延安市|陕西省|yan an
610700|汉中市|陕西省|han zhong
610800|榆林市|陕西省|yu lin
610900|安康市|陕西省|an kang
611000|商洛市|陕西省|shang luo
620100|兰州市|甘肃省|lan zhou
620200|嘉峪关市|甘肃省|jia yu guan
620300|金昌市|甘肃省|jin chang
620400|白银市|甘肃省|bai yin
620500|天水市|甘肃省|tian shui
620600|武威市|甘肃省|wu wei
620700|张掖市|甘肃省|zhang ye
620800|平凉市|甘肃省|ping liang
620900|酒泉市|甘肃省|jiu quan
621000|庆阳市|甘肃省|qing yang
621100|定西市|甘肃省|ding xi
621200|陇南市|甘肃省|long nan
630100|西宁市|青海省|xi ning
630200|海东市|青海省|hai dong
640100|银川市|宁夏回族自治区|yin chuan
640200|石嘴山市|宁夏回族自治区|shi zui shan
640300|吴忠市|宁夏回族自治区|wu zhong
640400|固原市|宁夏回族自治区|gu yuan
640500|中卫市|宁夏回族自治区|zhong wei
650100|乌鲁木齐市|新疆维吾尔自治区|wu lu mu qi
650200|克拉玛依市|新疆维吾尔自治区|ke la ma yi
650400|吐鲁番市|新疆维吾尔自治区|tu lu fan
650500|哈密市|新疆维吾尔自治区|ha mi`;
const provinceRaw=`130000|河北省
140000|山西省
150000|内蒙古自治区
210000|辽宁省
220000|吉林省
230000|黑龙江省
320000|江苏省
330000|浙江省
340000|安徽省
350000|福建省
360000|江西省
370000|山东省
410000|河南省
420000|湖北省
430000|湖南省
440000|广东省
450000|广西壮族自治区
460000|海南省
510000|四川省
520000|贵州省
530000|云南省
540000|西藏自治区
610000|陕西省
620000|甘肃省
630000|青海省
640000|宁夏回族自治区
650000|新疆维吾尔自治区`;
const prefectureLegacy=new Map(TALENT_LEGACY_CITIES.map(c=>[c.name,c]));
function shortProvince(s:string){return s.replace(/维吾尔自治区|壮族自治区|回族自治区|自治区|省$/,'')}
export const TALENT_PROVINCES=provinceRaw.trim().split('\n').map(v=>{const [code,official]=v.split('|');return {code,official,name:shortProvince(official)}});
export const TALENT_PREFECTURE_CITIES:TalentCity[]=prefectureRaw.trim().split('\n').map(v=>{
 const [code,official,province,pinyin]=v.split('|');
 const name=official.slice(0,-1);
 const old=prefectureLegacy.get(name);
 const initials=pinyin.split(' ').map(x=>x[0]).join('');
 const py=pinyin.replace(/\s+/g,'');
 const sh=shortProvince(province);
 const aliases=[name,official,py,initials,pinyin,province+name,province+official,sh+name,sh+official,...(old?.aliases||[])];
 return {...old,name,official,province,code,pinyin,initials,level:'prefecture' as const,
  photo:old?.photo||(name==='邢台'?'https://commons.wikimedia.org/wiki/Special:Redirect/file/Xingtai_Taihang_International_Convention_and_Exhibition_Center.jpg?width=1280':name==='石家庄'?'https://commons.wikimedia.org/wiki/Special:Redirect/file/Skyline_of_Shijiazhuang_2012.jpg?width=1280':undefined),
  credit:old?.credit||(name==='邢台'?'Wcr1993 · Wikimedia Commons':name==='石家庄'?'ping lin · CC0 · Wikimedia Commons':undefined),
  photoPage:old?.photoPage||(name==='邢台'?'https://commons.wikimedia.org/wiki/File:Xingtai_Taihang_International_Convention_and_Exhibition_Center.jpg':name==='石家庄'?'https://commons.wikimedia.org/wiki/File:Skyline_of_Shijiazhuang_2012.jpg':undefined),
  aliases:[...new Set(aliases)],intro:old?.intro||(name==='沧州'?'已收录2025人才新政生活与购房补贴、人才公寓免租及岭贤府和经开区历史住房资料；2026办理入口与实时房源待核验':name==='邢台'?'已收录2026回邢来邢人才三年分期购房补贴、36个月租房补贴、就业支持及真实住房待核验线索':name==='石家庄'?'河北首站：市级B卡租购房补贴、毕业生一次性安家补贴、2026人才公寓与公租房历史项目':name==='日照'?'已收录青年人才补贴、先租后购住房优惠，并整理市级及高新区人才公寓历史资料':name==='枣庄'?'已收录2026青年就业创业补贴、首批高层次人才家园试点，另有薛城保租房和高新区公寓待核验线索':name==='聊城'?'已收录2026青年人才生活及社保补贴；人才住房三年免租和购房支持为2022历史政策，另有3处公寓或工程待核验线索':name==='承德'?'已收录2026年主导产业租房与一次性生活补助、燕赵英才卡、配售型保障住房以及京津科技人才公寓历史制度；具体空房和申报直达入口待核验':name==='秦皇岛'?'已收录秦皇岛经开区官方人才公寓政策及配租流程；锦绣佳成与科技大厦项目依据2025年报道列为待核验房源线索':name==='保定'?'已收录2026国控高新区四小区保租房与公积金租房提取制度，2022毕业生租购房补贴作为历史政策参考；284套为四小区批次总量，不是实时空房':'人才政策与住房资料正在逐步核验')};
});
const municipalityCode:Record<string,string>={北京:'110000',天津:'120000',上海:'310000',重庆:'500000'};
export const TALENT_CITY_INDEX:TalentCity[]=[
 ...TALENT_MUNICIPALITIES.map(c=>({...c,code:municipalityCode[c.name]})),
 ...TALENT_PREFECTURE_CITIES
];
const normalize=(text:string)=>text.trim().toLowerCase().replace(/[\s，。,.、·•\-]/g,'');
export function findTalentProvince(input:string){
 const q=normalize(input);
 return q?TALENT_PROVINCES.find(p=>normalize(p.name)===q||normalize(p.official)===q)||null:null;
}
export function findTalentCity(input:string){
 const q=normalize(input);
 if(!q)return null;
 const matches=TALENT_CITY_INDEX.filter(c=>c.aliases.some(a=>normalize(a)===q));
 return matches.length===1?matches[0]:null; // Avoid silently selecting a wrong city for ambiguous pinyin initials.
}
const matchingAliases=TALENT_CITY_INDEX.flatMap(city=>city.aliases
 .filter(a=>!(/^[a-z]{2}$/i.test(a)))
 .map(alias=>({city,alias:normalize(alias)})))
 .sort((a,b)=>b.alias.length-a.alias.length);
export function parseTalentCityQuery(input:string,fallback='北京'){
 const q=normalize(input);
 if(!q)return {city:fallback,matchedCity:false,cityOnly:false,query:input.trim()};
 const exact=findTalentCity(q);
 if(exact)return {city:exact.name,matchedCity:true,cityOnly:true,query:input.trim()};
 const found=matchingAliases.find(x=>q.startsWith(x.alias))||matchingAliases.find(x=>q.includes(x.alias));
 if(!found)return {city:fallback,matchedCity:false,cityOnly:false,query:input.trim()};
 const remain=q.replace(found.alias,'').replace(/^市/,'');
 return {city:found.city.name,matchedCity:true,cityOnly:!remain||/^(人才)?(政策|服务|政策查询)?$/.test(remain),query:input.trim()};
}
export function suggestTalentCities(input:string,limit=8){
 const q=normalize(input);
 if(!q)return TALENT_MUNICIPALITIES.slice(0,limit);
 const province=findTalentProvince(q);
 if(province)return TALENT_PREFECTURE_CITIES.filter(c=>c.province===province.official).slice(0,limit);
 return TALENT_CITY_INDEX.map(city=>{
  let score=1000;
  for(const alias of city.aliases){
   const a=normalize(alias);
   if(!a)continue;
   if(a===q)score=Math.min(score,0);
   else if(a.startsWith(q))score=Math.min(score,1);
   else if(q.startsWith(a))score=Math.min(score,3);
   else if(a.includes(q))score=Math.min(score,5);
  }
  return {city,score};
 }).filter(x=>x.score<1000)
 .sort((a,b)=>a.score-b.score||(a.city.level==='municipality'?-1:1)||(a.city.code||'').localeCompare(b.city.code||''))
 .slice(0,limit).map(x=>x.city);
}
export function queryTalentCities(input:string,province=''){
 const q=normalize(input);
 const prov=findTalentProvince(q);
 return TALENT_CITY_INDEX.filter(c=>{
  if(province==='直辖市'&&c.level!=='municipality')return false;
  if(province&&province!=='直辖市'&&c.province!==province)return false;
  if(!q)return true;
  if(prov)return c.province===prov.official;
  return c.aliases.some(a=>normalize(a).includes(q))||normalize(c.province).includes(q);
 });
}
