// Conservative, dependency-free PDF/DOCX container checks.
// This is NOT a malware scanner. Files remain private and are served only
// as attachments (never executed/inline-previewed). A dedicated AV scanner
// is required before sharing files with employers or other processors.
export const RESUME_LIMIT_BYTES=3*1024*1024;
export const RESUME_MAX_PER_ACCOUNT=3;
export const STORAGE_CONSENT_VERSION='private-resume-storage-v1';
export const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class ResumeValidationError extends Error {
 constructor(code){super(code);this.name='ResumeValidationError';this.code=code;}
}
const reject=code=>{throw new ResumeValidationError(code);};
export function normalizeResumeName(encoded){
 if(typeof encoded!=='string'||encoded.length<5||encoded.length>600)return reject('INVALID_FILENAME');
 let name;
 try{name=decodeURIComponent(encoded).normalize('NFC').trim();}
 catch{return reject('INVALID_FILENAME');}
 if(name.length>120||name.startsWith('.')||name.endsWith('.')||name.includes('..')||
    /[/\\\u0000-\u001f\u007f]/.test(name)||!/^[^/\\]{1,115}\.(pdf|docx)$/i.test(name))
    return reject('INVALID_FILENAME');
 return name;
}
function checkDocx(bytes){
 if(bytes.length<100)return reject('INVALID_DOCX_CONTAINER');
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=bytes.length;
 const u16=i=>dv.getUint16(i,true),u32=i=>dv.getUint32(i,true);
 if(u32(0)!==0x04034b50)return reject('INVALID_DOCX_CONTAINER');
 let eocd=-1;
 for(let i=n-22;i>=Math.max(0,n-22-65535);i--){
  if(u32(i)===0x06054b50&&i+22+u16(i+20)===n){eocd=i;break;}
 }
 if(eocd<0)return reject('INVALID_DOCX_CONTAINER');
 const count=u16(eocd+10),length=u32(eocd+12),start=u32(eocd+16);
 if(!count||count>400||count!==u16(eocd+8)||u16(eocd+4)!==0||
    u16(eocd+6)!==0||start===0xffffffff||length===0xffffffff||
    start+length>eocd)return reject('INVALID_DOCX_CONTAINER');
 let pos=start,expanded=0,hasTypes=false,hasDocument=false;
 const found=new Set(),decoder=new TextDecoder('utf-8',{fatal:true});
 for(let i=0;i<count;i++){
  if(pos+46>n||u32(pos)!==0x02014b50)return reject('INVALID_DOCX_CONTAINER');
  const flags=u16(pos+8),method=u16(pos+10);
  const compressed=u32(pos+20),uncompressed=u32(pos+24);
  const nameLength=u16(pos+28),extraLength=u16(pos+30),commentLength=u16(pos+32);
  const localOffset=u32(pos+42),end=pos+46+nameLength+extraLength+commentLength;
  if(end>n||nameLength<1||localOffset+4>n||u32(localOffset)!==0x04034b50||
     (flags&1)||(flags&0x20)||![0,8].includes(method)||
     compressed===0xffffffff||uncompressed===0xffffffff)
    return reject('INVALID_DOCX_CONTAINER');
  let name;
  try{name=decoder.decode(bytes.subarray(pos+46,pos+46+nameLength));}
  catch{return reject('INVALID_DOCX_CONTAINER');}
  const lower=name.toLowerCase();
  if(name.startsWith('/')||name.includes('\\')||name.includes('../')||
     name.includes('/..')||name.includes('\u0000')||found.has(lower)||
     /(^|\/)(vbaproject\.bin|activex|embeddings|macros)(\/|$)/i.test(name)||
     /\.(exe|dll|js|vbs|hta|ps1|bat|cmd|scr)$/i.test(name))
    return reject('UNSAFE_DOCX_CONTENT');
  found.add(lower);
  if(name==='[Content_Types].xml')hasTypes=true;
  if(name==='word/document.xml')hasDocument=true;
  expanded+=uncompressed;
  if(expanded>24*1024*1024)return reject('DOCX_EXPANSION_LIMIT');
  pos=end;
 }
 if(pos!==start+length||!hasTypes||!hasDocument)return reject('INVALID_DOCX_CONTAINER');
}
export function validateResumeBytes(bytes,filename){
 if(!(bytes instanceof Uint8Array)||bytes.length<30||bytes.length>RESUME_LIMIT_BYTES)
  return reject('INVALID_RESUME_SIZE');
 const isPdf=/\.pdf$/i.test(filename),isDocx=/\.docx$/i.test(filename);
 if(!isPdf&&!isDocx)return reject('INVALID_FILENAME');
 if(isPdf){
  const first=new TextDecoder().decode(bytes.subarray(0,8));
  const last=new TextDecoder().decode(bytes.subarray(Math.max(0,bytes.length-1024)));
  if(!first.startsWith('%PDF-')||!last.includes('%%EOF'))return reject('INVALID_PDF_CONTAINER');
 }else checkDocx(bytes);
 return {mime:isPdf?'application/pdf':DOCX_MIME,ext:isPdf?'pdf':'docx',size:bytes.length};
}
