import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {test} from 'node:test';
import {redactCredentialText,sanitizeOwnedArtifact,sanitizeOwnedOutput} from './evidence-privacy.mjs';
import SafeReporter from './safe-reporter.mjs';
test('headers and standalone session values are removed while request/failure facts remain',()=>{
 const text='Error: timeout\n - POST /api/v1/demo/reset\n - cookie: torob_demo=example-sensitive-value\n - authorization: Bearer example-authorization\nstatus=500\nURL fragment torob_demo=example-second;';const safe=redactCredentialText(text);
 assert.ok(!safe.includes('example-sensitive-value'));assert.ok(!safe.includes('example-authorization'));assert.ok(!safe.includes('example-second'));assert.match(safe,/timeout/);assert.match(safe,/POST \/api\/v1\/demo\/reset/);assert.match(safe,/status=500/);
});
test('only owned text artifacts are sanitized; binary and symlink targets stay intact',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'t30-privacy-')),outside=mkdtempSync(resolve(tmpdir(),'t30-outside-'));
 try{const md=resolve(root,'error-context.md'),json=resolve(root,'details.json'),external=resolve(outside,'external.md'),binary=resolve(root,'pixel.png');writeFileSync(md,'cookie: torob_demo=example-sensitive-value\nTimeout');writeFileSync(json,JSON.stringify({headers:{Cookie:'example-sensitive-value'},status:500}));writeFileSync(external,'cookie: outside-sensitive-value');writeFileSync(binary,Buffer.from([0,1,2,3]));symlinkSync(external,resolve(root,'escape.md'));mkdirSync(resolve(root,'nested'));symlinkSync(outside,resolve(root,'nested','escape'));
  assert.equal(sanitizeOwnedArtifact(external,root),false);assert.equal(sanitizeOwnedArtifact(resolve(root,'escape.md'),root),false);const changed=sanitizeOwnedOutput(root);assert.equal(changed.length,2);assert.ok(!readFileSync(md,'utf8').includes('example-sensitive-value'));assert.equal(JSON.parse(readFileSync(json,'utf8')).status,500);assert.equal(JSON.parse(readFileSync(json,'utf8')).headers.Cookie,'[REDACTED]');assert.equal(readFileSync(external,'utf8'),'cookie: outside-sensitive-value');assert.deepEqual([...readFileSync(binary)],[0,1,2,3]);
 }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
test('reporting keeps failures, skips, global errors and not-run cases distinct with no status override',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'t30-reporter-')),reporter=new SafeReporter(),log=console.log,error=console.error;
 try{console.log=()=>undefined;console.error=()=>undefined;const make=(id,status)=>({id,titlePath:()=>['suite',id],location:{file:'acceptance.spec.ts',line:1,column:1},expectedStatus:'passed',results:status?[{status,duration:1,retry:0,errors:status==='failed'?[{message:'request failed\ncookie: torob_demo=example-sensitive-value'}]:[]}]:[],outcome:()=>status==='passed'?'expected':'unexpected'});const cases=[make('success','passed'),make('failure','failed'),make('skip','skipped'),make('unrun',null)];reporter.onBegin({workers:1,projects:[{outputDir:root}]},{allTests:()=>cases});for(const t of cases)if(t.results.length)reporter.onTestEnd(t,t.results[0]);reporter.onError({message:'setup failed\nCookie: torob_demo=example-sensitive-value'});assert.equal(reporter.onEnd({status:'failed',duration:5}),undefined);const raw=readFileSync(resolve(root,'run-summary.json'),'utf8'),r=JSON.parse(raw);assert.ok(!raw.includes('example-sensitive-value'));assert.equal(r.status,'failed');assert.deepEqual(r.counts,{passed:1,failed:1,flaky:0,skipped:1,notRun:1,interrupted:0});assert.equal(r.globalErrors.length,1);assert.match(r.tests[1].attempts[0].errors[0],/request failed/);
 }finally{console.log=log;console.error=error;rmSync(root,{recursive:true,force:true});}
});
test('primitive failures and their source locations/snippets remain diagnosable after redaction',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'t30-primitive-')),reporter=new SafeReporter(),log=console.log,error=console.error;
 try{console.log=()=>undefined;console.error=()=>undefined;const failure={value:'primitive failure',snippet:'request failed\nCookie: torob_demo=example-sensitive-value',location:{file:'acceptance.spec.ts',line:8,column:2}};const t={id:'primitive',titlePath:()=>['primitive'],location:failure.location,expectedStatus:'passed',results:[{status:'failed',duration:1,retry:0,errors:[failure]}],outcome:()=> 'unexpected'};reporter.onBegin({workers:1,projects:[{outputDir:root}]},{allTests:()=>[t]});reporter.onTestEnd(t,t.results[0]);reporter.onEnd({status:'failed',duration:1});const r=JSON.parse(readFileSync(resolve(root,'run-summary.json'),'utf8'));assert.equal(r.tests[0].attempts[0].errors[0],'primitive failure');const details=r.tests[0].attempts[0].errorDetails[0];assert.deepEqual(details.location,failure.location);assert.match(details.snippet,/request failed/);assert.ok(!details.snippet.includes('example-sensitive-value'));assert.equal(r.counts.failed,1);
 }finally{console.log=log;console.error=error;rmSync(root,{recursive:true,force:true});}
});
test('captured run ownership covers feature siblings without touching adjacent, escaped or binary evidence',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'t30-full-evidence-')),outside=mkdtempSync(resolve(tmpdir(),'t30-adjacent-'));
 const reporter=new SafeReporter(),log=console.log,error=console.error,previous=process.env.E2E_EVIDENCE_DIR;
 try{
  console.log=()=>undefined;console.error=()=>undefined;
  const artifacts=resolve(root,'artifacts'),feature=resolve(root,'feature'),external=resolve(outside,'external.json'),pixel=resolve(root,'pixel.png');mkdirSync(artifacts);mkdirSync(feature);
  const original=JSON.stringify({status:'failed',error:{message:'original timeout',value:'original primitive',location:{file:'example.spec.ts',line:7}},headers:{Cookie:'example-private-cookie'}});
  writeFileSync(resolve(feature,'failure.json'),original);writeFileSync(resolve(artifacts,'error.txt'),'Cookie: example-private-cookie\noriginal timeout');writeFileSync(external,original);writeFileSync(pixel,Buffer.from([0,1,2,3]));symlinkSync(outside,resolve(root,'escape'));
  reporter.onBegin({workers:1,metadata:{evidenceRoot:root},projects:[{outputDir:artifacts}]},{allTests:()=>[]});
  process.env.E2E_EVIDENCE_DIR=outside;
  assert.equal(reporter.onEnd({status:'failed',duration:1}),undefined);
  const saved=JSON.parse(readFileSync(resolve(feature,'failure.json'),'utf8'));assert.equal(saved.status,'failed');assert.equal(saved.error.message,'original timeout');assert.equal(saved.error.value,'original primitive');assert.equal(saved.error.location.line,7);assert.equal(saved.headers.Cookie,'[REDACTED]');
  assert.equal(readFileSync(external,'utf8'),original);assert.deepEqual([...readFileSync(pixel)],[0,1,2,3]);
  const summary=JSON.parse(readFileSync(resolve(artifacts,'run-summary.json'),'utf8'));assert.equal(summary.status,'failed');assert.ok(summary.sanitizedOwnedArtifacts.some(item=>item.path==='feature/failure.json'));assert.ok(summary.sanitizedOwnedArtifacts.some(item=>item.path==='artifacts/error.txt'));
  assert.throws(()=>new SafeReporter().onBegin({workers:1,metadata:{evidenceRoot:root},projects:[{outputDir:outside}]},{allTests:()=>[]}),/inside the selected run/);
  assert.throws(()=>new SafeReporter().onBegin({workers:1,metadata:{evidenceRoot:'/'},projects:[{outputDir:artifacts}]},{allTests:()=>[]}),/specific run folder/);
  assert.throws(()=>new SafeReporter().onBegin({workers:1,projects:[{outputDir:'/'}]},{allTests:()=>[]}),/specific run folder/);
 }finally{
  if(previous===undefined)delete process.env.E2E_EVIDENCE_DIR;else process.env.E2E_EVIDENCE_DIR=previous;
  console.log=log;console.error=error;rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});
 }
});
