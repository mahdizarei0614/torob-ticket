import {lstatSync,readFileSync,readdirSync,realpathSync,writeFileSync} from 'node:fs';
import {extname,relative,resolve,sep} from 'node:path';

/** Keep failure facts while removing credential headers emitted by request diagnostics. */
export function redactCredentialText(value){
 return String(value).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g,'')
  .replace(/\b((?:cookie|set-cookie|authorization|proxy-authorization)["']?\s*:\s*)("[^"\r\n]*"|'[^'\r\n]*'|[^\r\n]+)/gi,(_all,prefix,secret)=>prefix+(/["']/.test(secret[0])?secret[0]+'[REDACTED]'+secret[0]:'[REDACTED]'))
  .replace(/(\btorob_demo\s*=\s*)[^;\s"'<>`]+/g,'$1[REDACTED]');
}
const sensitiveKey=/^(?:cookie|set-cookie|authorization|proxy-authorization)$/i;
function redactJson(value){
 if(typeof value==='string')return redactCredentialText(value);
 if(Array.isArray(value))return value.map(redactJson);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,sensitiveKey.test(key)?'[REDACTED]':redactJson(v)]));
 return value;
}

/** Never follow an artifact symlink or modify a file outside the selected output root. */
export function sanitizeOwnedArtifact(path,outputRoot){
 let file,root;
 try{if(lstatSync(path).isSymbolicLink()||!lstatSync(path).isFile())return false;file=realpathSync(path);root=realpathSync(outputRoot);}catch{return false;}
 const within=relative(root,file);if(!within||within==='..'||within.startsWith('..'+sep)||resolve(root,within)!==file)return false;
 if(!['.md','.txt','.log','.json','.html','.yaml','.yml'].includes(extname(file)))return false;
 const before=readFileSync(file,'utf8');let after;
 if(extname(file)==='.json'){
  try{const parsed=JSON.parse(before),safe=redactJson(parsed);after=JSON.stringify(parsed)===JSON.stringify(safe)?before:JSON.stringify(safe,null,2)+'\n';}catch{after=redactCredentialText(before);}
 }else after=redactCredentialText(before);
 if(after===before)return false;writeFileSync(file,after);return true;
}
export function sanitizeOwnedOutput(outputRoot){
 const changed=[];const walk=folder=>{for(const entry of readdirSync(folder,{withFileTypes:true})){const path=resolve(folder,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile()&&sanitizeOwnedArtifact(path,outputRoot))changed.push(relative(outputRoot,path));}};
 try{walk(realpathSync(outputRoot));}catch(error){if(error.code!=='ENOENT')throw error;}
 return changed;
}
