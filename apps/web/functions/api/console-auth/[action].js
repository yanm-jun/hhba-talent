import {handleConsoleAuth} from '../../_lib/console-password.js';
export async function onRequest(context){
 const action=String(context.params?.action||'');
 return handleConsoleAuth(context,action);
}
