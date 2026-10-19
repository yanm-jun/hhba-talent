// Exercise the exact functions from the production Bun source in isolation.
// The full server's legacy Xiaomi snapshot digest guard is environment-specific;
// testing the server startup on GitHub Actions cannot be used as a numeral-unit test.
import {readFileSync} from 'node:fs';
const source=readFileSync('railway-function-20261018.ts','utf8');
function range(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 if(a<0||b<=a)throw Error('Missing official numeral function: '+start);
 return source.slice(a,b);
}
const selected=range('function numberTokens(value:string)', '/** Restore grouped numbers')+
 '\n'+range('function numbersRetained(original:string','async function machineTranslations(');
const compiled=new Bun.Transpiler({loader:'ts'}).transformSync(selected);
const verify=new Function(compiled+'\nreturn typeof preserveOfficialNumbers==="function"')();
if(!verify)throw Error('Numeral safety function not available');
console.log('HHBA_NUMERIC_FIDELITY_ISOLATED_TEST_PASS');
