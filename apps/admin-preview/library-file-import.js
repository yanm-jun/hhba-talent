// HHBA admin: read Excel/CSV LOCALLY, never upload the original workbook.
export const LIB_BATCH_SIZE=100;
export const LIB_IMPORT_MAX_ROWS=50000;
export const LIB_IMPORT_MAX_BYTES=10*1024*1024;
export const LIB_HALL_NAMES=[
 ['automotive','汽车馆'],['semiconductor','电子半导体馆'],['internet-ai','互联网与AI馆'],
 ['energy','能源电力馆'],['manufacturing','智能制造馆'],['finance','金融馆'],
 ['telecom','通信馆'],['biomed','医药生物馆'],['aerospace','航空航天馆'],
 ['logistics','交通物流馆'],['construction','建筑工程馆'],
 ['consumer-hardware','家电与智能硬件馆'],['chem-materials','化工新材料馆'],
 ['retail','商贸零售馆'],['agri-food','农业食品馆'],['culture-media','文化传媒馆'],
 ['education-research','教育科研馆']
];
const names=new Map();
for(const [id,label] of LIB_HALL_NAMES){
 names.set(id,id);names.set(label,id);names.set(label.replace(/馆$/,''),id);
}
for(const [alias,id] of [['互联网AI','internet-ai'],['互联网与人工智能','internet-ai'],['医药生活','biomed'],['教育培训','education-research'],['交通运输','logistics'],['家电智能硬件','consumer-hardware']])names.set(alias,id);
export function industryId(value){return names.get(String(value??'').replace(/\s+/g,'').replace(/[·•]/g,'').trim())||null}
const text=v=>String(v??'').trim();
const normalKey=s=>text(s).toLowerCase().replace(/\/+$/,'');
function safeUrl(raw){
 const s=text(raw);
 if(!s||s.length>1500||/[\s\x00-\x1f\x7f]/.test(s))return null;
 try{const u=new URL(s);return u.protocol==='https:'&&u.hostname.includes('.')&&!u.username&&!u.password?u.href:null}
 catch{return null}
}
export function parseDelimited(input,delimiter=','){
 const rows=[],source=String(input).replace(/^\uFEFF/,'');
 let cells=[],cell='',inQuotes=false,line=1,start=1;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(c==='"'){
   if(inQuotes&&source[i+1]==='"'){cell+='"';i++}
   else if(inQuotes)inQuotes=false;
   else if(!cell.length)inQuotes=true;
   else cell+=c;
  }else if(c===delimiter&&!inQuotes){cells.push(cell);cell=''}
  else if((c==='\r'||c==='\n')&&!inQuotes){
   cells.push(cell);rows.push({line:start,cells});cells=[];cell='';
   if(c==='\r'&&source[i+1]==='\n')i++;
   line++;start=line;
  }else{cell+=c;if(c==='\n')line++}
 }
 if(inQuotes)throw Error('CSV 引号没有闭合，请重新保存文件。');
 if(cell||cells.length){cells.push(cell);rows.push({line:start,cells})}
 return rows;
}
const decodeXML=s=>String(s).replace(/&#x([0-9a-f]+);|&#([0-9]+);|&([^;]+);/gi,(_,hex,dec,name)=>{
 if(hex||dec){const cp=parseInt(hex||dec,hex?16:10);return cp>=0&&cp<=0x10ffff&&!(cp>=0xd800&&cp<=0xdfff)?String.fromCodePoint(cp):''}
 return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[name]||'&'+name+';')
});
function attrs(s){
 const out={};for(const m of String(s).matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))out[m[1]]=decodeXML(m[2]??m[3]??'');
 return out;
}
function tagValue(s,tag){
 const re=new RegExp('<(?:[\\w-]+:)?'+tag+'\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?'+tag+'>','g');
 return [...String(s).matchAll(re)].map(m=>decodeXML(m[1].replace(/<[^>]*>/g,''))).join('');
}
function columnIndex(ref){
 let n=0;for(const ch of String(ref).toUpperCase().match(/^[A-Z]+/)?.[0]||'')n=n*26+ch.charCodeAt(0)-64;
 return n>0&&n<=100?n-1:null;
}
function rowsFromXml(xml,strings){
 const rows=[];
 for(const row of xml.matchAll(/<(?:[\w-]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?row>/g)){
  const line=Number(attrs(row[1]).r)||rows.length+1,cells=[],formulaColumns=new Set();let fallback=0;
  for(const cell of row[2].matchAll(/<(?:[\w-]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[\w-]+:)?c>)/g)){
   const a=attrs(cell[1]),col=columnIndex(a.r)??fallback++,body=cell[2]||'';fallback=Math.max(fallback,col+1);
   if(col>100)continue;
   if(/<(?:[\w-]+:)?f(?:\s|>|\/)/.test(body)){formulaColumns.add(col);cells[col]='';continue}
   if(a.t==='inlineStr')cells[col]=tagValue(body,'t');
   else if(a.t==='s')cells[col]=strings[Number(tagValue(body,'v'))]||'';
   else cells[col]=tagValue(body,'v')||tagValue(body,'t');
  }
  rows.push({line,cells,formulaColumns});
  if(rows.length>LIB_IMPORT_MAX_ROWS+30)throw Error('Excel 行数超过安全限制。');
 }
 return rows;
}
function zipDirectory(buffer){
 const b=new Uint8Array(buffer),v=new DataView(buffer),u16=i=>v.getUint16(i,true),u32=i=>v.getUint32(i,true);
 let end=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(u32(i)===0x06054b50){end=i;break}}
 if(end<0)throw Error('无效的 XLSX 文件：ZIP 目录缺失。');
 const count=u16(end+10),length=u32(end+12),start=u32(end+16);
 if(count>2000||length>5*1024*1024||start+length>b.length)throw Error('Excel 结构超出安全限制。');
 const entries=new Map(),decoder=new TextDecoder('utf-8',{fatal:true});let p=start;
 for(let i=0;i<count;i++){
  if(p+46>b.length||u32(p)!==0x02014b50)throw Error('Excel ZIP 目录损坏。');
  const flag=u16(p+8),method=u16(p+10),packed=u32(p+20),size=u32(p+24);
  const n=u16(p+28),extra=u16(p+30),comment=u16(p+32),local=u32(p+42);
  const name=decoder.decode(b.subarray(p+46,p+46+n));
  if(flag&1||size>20*1024*1024||packed>10*1024*1024)throw Error('加密或过大的 Excel 内容不支持。');
  if(name.startsWith('xl/')&&!name.includes('..'))entries.set(name,{method,packed,size,local});
  p+=46+n+extra+comment;
 }
 return {b,v,entries};
}
async function extract(zip,path){
 const e=zip.entries.get(path);if(!e)return null;
 const v=zip.v,b=zip.b,p=e.local;
 if(p+30>b.length||v.getUint32(p,true)!==0x04034b50)throw Error('Excel ZIP 数据损坏。');
 const start=p+30+v.getUint16(p+26,true)+v.getUint16(p+28,true);
 if(start+e.packed>b.length)throw Error('Excel ZIP 数据不完整。');
 const compressed=b.subarray(start,start+e.packed);let output;
 if(e.method===0)output=compressed;
 else if(e.method===8){
  if(typeof DecompressionStream!=='function')throw Error('请更新 Edge 浏览器或将 Excel 另存为 CSV。');
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  output=new Uint8Array(await new Response(stream).arrayBuffer());
 }else throw Error('Excel 压缩格式不受支持。');
 if(output.length!==e.size||output.length>20*1024*1024)throw Error('Excel 解压校验失败。');
 return new TextDecoder('utf-8',{fatal:true}).decode(output);
}
export async function readXlsx(buffer){
 const zip=zipDirectory(buffer),workbook=await extract(zip,'xl/workbook.xml');
 if(!workbook)throw Error('Excel 工作簿不存在。');
 const rels=await extract(zip,'xl/_rels/workbook.xml.rels');let sheet='xl/worksheets/sheet1.xml';
 if(rels){
  const m=workbook.match(/<(?:[\w-]+:)?sheet\b([^>]*?)(?:\/>|>)/),id=m&&attrs(m[1])['r:id'];
  const r=[...rels.matchAll(/<(?:[\w-]+:)?Relationship\b([^>]*?)(?:\/>|>)/g)].map(m=>attrs(m[1])).find(a=>a.Id===id&&!a.TargetMode);
  if(r?.Target){
   const parts=(r.Target.startsWith('/')?r.Target.slice(1):'xl/'+r.Target).split('/'),clean=[];
   for(const part of parts){if(!part||part==='.')continue;if(part==='..')clean.pop();else clean.push(part)}
   const path=clean.join('/');
   if(path.startsWith('xl/worksheets/')&&path.endsWith('.xml'))sheet=path;
  }
 }
 const xml=await extract(zip,sheet);if(!xml)throw Error('未找到第一张工作表。');
 const shared=await extract(zip,'xl/sharedStrings.xml'),strings=[];
 if(shared)for(const m of shared.matchAll(/<(?:[\w-]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?si>/g)){
  strings.push(tagValue(m[1],'t'));
  if(strings.length>LIB_IMPORT_MAX_ROWS*4)throw Error('Excel 字符串数量过大。');
 }
 return rowsFromXml(xml,strings);
}
const normHeader=s=>text(s).toLowerCase().replace(/[\s_\-（）():：·]/g,'');
function headerType(s){
 const v=normHeader(s);
 if(['企业名称','公司名称','企业','公司','招聘企业','企业主体','enterprise','company','employer','name'].includes(v))return 'enterprise';
 if(['招聘网址','招聘链接','官方招聘网址','官方招聘链接','招聘入口','招聘官网','官网招聘入口','职位链接','url','recruitmenturl','careerurl','careersurl','jobsurl'].includes(v))return 'recruitment_url';
 if(['行业','所属行业','行业馆','行业id','行业编号','分类','industry','industryid','hall'].includes(v))return 'industry_id';
 return null;
}
export function prepareImport(raw,{defaultIndustry='',maxRows=LIB_IMPORT_MAX_ROWS}={}){
 const rows=raw.filter(r=>r.cells.some(c=>text(c)!=='')||r.formulaColumns?.size);
 if(rows.length>maxRows+15)throw Error('导入数量超过 50,000 条。');
 let start=0,columns=null;
 for(let i=0;i<Math.min(15,rows.length);i++){
  const found={};
  rows[i].cells.forEach((c,j)=>{const key=headerType(c);if(key&&found[key]===undefined)found[key]=j});
  if(found.enterprise!==undefined&&found.recruitment_url!==undefined){columns=found;start=i+1;break}
 }
 if(!columns){
  const isHall=industryId(rows[0]?.cells?.[0]);
  columns=isHall?{industry_id:0,enterprise:1,recruitment_url:2}:{enterprise:0,recruitment_url:1};
 }
 const valid=[],invalid=[],duplicate=[],seen=new Set(),body=rows.slice(start);
 if(body.length>maxRows)throw Error('数据行数超过 50,000 条。');
 for(const row of body){
  const cell=i=>text(row.cells[i]),enterprise=cell(columns.enterprise);
  const rawHall=columns.industry_id===undefined?'':cell(columns.industry_id);
  const industry_id=rawHall?industryId(rawHall):industryId(defaultIndustry);
  const recruitment_url=safeUrl(cell(columns.recruitment_url));
  let reason='';
  if(row.formulaColumns?.has(columns.enterprise)||row.formulaColumns?.has(columns.recruitment_url)||columns.industry_id!==undefined&&row.formulaColumns?.has(columns.industry_id))
   reason='含公式，请粘贴为值后重试';
  else if(!industry_id)reason='未识别行业馆，请填写行业列或选择默认行业';
  else if(!enterprise||enterprise.length>120||/[\x00-\x1f\x7f]/.test(enterprise))reason='企业名称无效';
  else if(!recruitment_url)reason='网址必须为完整有效的 HTTPS 招聘链接';
  const item={line:row.line,industry_id,enterprise,recruitment_url};
  if(reason){invalid.push({...item,reason});continue}
  const key=industry_id+'|'+normalKey(recruitment_url);
  if(seen.has(key)){duplicate.push({...item,reason:'文件内重复'});continue}
  seen.add(key);valid.push({...item,verified:false});
 }
 return {total:body.length,valid,invalid,duplicate,detectedHeader:!!start};
}
export function planImportBatches(rows,size=LIB_BATCH_SIZE){
 if(!Number.isInteger(size)||size<1||size>100)throw Error('每批最多 100 条。');
 const batches=[];for(let i=0;i<rows.length;i+=size)batches.push(rows.slice(i,i+size));
 return batches;
}
export async function parseImportFile(file,{defaultIndustry=''}={}){
 if(!file||file.size>LIB_IMPORT_MAX_BYTES)throw Error('请选择不超过 10 MB 的 Excel 或 CSV 文件。');
 const name=text(file.name).toLowerCase();let rows;
 if(name.endsWith('.xlsx'))rows=await readXlsx(await file.arrayBuffer());
 else if(name.endsWith('.csv'))rows=parseDelimited(await file.text());
 else throw Error('仅支持 .xlsx 和 .csv；旧版 .xls 请另存为 .xlsx。');
 return {...prepareImport(rows,{defaultIndustry}),name:file.name};
}
export function parseImportText(value,defaultIndustry){
 return prepareImport(parseDelimited(value,'\t'),{defaultIndustry});
}
export function exportFailedCSV(items){
 const c=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[\s]*[=+\-@]/,s=>"'"+s)+'"';
 return '\uFEFF'+[['行号','行业馆','企业名称','招聘网址','失败原因'],
  ...items.map(x=>[x.line||'',x.industry_id||'',x.enterprise||'',x.recruitment_url||'',x.reason||''])]
  .map(r=>r.map(c).join(',')).join('\r\n');
}
