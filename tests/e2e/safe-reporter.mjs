import {mkdirSync,writeFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {redactCredentialText,sanitizeOwnedArtifact,sanitizeOwnedOutput} from './evidence-privacy.mjs';
import evidenceRoots from './evidence-root.cjs';
const {evidencePathContains,evidenceRootPath}=evidenceRoots;

function safeFailure(error){
 const details={};for(const key of ['message','stack','value','snippet'])if(error[key]!==undefined)details[key]=redactCredentialText(error[key]);
 if(error.location)details.location={...error.location,file:redactCredentialText(error.location.file)};
 return {text:details.stack??details.message??details.value??'Unspecified test error',details};
}

/** External Compose runs retain every outcome without printing session headers. */
export default class SafeReporter {
 outputRoots=[];sanitizeRoots=[];tests=[];globalErrors=[];pendingOut='';pendingError='';
 onBegin(config,suite){
  const workspace=config.metadata?.workspaceRoot??process.cwd();
  if(typeof workspace!=='string'||!isAbsolute(workspace))throw new Error('Reporter workspace must be an absolute folder');
  const outputs=[...new Set((config.projects??[]).map(p=>p.outputDir).filter(Boolean))].map(path=>evidenceRootPath(path,workspace));
  const selected=config.metadata?.evidenceRoot;
  if(selected!==undefined){
   if(typeof selected!=='string'||!isAbsolute(selected))throw new Error('Reporter evidence root must be an absolute run folder');
   const root=evidenceRootPath(selected,workspace);
   if(outputs.some(path=>!evidencePathContains(root,path)))throw new Error('Reporter outputs must stay inside the selected run folder');
   this.sanitizeRoots=[root];
  }else this.sanitizeRoots=outputs;
  this.outputRoots=outputs;this.tests=suite.allTests();console.log(`Collected ${this.tests.length} tests using ${config.workers} worker(s)`);
 }
 emit(chunk,error=false,flush=false){const field=error?'pendingError':'pendingOut';this[field]+=chunk?.toString()??'';const lines=this[field].split('\n');this[field]=flush?'':lines.pop();if(flush&&this[field])lines.push(this[field]);for(const line of lines)if(line)(error?process.stderr:process.stdout).write(redactCredentialText(line)+'\n');}
 onStdOut(chunk){this.emit(chunk);}
 onStdErr(chunk){this.emit(chunk,true);}
 onTestEnd(test,result){
  console.log(`${result.status} ${redactCredentialText(test.titlePath().filter(Boolean).join(' › '))} (${result.duration}ms)`);
  for(const error of result.errors??[]){const safe=safeFailure(error);console.error(safe.text);if(safe.details.snippet)console.error(safe.details.snippet);}
  for(const attachment of result.attachments??[])if(attachment.path)for(const root of this.outputRoots)sanitizeOwnedArtifact(attachment.path,root);
 }
 onError(error){const safe=safeFailure(error);this.globalErrors.push(safe);console.error(safe.text);}
 onEnd(result){
  this.emit('',false,true);this.emit('',true,true);
  const changed=this.sanitizeRoots.flatMap(root=>sanitizeOwnedOutput(root).map(path=>({root,path}))),counts={passed:0,failed:0,flaky:0,skipped:0,notRun:0,interrupted:0};
  const tests=this.tests.map(test=>{
   let outcome;if(!test.results.length)outcome='notRun';else if(test.results.every(r=>r.status==='skipped'))outcome='skipped';else if(test.results.some(r=>r.status==='interrupted'))outcome='interrupted';else outcome=test.outcome()==='expected'?'passed':test.outcome()==='flaky'?'flaky':'failed';counts[outcome]++;
   return {id:test.id,title:redactCredentialText(test.titlePath().filter(Boolean).join(' › ')),location:test.location,outcome,expectedStatus:test.expectedStatus,attempts:test.results.map(r=>({status:r.status,duration:r.duration,retry:r.retry,errors:(r.errors??[]).map(e=>safeFailure(e).text),errorDetails:(r.errors??[]).map(e=>safeFailure(e).details)}))};
  });
  const discoveryOnly=tests.length>0&&counts.notRun===tests.length&&result.status==='passed'&&!this.globalErrors.length;
  const summary={status:result.status,discoveryOnly,duration:result.duration,counts,globalErrors:this.globalErrors,sanitizedOwnedArtifacts:changed,tests};
  for(const root of this.outputRoots){mkdirSync(root,{recursive:true});writeFileSync(resolve(root,discoveryOnly?'discovery-summary.json':'run-summary.json'),JSON.stringify(summary,null,2)+'\n');}
  if(discoveryOnly){for(const t of tests)console.log(`collected ${t.location.file}:${t.location.line} ${t.title}`);console.log(`Total: ${tests.length} tests (discovery only; none executed)`);}
  console.log(JSON.stringify({status:result.status,counts,globalErrors:this.globalErrors.length}));
  // Returning no status override preserves Playwright's original failure exit code.
 }
}
