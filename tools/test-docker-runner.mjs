import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { knownLegacyGatewayIds, knownDevelopmentVolumeNames } from './docker-dev-services.mjs';
import { prepareDevelopmentMountpoint } from './prepare-development.mjs';
import './test-separated-sites.mjs';

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
  const handler = (request, response) => {
    if (!['/api/health/ready','/health/ready'].includes(request.url)) {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(hasFrontends ? `<html>${development ? '<script type="module" src="/@vite/client"></script>' : '<div>application</div>'}</html>` : '<html>wrong server</html>');
      return;
    }
    response.writeHead(health, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ready' }));
  };
  const ports = [];
  for (let i=0; i<3; i++) { const server = createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve))); ports.push(server.address().port); }
  const [port,adminPort,providerPort] = ports;
  await writeFile(join(directory, 'docker'), `#!/usr/bin/env node
const args = process.argv.slice(2);
${development ? `if (args.splice(1, 4).join(' ') !== '-f compose.yaml -f compose.dev.yaml') { console.error('Missing dev Compose override'); process.exit(45); }` : ''}
if (args.join(' ') === 'compose config --format json') console.log(JSON.stringify({ name: 'runner-test', services: { web: { ports: [{ host_ip: '127.0.0.1', published: '${port}', target: 4300 }] }, admin: { ports: [{ host_ip: '127.0.0.1', published: '${adminPort}', target: 4301 }] }, api: { environment: { TOROBTICKET_SSO_ORIGIN: 'http://localhost:${port}', TOROBTICKET_ADMIN_PORT: '${adminPort}' } }, 'example-provider': { ports: [{host_ip: '127.0.0.1', published: '${providerPort}', target: 4310}], environment: { TOROBTICKET_EXAMPLE_PROVIDER_PORT: '${providerPort}' } } } }));
else if (args.join(' ') === 'compose build') { console.log('images built'); process.exit(${mode === 'build-fail' ? 17 : 0}); }
else if (args.join(' ') === 'compose up --wait --wait-timeout 120') { console.log('initializer executed'); process.exit(${mode === 'fail' ? 17 : 0}); }
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
  return { code, output, port, adminPort, providerPort };
}
test('waits for Compose and verifies gateway readiness before printing configured URLs', async t => {
  const result = await fixture(t, 'ok');
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, new RegExp(`Web: http://localhost:${result.port}/`));
  assert.match(result.output, new RegExp(`Admin: http://localhost:${result.adminPort}/admin/`));
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
  assert.match(result.output, /web API readiness failed: HTTP 503/);
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
test('migration retires only the old same-project gateway before binding ports and preserves permanent frontends', async t => {
  const marked = (ID, Service, Project = 'runner-test') => ({ ID, Service, Project, Labels: { 'com.docker.compose.project': Project, 'com.docker.compose.service': Service } });
  const containers = [marked('111111111111', 'gateway'), marked('222222222222', 'web'), marked('333333333333', 'admin'), marked('444444444444', 'gateway', 'other-project'), marked('555555555555', 'database')];
  const result = await fixture(t, 'ok', 200, false, true, containers);
  assert.equal(result.code, 0, result.output); assert.match(result.output, /removed 111111111111/); assert.doesNotMatch(result.output, /removed (222222222222|333333333333|444444444444|555555555555)/);
  assert.ok(result.output.indexOf('images built') < result.output.indexOf('removed 111111111111')); assert.ok(result.output.indexOf('removed 111111111111') < result.output.indexOf('initializer executed'));
  const failure = await fixture(t, 'build-fail', 200, false, true, containers); assert.notEqual(failure.code, 0); assert.doesNotMatch(failure.output, /removed|initializer executed|Web: http/);
});
test('legacy cleanup rejects foreign, mismatched and unsafe container metadata', () => {
  const labels = 'com.docker.compose.project=owned,com.docker.compose.service=gateway';
  const row = { ID: 'abcdef123456', Project: 'owned', Service: 'gateway', Labels: labels };
  assert.deepEqual(knownLegacyGatewayIds(JSON.stringify(row), 'owned'), [row.ID]);
  for (const changed of [{ Project: 'other' }, { Service: 'web' }, { Service: 'admin' }, { ID: 'unsafe id' }, { Labels: labels.replace('service=gateway', 'service=web') }]) assert.deepEqual(knownLegacyGatewayIds(JSON.stringify({ ...row, ...changed }), 'owned'), []);
  assert.deepEqual(knownLegacyGatewayIds(JSON.stringify(row), undefined), []);
});
test('normal shutdown preserves volumes and lets Compose stop its permanent frontends', async t => {
  const container = { ID: 'abcdef123456', Project: 'runner-test', Service: 'admin', Labels: 'com.docker.compose.project=runner-test,com.docker.compose.service=admin,org.torobticket.runtime=development' };
  const result = await fixture(t, 'ok', 200, false, true, [container], 'down');
  assert.equal(result.code, 0, result.output); assert.doesNotMatch(result.output, /removed abcdef123456/); assert.match(result.output, /project stopped; volumes preserved/); assert.doesNotMatch(result.output, /initializer executed|Hot reload:|Web: http/);
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

test('packaged frontend entrypoint derives canonical cross-app URLs including custom ports and IPv6', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'torobticket-frontend-env-')); t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'caddy'), '#!/usr/bin/env node\nconsole.log(JSON.stringify({web:process.env.TOROBTICKET_WEB_ORIGIN,admin:process.env.TOROBTICKET_ADMIN_ORIGIN,webAuthority:process.env.TOROBTICKET_WEB_AUTHORITY,adminAuthority:process.env.TOROBTICKET_ADMIN_AUTHORITY,args:process.argv.slice(2)}));\n', { mode: 0o755 });
  for (const [web, port, explicit, expected] of [['http://127.0.0.1:4400', '4401', '', 'http://127.0.0.1:4401'], ['http://localhost:4300/', '4301', 'http://localhost:4301/', 'http://localhost:4301'], ['http://[::1]:4400', '4401', '', 'http://[::1]:4401'], ['https://ticket.example', '443', 'https://ticket.example:8443', 'https://ticket.example:8443'], ['HTTP://LOCALHOST:80/', '4301', '', 'http://localhost:4301'], ['HTTPS://TICKET.EXAMPLE:443', '8443', 'HTTPS://TICKET.EXAMPLE:8443/', 'https://ticket.example:8443'], ['http://localhost:4300', '4301', 'http://localhost:80', 'http://localhost']]) {
    const child = spawn('sh', [resolve('infra/frontend-entrypoint.sh')], { env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, TOROBTICKET_SSO_ORIGIN: web, TOROBTICKET_ADMIN_PORT: port, TOROBTICKET_ADMIN_ORIGIN: explicit }, stdio: ['ignore','pipe','pipe'] });
    let output=''; child.stdout.on('data', c => output += c); const code=await new Promise(done=>child.once('close',done)); assert.equal(code,0); const actual=JSON.parse(output); assert.equal(actual.web,new URL(web).origin); assert.equal(actual.admin,expected); assert.equal(actual.webAuthority,new URL(web).host); assert.equal(actual.adminAuthority,new URL(expected).host); assert.deepEqual(actual.args,['run','--config','/etc/caddy/Caddyfile','--adapter','caddyfile']);
  }
});
