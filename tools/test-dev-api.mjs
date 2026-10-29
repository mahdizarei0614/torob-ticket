import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, unlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

for (const polling of [false,true]) test(`API source, shared alias and atomic replacement edits reload with ${polling?'polling':'parent-directory events'}; type errors preserve the last server`, { timeout: 30000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'torobticket-api-watch-'));
  let output = '';
  let child;
  const waiters = new Set();
  function waitFor(value, start = 0) {
    if (output.slice(start).includes(value)) return Promise.resolve();
    return new Promise((done, reject) => {
      const check = () => { if (output.slice(start).includes(value)) { clearTimeout(timeout); waiters.delete(check); done(); } };
      const timeout = setTimeout(() => { waiters.delete(check); reject(new Error(`Timed out waiting for ${value}\n${output}`)); }, 12000);
      waiters.add(check);
    });
  }
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await new Promise(done => child.once('exit', done));
    }
    await rm(root, { recursive: true, force: true });
  });
  const shared = join(root, 'shared.ts');
  const main = join(root, 'main.ts');
  await writeFile(shared, 'export const value: number = 1;\n');
  await writeFile(main, 'import { value } from "@watch/shared"; console.log("API_VALUE_" + value); setInterval(() => console.log("ALIVE_" + value), 200);\n');
  const config = { compilerOptions: { target: 'ES2022', module: 'CommonJS', moduleResolution: 'Node', types: [], lib: ['ES2022', 'DOM'], rootDir: '.', baseUrl: '.', paths: { '@watch/shared': ['./shared.ts'] }, skipLibCheck: true }, include: ['*.ts'] };
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify(config));
  child = spawn(process.execPath, [resolve('tools/dev-api.mjs'), join(root, 'tsconfig.json'), join(root, 'output'), 'main.js'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TOROBTICKET_DEV_POLLING: String(polling) } });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { output += bytes; for (const waiter of [...waiters]) waiter(); });
  await waitFor('API_VALUE_1');
  const first = output.length;
  await writeFile(shared, 'export const value: number = 2;\n');
  await waitFor('API_VALUE_2', first);
  const second = output.length;
  await writeFile(shared, 'export const value: number = "invalid";\n');
  await waitFor('API compilation failed; keeping the last successful server.', second);
  assert.equal(output.slice(second).includes('API compilation complete; starting server.'), false);
  await waitFor('ALIVE_2', output.length);
  assert.equal(child.exitCode, null);
  const broken = output.length;
  await writeFile(shared, 'export const value: number = 3;\n');
  await waitFor('API_VALUE_3', broken);
  const third = output.length;
  await writeFile(main, 'import { value } from "@watch/shared"; console.log("SOURCE_EDIT_" + value); setInterval(() => undefined, 1000);\n');
  await waitFor('SOURCE_EDIT_3', third);
  const fourth = output.length;
  const alternate = join(root, 'alternate.ts');
  await writeFile(alternate, 'export const value: number = 7;\n');
  config.compilerOptions.paths['@watch/shared'] = ['./alternate.ts'];
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify(config));
  await waitFor('SOURCE_EDIT_7', fourth);
  const fifth = output.length;
  await unlink(alternate);
  await waitFor('API compilation failed; keeping the last successful server.', fifth);
  const deleted = output.length;
  await writeFile(alternate, 'export const value: number = 8;\n');
  await waitFor('SOURCE_EDIT_8', deleted);
  // Editor save-by-replacement changes the inode. Follow two successive saves
  // and a restoration, rather than retaining a watcher on the retired inode.
  for(const value of [9,10,8]){
    const before=output.length;
    await writeFile(alternate+'.saving', `export const value: number = ${value};\n`);
    await rename(alternate+'.saving',alternate);
    await waitFor(`SOURCE_EDIT_${value}`,before);
  }
  // TS2307 during the intentional deletion is expected; a successfully emitted
  // server must never fail its rewritten runtime import.
  assert.doesNotMatch(output, /Error: Cannot find module|Require stack:|code: ['"]MODULE_NOT_FOUND/);
});
