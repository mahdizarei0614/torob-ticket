import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,realpathSync,rmSync,symlinkSync} from 'node:fs';
import {homedir,tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {after,test} from 'node:test';
const repo=fileURLToPath(new URL('../../',import.meta.url)),evidence=realpathSync(mkdtempSync(resolve(tmpdir(),'torobticket-t30-config-')));
const config=pathToFileURL(resolve(repo,'tests/e2e/playwright.config.ts')).href;
function load(patch={}){
 const env={...process.env};for(const key of Object.keys(env))if(/EVIDENCE_DIR$/.test(key)||['E2E_BASE_URL','E2E_DEV_SERVERS','GRAPHICS_E2E_PORT','ADMIN_E2E_URL','TOROBTICKET_PORT'].includes(key))delete env[key];
 Object.assign(env,{E2E_EVIDENCE_DIR:evidence},patch);
 const code=`import config from ${JSON.stringify(config)};console.log(JSON.stringify({origin:config.use.baseURL,servers:config.webServer??null,workers:config.workers,parallel:config.fullyParallel,trace:config.use.trace,output:config.outputDir,metadata:config.metadata,environment:Object.fromEntries(Object.entries(process.env).filter(([key])=>/EVIDENCE_DIR$/.test(key)||['E2E_BASE_URL','ADMIN_E2E_URL'].includes(key)))}));`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:repo,env,encoding:'utf8'});return {...result,value:result.status===0?JSON.parse(result.stdout.trim()):null};
}
after(()=>rmSync(evidence,{recursive:true,force:true}));
test('default Nx browser configuration consumes the existing Compose origin with one secret-free worker',()=>{
 const r=load();assert.equal(r.status,0,r.stderr);assert.equal(r.value.origin,'http://127.0.0.1:4300');assert.equal(r.value.servers,null);assert.equal(r.value.workers,1);assert.equal(r.value.parallel,false);assert.equal(r.value.trace,'off');assert.equal(r.value.environment.ADMIN_E2E_URL,r.value.origin);
});
test('custom Compose ports and every literal feature evidence variable stay within the selected run',()=>{
 const r=load({TOROBTICKET_PORT:'4329',ADMIN_E2E_URL:'http://127.0.0.1:4300',PARTICLE_BLOOM_EVIDENCE_DIR:'/private/tmp/old-artifacts'});assert.equal(r.status,0,r.stderr);assert.equal(r.value.origin,'http://127.0.0.1:4329');assert.equal(r.value.environment.E2E_BASE_URL,r.value.origin);assert.equal(r.value.environment.ADMIN_E2E_URL,r.value.origin);
 const keys=new Set();const collect=folder=>{for(const entry of readdirSync(folder,{withFileTypes:true})){const p=resolve(folder,entry.name);if(entry.isDirectory())collect(p);else if(/\.[cm]?tsx?$/.test(entry.name))for(const match of readFileSync(p,'utf8').matchAll(/\bprocess\.env\.([A-Z][A-Z0-9_]*EVIDENCE_DIR)\b/g))keys.add(match[1]);}};collect(resolve(repo,'tests/e2e/src'));
 keys.delete('E2E_EVIDENCE_DIR');for(const key of keys)assert.ok(r.value.environment[key]?.startsWith(evidence+'/'),key);
 assert.equal(r.value.environment.E2E_EVIDENCE_DIR,evidence);assert.equal(r.value.output,resolve(evidence,'artifacts'));
});
test('invalid or ambiguous origins cannot start unintended servers or attach to another origin',()=>{
 for(const E2E_BASE_URL of ['https://example.com:4329','http://user:pass@127.0.0.1:4329','http://localhost:4329/path','http://localhost:4329/?x=1','http://localhost:80','http://localhost:4329/#x'])assert.notEqual(load({E2E_BASE_URL}).status,0,E2E_BASE_URL);
 assert.notEqual(load({E2E_BASE_URL:'http://127.0.0.1:4329',GRAPHICS_E2E_PORT:'4317'}).status,0);assert.notEqual(load({E2E_DEV_SERVERS:'1',E2E_BASE_URL:'http://127.0.0.1:4329'}).status,0);assert.notEqual(load({E2E_DEV_SERVERS:'1',GRAPHICS_E2E_PORT:'4317'}).status,0);
});
test('explicit graphics and legacy development modes retain their own server ownership',()=>{
 const lab=load({GRAPHICS_E2E_PORT:'4317'});assert.equal(lab.status,0,lab.stderr);assert.equal(lab.value.servers.length,1);assert.equal(lab.value.origin,'http://127.0.0.1:4317');
 const dev=load({E2E_DEV_SERVERS:'1'});assert.equal(dev.status,0,dev.stderr);assert.equal(dev.value.servers.length,3);assert.equal(dev.value.origin,'http://127.0.0.1:4300');
});
test('evidence roots reject broad trees and canonical symlink aliases while allowing a new owned child',()=>{
 for(const path of ['/',repo,resolve(repo,'..'),homedir(),tmpdir(),'/tmp',resolve(repo,'docs/evidence'),resolve(repo,'docs/evidence/T30')])assert.notEqual(load({E2E_EVIDENCE_DIR:path}).status,0);
 const alias=resolve(evidence,'repo-alias');symlinkSync(repo,alias,'dir');assert.notEqual(load({E2E_EVIDENCE_DIR:alias}).status,0);
 const child=resolve(evidence,'new-owned-run'),accepted=load({E2E_EVIDENCE_DIR:child});assert.equal(accepted.status,0,accepted.stderr);assert.equal(accepted.value.metadata.evidenceRoot,realpathSync(child));assert.equal(accepted.value.output,resolve(realpathSync(child),'artifacts'));
});
test('the actual Playwright loader discovers tests with the same CommonJS config path used by Nx',()=>{
 const env={...process.env,E2E_BASE_URL:'http://127.0.0.1:4300',E2E_EVIDENCE_DIR:evidence};delete env.E2E_DEV_SERVERS;delete env.GRAPHICS_E2E_PORT;
 const run=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','tests/e2e/playwright.config.ts','tests/e2e/src/foundation.spec.ts','--list'],{cwd:repo,env,encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/foundation\.spec\.ts/);assert.match(run.stdout,/Total:/);
});
