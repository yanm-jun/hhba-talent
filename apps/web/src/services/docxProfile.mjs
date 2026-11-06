// Dependency-free, browser-side DOCX text extractor. Operates on bytes fetched
// from the user's own private R2 vault after an explicit click. No external AI,
// upload or third-party script is involved. PDF decoding needs a dedicated,
// audited parser; never return guessed fields for an unsupported PDF.
const read16=(view,offset)=>view.getUint16(offset,true);
const read32=(view,offset)=>view.getUint32(offset,true);
const dec=new TextDecoder();
const MAX_XML=2*1024*1024;
const MAX_ZIP=3*1024*1024;
const MAX_TEXT=50000;
export const PROFILE_FIELD_LABELS=Object.freeze([
 ['fullName','姓名'],['phone','手机号'],['email','邮箱'],
 ['school','毕业院校'],['major','所学专业'],['education','最高学历'],
 ['degree','最高学位'],['enrollment','入学年月'],['graduation','毕业年月'],
 ['city','所在城市'],['skills','技能特长'],['experience','工作或实习经历'],
 ['projects','项目经历'],['summary','个人简介']
]);
export const EMPTY_PROFILE=Object.freeze(Object.fromEntries(PROFILE_FIELD_LABELS.map(([k])=>[k,''])));
const maxLengths={fullName:80,phone:40,email:160,school:180,major:150,education:50,
 degree:50,enrollment:20,graduation:20,city:100,skills:2000,experience:12000,projects:12000,summary:4000};
export function cleanProfile(input){
 const obj=input&&typeof input==='object'?input:{};
 const result={};
 for(const [key] of PROFILE_FIELD_LABELS){
  result[key]=(typeof obj[key]==='string'?obj[key].trim():'').slice(0,maxLengths[key]);
 }
 return result;
}
async function unzipDocXml(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<50||buffer.byteLength>MAX_ZIP)throw Error('文件大小不符合要求');
 const view=new DataView(buffer),bytes=new Uint8Array(buffer);
 // ZIP EOCD may be followed by a small archive comment.
 let eocd=-1;
 for(let i=buffer.byteLength-22;i>=Math.max(0,buffer.byteLength-65557);i--){
  if(read32(view,i)===0x06054b50){eocd=i;break}
 }
 if(eocd<0)throw Error('DOCX 文件尾部结构无效');
 const entries=read16(view,eocd+10),centralOffset=read32(view,eocd+16);
 if(entries<1||entries>1200||centralOffset>=eocd)throw Error('DOCX 文件目录不受支持');
 let offset=centralOffset,record=null;
 for(let i=0;i<entries;i++){
  if(offset+46>eocd||read32(view,offset)!==0x02014b50)throw Error('DOCX 目录损坏');
  const nameLen=read16(view,offset+28),extra=read16(view,offset+30),comment=read16(view,offset+32);
  if(offset+46+nameLen+extra+comment>eocd)throw Error('DOCX 目录越界');
  const name=dec.decode(bytes.subarray(offset+46,offset+46+nameLen));
  if(name==='word/document.xml'){
   record={method:read16(view,offset+10),flags:read16(view,offset+8),
    packed:read32(view,offset+20),unpacked:read32(view,offset+24),local:read32(view,offset+42)};
  }
  offset+=46+nameLen+extra+comment;
 }
 if(!record||record.flags&1||record.unpacked<10||record.unpacked>MAX_XML||
   record.packed<5||record.packed>MAX_ZIP)throw Error('无法安全提取 DOCX 文本');
 const p=record.local;
 if(p+30>buffer.byteLength||read32(view,p)!==0x04034b50)throw Error('DOCX 文件数据损坏');
 const start=p+30+read16(view,p+26)+read16(view,p+28);
 if(start+record.packed>buffer.byteLength)throw Error('DOCX 压缩内容越界');
 if(read16(view,p+8)!==record.method)throw Error('DOCX 压缩算法不匹配');
 const data=bytes.slice(start,start+record.packed);
 let output;
 if(record.method===0)output=data;
 else if(record.method===8){
  if(typeof DecompressionStream!=='function')throw Error('当前浏览器不支持 DOCX 本地解压');
  const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader=stream.getReader(),chunks=[];let size=0;
  try{
   while(true){
    const part=await reader.read();if(part.done)break;
    size+=part.value.byteLength;
    if(size>MAX_XML){await reader.cancel();throw Error('DOCX 解压内容超过安全限制')}
    chunks.push(part.value);
   }
  }finally{reader.releaseLock()}
  output=new Uint8Array(size);let at=0;
  for(const chunk of chunks){output.set(chunk,at);at+=chunk.length}
 }else throw Error('不支持此 DOCX 压缩方式');
 if(output.length!==record.unpacked)throw Error('DOCX 数据长度校验失败');
 return dec.decode(output);
}
const xmlChars=s=>s.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi,(raw,k)=>{
 if(k==='amp')return '&';if(k==='lt')return '<';if(k==='gt')return '>';
 if(k==='quot')return '"';if(k==='apos')return "'";
 if(k[0]==='#'){
  const n=k[1]?.toLowerCase()==='x'?parseInt(k.slice(2),16):parseInt(k.slice(1),10);
  return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';
 }
 return raw;
});
export function wordXmlToText(xml){
 if(typeof xml!=='string'||xml.length>MAX_XML||
  /<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(xml))throw Error('DOCX 含有不支持的 XML 声明');
 if(!/<w:document(?:\s|>)/.test(xml)||!/<w:body(?:\s|>)/.test(xml))throw Error('DOCX 不是有效正文');
 const paragraphs=[];
 const paragraphPattern=/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
 for(const p of xml.matchAll(paragraphPattern)){
  const bits=[];
  const tokens=/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/>/g;
  for(const token of p[1].matchAll(tokens)){
   bits.push(token[1]!==undefined?xmlChars(token[1]):' ');
  }
  const line=bits.join('').replace(/[\u0000-\u0008\u000b-\u001f]/g,'').trim();
  if(line)paragraphs.push(line);
  if(paragraphs.join('\n').length>MAX_TEXT)throw Error('简历文本超过本地提取上限');
 }
 if(!paragraphs.length)throw Error('DOCX 中未找到可复制文字');
 return paragraphs.join('\n');
}
export async function extractDocxText(buffer){
 return wordXmlToText(await unzipDocXml(buffer));
}
export function inferProfileFromText(text){
 if(typeof text!=='string'||!text.trim())return cleanProfile({});
 const lines=text.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
 const tagged=(re,max)=>lines.map(line=>re.exec(line)?.[1]?.trim()).find(Boolean)?.slice(0,max)||'';
 const result={
  fullName:tagged(/^(?:姓名|Name)\s*[：:]\s*(.{1,80})$/i,80),
  phone:tagged(/^(?:手机号码?|联系电话|手机)\s*[：:]\s*(1[3-9]\d{9})\b/,40),
  email:tagged(/^(?:电子邮箱|电子邮件|邮箱|E-?mail)\s*[：:]\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i,160),
  school:tagged(/^(?:毕业院校|毕业学校|就读院校|学校)\s*[：:]\s*(.{2,180})$/i,180),
  major:tagged(/^(?:所学专业|专业名称|专业)\s*[：:]\s*(.{1,150})$/i,150),
  education:tagged(/^(?:最高学历|学历)\s*[：:]\s*(本科|硕士(?:研究生)?|博士(?:研究生)?|大专|专科|高中|中专)/,50),
  degree:tagged(/^(?:最高学位|学位)\s*[：:]\s*(学士|硕士|博士)(?:学位)?/,50),
  enrollment:tagged(/^(?:入学年月|入学时间)\s*[：:]\s*(\d{4}[-/.年]\d{1,2})/,20),
  graduation:tagged(/^(?:毕业年月|毕业时间)\s*[：:]\s*(\d{4}[-/.年]\d{1,2})/,20),
  city:tagged(/^(?:现居城市|现居地|所在城市)\s*[：:]\s*(.{1,100})$/i,100)
 };
 // Never invent unlabeled biography, education or employment. Extract only
 // sections literally present in the uploaded document, for user review.
 const groups=[['skills',/^(?:专业技能|技能特长|个人技能)[:：]?$/],2000],
  ['experience',/^(?:工作经历|实习经历|工作实习经历)[:：]?$/],12000],
  ['projects',/^(?:项目经历|项目经验)[:：]?$/],12000],
  ['summary',/^(?:自我评价|个人简介|自我介绍)[:：]?$/],4000]];
 for(let i=0;i<lines.length;i++){
  for(const [key,heading,limit] of groups){
   if(!heading.test(lines[i]))continue;
   const values=[];
   for(let j=i+1;j<Math.min(lines.length,i+18);j++){
    if(/^(?:教育经历|个人信息|技能特长|专业技能|工作经历|实习经历|项目经历|项目经验|自我评价|个人简介|联系方式|兴趣爱好|获奖情况)[:：]?$/.test(lines[j]))break;
    values.push(lines[j]);
   }
   if(values.length)result[key]=values.join('\n').slice(0,limit);
  }
 }
 // Recognize standalone emails only; a phone number without a label could be
 // a sensitive identifier, so leave those for explicit manual verification.
 if(!result.email){
  const matches=text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)||[];
  if(matches.length===1)result.email=matches[0];
 }
 return cleanProfile(result);
}
