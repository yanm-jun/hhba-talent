// Editable Office Open XML export using the same reviewed ResumeDocument as A4 PDF.
// Dependency-free ZIP (stored entries, CRC-32) keeps resume text on the device.
import type {ResumeDocument} from './resumeDocument';

const encoder=new TextEncoder();
const MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const xmlEscape=(input:string)=>input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'')
 .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
 .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function run(text:string,bold=false):string{
 const lines=text.split(/\r?\n/);
 const bits=lines.map((line,i)=>(i?'<w:br/>':'')+'<w:t xml:space="preserve">'+xmlEscape(line)+'</w:t>').join('');
 return '<w:r>'+(bold?'<w:rPr><w:b/></w:rPr>':'')+bits+'</w:r>';
}
function para(text:string,style?:string,bold=false):string{
 const styleTag=style?'<w:pPr><w:pStyle w:val="'+style+'"/></w:pPr>':'';
 return '<w:p>'+styleTag+run(text,bold)+'</w:p>';
}
function documentXml(doc:ResumeDocument):string{
 const lines:string[]=[];
 const addSection=(name:string)=>lines.push(para(name,'Heading1',true));
 lines.push(para(doc.details.fullName,'Title',true));
 if(doc.details.headline)lines.push(para(doc.details.headline,'Subtitle'));
 const contact=[doc.details.phone,doc.details.email,doc.details.location].filter(Boolean).join('  ·  ');
 if(contact)lines.push(para(contact,'Contact'));
 if(doc.details.summary){addSection('职业概述');lines.push(para(doc.details.summary));}
 if(doc.experiences.length){
  addSection('工作经历');
  for(const item of doc.experiences){
   lines.push(para([item.title,item.organization,item.period].filter(Boolean).join('  ·  '),'Experience',true));
   lines.push(para(item.details));
  }
 }
 if(doc.education.length){addSection('教育背景');for(const item of doc.education)lines.push(para(item));}
 if(doc.skills.length){
  addSection('专业技能');
  for(const item of doc.skills){
   if(item.name)lines.push(para(item.name,'Experience',true));
   lines.push(para(item.details));
  }
 }
 if(doc.sourceParagraphs.length){
  addSection('简历原始内容（请检查并整理）');
  for(const value of doc.sourceParagraphs)lines.push(para(value));
 }
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  +'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
  +'<w:body>'+lines.join('')+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
  +'<w:pgMar w:top="794" w:right="737" w:bottom="794" w:left="737"/></w:sectPr>'
  +'</w:body></w:document>';
}
const stylesXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 +'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
 +'<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Microsoft YaHei" w:hAnsi="Arial"/>'
 +'<w:sz w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults>'
 +'<w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/>'
 +'<w:pPr><w:spacing w:after="110" w:line="320" w:lineRule="auto"/></w:pPr></w:style>'
 +'<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>'
 +'<w:pPr><w:spacing w:after="140"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'
 +'<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/>'
 +'<w:rPr><w:color w:val="526178"/></w:rPr></w:style>'
 +'<w:style w:type="paragraph" w:styleId="Contact"><w:name w:val="Contact"/>'
 +'<w:rPr><w:color w:val="53647A"/><w:sz w:val="19"/></w:rPr></w:style>'
 +'<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>'
 +'<w:pPr><w:spacing w:before="260" w:after="110"/></w:pPr>'
 +'<w:rPr><w:b/><w:color w:val="27344B"/><w:sz w:val="24"/></w:rPr></w:style>'
 +'<w:style w:type="paragraph" w:styleId="Experience"><w:name w:val="Experience"/>'
 +'<w:rPr><w:b/><w:color w:val="24334B"/></w:rPr></w:style></w:styles>';
const typesXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
 +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
 +'<Default Extension="xml" ContentType="application/xml"/>'
 +'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
 +'<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
 +'</Types>';
const relsXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
 +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
 +'</Relationships>';
const documentRelsXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
 +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
 +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
 +'</Relationships>';
function crc32(data:Uint8Array):number{
 let crc=0xFFFFFFFF;
 for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xEDB88320:0);}
 return (crc^0xFFFFFFFF)>>>0;
}
function header(size:number):DataView{return new DataView(new ArrayBuffer(size));}
function write16(view:DataView,offset:number,value:number){view.setUint16(offset,value,true)}
function write32(view:DataView,offset:number,value:number){view.setUint32(offset,value,true)}
function zipStored(entries:readonly {name:string;content:string}[]):Uint8Array{
 const chunks:Uint8Array[]=[];const centers:Uint8Array[]=[];let offset=0;
 for(const entry of entries){
  const filename=encoder.encode(entry.name),data=encoder.encode(entry.content);
  const crc=crc32(data);
  const local=header(30+filename.length);
  write32(local,0,0x04034b50);write16(local,4,20);write16(local,6,0x0800);
  write32(local,14,crc);write32(local,18,data.length);write32(local,22,data.length);
  write16(local,26,filename.length);
  const localBytes=new Uint8Array(local.buffer);localBytes.set(filename,30);
  chunks.push(localBytes,data);
  const central=header(46+filename.length);
  write32(central,0,0x02014b50);write16(central,4,20);write16(central,6,20);
  write16(central,8,0x0800);
  write32(central,16,crc);write32(central,20,data.length);write32(central,24,data.length);
  write16(central,28,filename.length);write32(central,42,offset);
  const centralBytes=new Uint8Array(central.buffer);centralBytes.set(filename,46);
  centers.push(centralBytes);offset+=localBytes.length+data.length;
 }
 const centralSize=centers.reduce((n,chunk)=>n+chunk.length,0);
 const end=header(22);write32(end,0,0x06054b50);
 write16(end,8,entries.length);write16(end,10,entries.length);
 write32(end,12,centralSize);write32(end,16,offset);
 const result=new Uint8Array(offset+centralSize+22);let at=0;
 for(const chunk of [...chunks,...centers,new Uint8Array(end.buffer)]){
  result.set(chunk,at);at+=chunk.length;
 }
 return result;
}
export function createResumeDocx(doc:ResumeDocument):Uint8Array{
 return zipStored([
  {name:'[Content_Types].xml',content:typesXml},
  {name:'_rels/.rels',content:relsXml},
  {name:'word/document.xml',content:documentXml(doc)},
  {name:'word/styles.xml',content:stylesXml},
  {name:'word/_rels/document.xml.rels',content:documentRelsXml}
 ]);
}
export function downloadResumeDocx(doc:ResumeDocument,jobTitle:string):void{
 const bytes=createResumeDocx(doc);
 const body=new Uint8Array(bytes.length);body.set(bytes);
 const blob=new Blob([body],{type:MIME});
 const safeName=(doc.details.fullName+'-'+jobTitle).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'').trim().slice(0,72)||'HHBA-岗位简历';
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=safeName+'.docx';document.body.appendChild(link);
 try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
}
