import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { knownDevelopmentFrontendIds, knownDevelopmentVolumeNames } from './docker-dev-services.mjs';
import { prepareDevelopmentMountpoint } from './prepare-development.mjs';

test('prepares a fresh generated mountpoint and preserves existing source/generated contents', async t => {
  const root = await mkdtemp(join(tmpdir(), 'torobticket-dev-mount-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const parent = join(root, 'libs/data-access/src');
  await mkdir(parent, { recursive: true });
  await writeFile(join(parent, 'source.ts'), 'original source');
  const target = await prepareDevelopmentMountpoint(root);
  assert.deepEqual(await readdir(target), []);
  await writeFile(join(target, 'existing-client.ts'), 'preserve existing host output');
  assert.equal(await prepareDevelopmentMountpoint(root), target);
  assert.equal(await readFile(join(target, 'existing-client.ts'), 'utf8'), 'preserve existing host output');
  assert.equal(await readFile(join(parent, 'source.ts'), 'utf8'), 'original source');
});
test('rejects file or symlink generated targets without changing them', async t => {
  const root = await mkdtemp(join(tmpdir(), 'torobticket-dev-mount-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const parent = join(root, 'libs/data-access/src');
  const external = join(root, 'outside-target');
  await mkdir(parent, { recursive: true }); await mkdir(external);
  const target = join(parent, 'generated');
  await writeFile(target, 'not a directory');
  await assert.rejects(prepareDevelopmentMountpoint(root), /real directory/);
  assert.equal(await readFile(target, 'utf8'), 'not a directory');
  await rm(target); await symlink(external, target, 'dir');
  await assert.rejects(prepareDevelopmentMountpoint(root), /real directory/);
  assert.deepEqual(await readdir(external), []);
});
test('rejects an escaped source parent instead of creating directories outside the checkout', async t => {
  const root = await mkdtemp(join(tmpdir(), 'torobticket-dev-mount-'));
  const external = await mkdtemp(join(tmpdir(), 'torobticket-outside-mount-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(external, { recursive: true, force: true }));
  await mkdir(join(root, 'libs/data-access'), { recursive: true });
  await symlink(external, join(root, 'libs/data-access/src'), 'dir');
  await assert.rejects(prepareDevelopmentMountpoint(root), /inside the checkout/);
  assert.deepEqual(await readdir(external), []);
});

// The Docker boundary is a child executable: avoid builds/daemon mutation in unit tests.
// Missing wait, swallowed failure, premature URLs, and skipped HTTP readiness must fail.
async function fixture(t, mode, health = 200, development = false, hasFrontends = true, containers = [], action = 'up', volumes = []) {
  const directory = await mkdtemp(join(tmpdir(), 'torobticket-runner-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const server = createServer((request, response) => {
    if (development && request.url !== '/api/health/ready') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(hasFrontends ? '<script type="module" src="/@vite/client"></script>' : '<div>wrong server</div>');
      return;
    }
    response.writeHead(health, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ready' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  await writeFile(join(directory, 'docker'), `#!/usr/bin/env node
const args = process.argv.slice(2);
${development ? `if (args.splice(1, 4).join(' ') !== '-f compose.yaml -f compose.dev.yaml') { console.error('Missing dev Compose override'); process.exit(45); }` : ''}
if (args.join(' ') === 'compose config --format json') console.log(JSON.stringify({ name: 'runner-test', services: { gateway: { ports: [{ host_ip: '127.0.0.1', published: '${port}', target: 80 }] }, api: { environment: { TOROBTICKET_SSO_ORIGIN: 'http://localhost:${port}' } }, 'example-provider': { environment: { TOROBTICKET_EXAMPLE_PROVIDER_PORT: '4310' } } } }));
else if (args.join(' ') === 'compose up --build --wait --wait-timeout 120') { console.log('initializer executed'); process.exit(${mode === 'fail' ? 17 : 0}); }
else if (args.join(' ') === 'compose ps --all --format json') console.log(${JSON.stringify(JSON.stringify(containers))});
else if (args.join(' ') === 'compose down') console.log('project stopped; volumes preserved');
else if (args.join(' ') === 'compose down --volumes') console.log('explicit project database reset');
else if (args.join(' ') === 'compose ps --all') console.log('initializer exited 17');
else if (args.join(' ') === 'compose logs --no-color --tail 80') console.log('migration failure detail');
else if (args[0] === 'rm' && args[1] === '--force') console.log('removed ' + args[2]);
else if (args[0] === 'volume' && args[1] === 'ls' && args.join(' ').includes('label=com.docker.compose.project=runner-test')) console.log(${JSON.stringify(JSON.stringify(volumes))});
else if (args[0] === 'volume' && args[1] === 'rm' && args.length === 3) console.log('removed volume ' + args[2]);
else { console.error('Unexpected or unsafe command: ' + args.join(' ')); process.exit(44); }
`, { mode: 0o755 });
  const entry = action === 'down' ? 'tools/docker-down.mjs' : action === 'reset' ? 'tools/docker-reset.mjs' : 'tools/docker-up.mjs';
  const child = spawn(process.execPath, [resolve(entry), ...(development ? ['--dev'] : [])], { env: { ...process.env, PATH: `${directory}:${process.env.PATH}` } });
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
test('dev startup consistently selects both Compose files and verifies both live Vite frontends', async t => {
  const result = await fixture(t, 'ok', 200, true);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /Hot reload:/);
  assert.match(result.output, new RegExp(`Web: http://localhost:${result.port}/`));
});
test('dev startup rejects a healthy API behind missing development frontends', async t => {
  const result = await fixture(t, 'ok', 200, true, false);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /Development frontend unavailable/);
  assert.match(result.output, /rerun pnpm docker:dev/);
  assert.doesNotMatch(result.output, /Web: http/);
});
test('dev failure diagnostics inspect the same development Compose project', async t => {
  const result = await fixture(t, 'fail', 200, true);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /docker compose -f compose.yaml -f compose.dev.yaml ps --all/);
  assert.match(result.output, /migration failure detail/);
});
test('packaged startup removes only explicitly marked same-project dev frontends after the replacement starts', async t => {
  const marked = (ID, Service, Project = 'runner-test') => ({ ID, Service, Project, Labels: { 'com.docker.compose.project': Project, 'com.docker.compose.service': Service, 'org.torobticket.runtime': 'development' } });
  const containers = [marked('111111111111', 'web'), marked('222222222222', 'admin'), { ...marked('333333333333', 'web'), Labels: {} }, marked('444444444444', 'web', 'other-project'), marked('555555555555', 'database'), marked('666666666666', 'custom')];
  const result = await fixture(t, 'ok', 200, false, true, containers);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /removed 111111111111/);
  assert.match(result.output, /removed 222222222222/);
  assert.doesNotMatch(result.output, /removed (333333333333|444444444444|555555555555|666666666666)/);
  assert.ok(result.output.indexOf('initializer executed') < result.output.indexOf('removed 111111111111'));
});
test('known development service cleanup rejects foreign, missing, mismatched and unsafe metadata', () => {
  const labels = 'com.docker.compose.project=owned,com.docker.compose.service=web,org.torobticket.runtime=development';
  const row = { ID: 'abcdef123456', Project: 'owned', Service: 'web', Labels: labels };
  assert.deepEqual(knownDevelopmentFrontendIds(JSON.stringify(row), 'owned'), [row.ID]);
  for (const changed of [{ Project: 'other' }, { Service: 'api' }, { ID: 'unsafe id' }, { Labels: labels.replace('service=web', 'service=admin') }, { Labels: labels.replace('runtime=development', 'runtime=custom') }]) {
    assert.deepEqual(knownDevelopmentFrontendIds(JSON.stringify({ ...row, ...changed }), 'owned'), []);
  }
  assert.deepEqual(knownDevelopmentFrontendIds(JSON.stringify(row), undefined), []);
});
test('normal shutdown also stops known dev frontends and preserves database volumes', async t => {
  const container = { ID: 'abcdef123456', Project: 'runner-test', Service: 'admin', Labels: 'com.docker.compose.project=runner-test,com.docker.compose.service=admin,org.torobticket.runtime=development' };
  const result = await fixture(t, 'ok', 200, false, true, [container], 'down');
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /removed abcdef123456/);
  assert.match(result.output, /project stopped; volumes preserved/);
  assert.ok(result.output.indexOf('removed abcdef123456') < result.output.indexOf('project stopped'));
  assert.doesNotMatch(result.output, /initializer executed|Hot reload:|Web: http/);
});
test('explicit reset removes only the labelled generated-client cache after its project database reset', async t => {
  const labels = { 'com.docker.compose.project': 'runner-test', 'com.docker.compose.volume': 'dev_prisma', 'org.torobticket.role': 'generated-client' };
  const volumes = [{ Name: 'runner-test_dev_prisma', Labels: labels }, { Name: 'custom_volume', Labels: labels }, { Name: 'other_dev_prisma', Labels: { ...labels, 'com.docker.compose.project': 'other' } }];
  const result = await fixture(t, 'ok', 200, false, true, [], 'reset', volumes);
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /explicit project database reset/);
  assert.match(result.output, /removed volume runner-test_dev_prisma/);
  assert.doesNotMatch(result.output, /removed volume (custom_volume|other_dev_prisma)/);
});
test('generated-client cache cleanup refuses mismatched, unmarked and custom-named volumes', () => {
  const row = { Name: 'owned_dev_prisma', Labels: { 'com.docker.compose.project': 'owned', 'com.docker.compose.volume': 'dev_prisma', 'org.torobticket.role': 'generated-client' } };
  assert.deepEqual(knownDevelopmentVolumeNames(JSON.stringify([row]), 'owned'), [row.Name]);
  for (const changed of [{ Name: 'custom' }, { Labels: {} }, { Labels: { ...row.Labels, 'com.docker.compose.project': 'other' } }, { Labels: { ...row.Labels, 'com.docker.compose.volume': 'database' } }, { Labels: { ...row.Labels, 'org.torobticket.role': 'custom' } }]) {
    assert.deepEqual(knownDevelopmentVolumeNames(JSON.stringify([{ ...row, ...changed }]), 'owned'), []);
  }
});
