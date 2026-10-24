import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';

// The Docker boundary is a child executable: avoid builds/daemon mutation in unit tests.
// Missing wait, swallowed failure, premature URLs, and skipped HTTP readiness must fail.
async function fixture(t, mode, health = 200) {
  const directory = await mkdtemp(join(tmpdir(), 'torobticket-runner-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const server = createServer((request, response) => {
    response.writeHead(health, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ready' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  await writeFile(join(directory, 'docker'), `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.join(' ') === 'compose config --format json') console.log(JSON.stringify({ services: { gateway: { ports: [{ host_ip: '127.0.0.1', published: '${port}', target: 80 }] } } }));
else if (args.join(' ') === 'compose up --build --wait --wait-timeout 120') { console.log('initializer executed'); process.exit(${mode === 'fail' ? 17 : 0}); }
else if (args.join(' ') === 'compose ps --all') console.log('initializer exited 17');
else if (args.join(' ') === 'compose logs --no-color --tail 80') console.log('migration failure detail');
else { console.error('Unexpected or unsafe command: ' + args.join(' ')); process.exit(44); }
`, { mode: 0o755 });
  const child = spawn(process.execPath, [resolve('tools/docker-up.mjs')], { env: { ...process.env, PATH: `${directory}:${process.env.PATH}` } });
  let output = '';
  child.stdout.on('data', data => output += data);
  child.stderr.on('data', data => output += data);
  const code = await new Promise(resolve => child.on('close', resolve));
  return { code, output, port };
}
test('waits for Compose and verifies gateway readiness before printing configured URLs', async t => {
  const result = await fixture(t, 'ok');
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, new RegExp(`Web: http://localhost:${result.port}/`));
  assert.match(result.output, new RegExp(`Admin: http://localhost:${result.port}/admin/`));
});
test('returns nonzero with service diagnostics and recovery command on initialization failure', async t => {
  const result = await fixture(t, 'fail');
  assert.notEqual(result.code, 0);
  assert.match(result.output, /migration failure detail/);
  assert.match(result.output, /docker compose logs/);
  assert.doesNotMatch(result.output, /Web: http/);
});
test('does not report success when gateway readiness returns an error', async t => {
  const result = await fixture(t, 'ok', 503);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /Gateway readiness failed: HTTP 503/);
  assert.doesNotMatch(result.output, /Web: http/);
});
