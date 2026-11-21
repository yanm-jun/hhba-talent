import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {editOriginalDocxStrict} from '../src/services/resumeDocxPreserve.mjs';
const OLD='负责门店运营及日常数据整理工作';
const NEW='负责门店运营及业务数据整理';
const original=new Uint8Array(readFileSync('public/__hhba_word_qa.docx'));
const edited=await editOriginalDocxStrict(original,[{original:OLD,text:NEW}],{allowExpansion:true});
writeFileSync('public/__hhba_word_qa_saved.docx',edited);
const digest=b=>createHash('sha256').update(b).digest('hex');
writeFileSync('/tmp/hhba-word-react-fixture-hashes.json',JSON.stringify({
 original:digest(original),saved:digest(edited),originalText:OLD,savedText:NEW
}));
console.log('HHBA_WORD_REACT_QA_FIXTURE',JSON.stringify({size:original.length,editedSize:edited.length}));
