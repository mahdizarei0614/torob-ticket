import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=mkdtempSync(join(tmpdir(),'torobticket-fixture-assets-'));
try{
  for(const file of ['package.json','nx.json','tsconfig.base.json','pnpm-lock.yaml'])copyFileSync(file,join(root,file));
  symlinkSync(resolve('node_modules'),join(root,'node_modules'),'dir');
  mkdirSync(join(root,'libs/fixtures/src'),{recursive:true});mkdirSync(join(root,'assets/geography'),{recursive:true});
  const original=JSON.parse(readFileSync('libs/fixtures/project.json','utf8'));
  const project={...original,targets:{test:{...original.targets.test,dependsOn:[],outputs:[],options:{command:'node libs/fixtures/probe.mjs'}}}};
  writeFileSync(join(root,'libs/fixtures/project.json'),JSON.stringify(project));
  writeFileSync(join(root,'libs/fixtures/src/index.ts'),'export {};');
  writeFileSync(join(root,'libs/fixtures/probe.mjs'),"import {appendFileSync} from 'node:fs';appendFileSync('runs','run\\n');");
  const asset=join(root,'assets/geography/probe.geojson');writeFileSync(asset,'version-1');
  function run(){const result=spawnSync(process.execPath,[resolve('node_modules/nx/dist/bin/nx.js'),'test','fixtures','--output-style=static'],{cwd:root,env:{...process.env,NX_DAEMON:'false',NX_ISOLATE_PLUGINS:'false',NX_TUI:'false',NX_CACHE_DIRECTORY:join(root,'.nx/cache'),NX_WORKSPACE_DATA_DIRECTORY:join(root,'.nx/workspace-data')},encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);}
  run();run();assert.equal(readFileSync(join(root,'runs'),'utf8').trim().split('\n').length,1);
  writeFileSync(asset,'version-2');run();assert.equal(readFileSync(join(root,'runs'),'utf8').trim().split('\n').length,2,'Fixture geography tests must rerun when geography changes');
  console.log('PASS fixture test cache: unchanged assets hit cache; changed geography reruns owning tests.');
}finally{rmSync(root,{recursive:true,force:true});}
