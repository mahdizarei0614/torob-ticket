import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { LIMITS, CRITICAL_TITLES, parseArguments, childEnvironment, createReportDirectory, redactOutput, runChild, browserSummary, verifyRelease } from './verify-release.mjs';

const shortLimits = { ...LIMITS, httpMs: 500, healthMs: 1500, assetsMs: 2500, dependenciesMs: 1500, sourceMs: 1500, toolsMs: 1500, postgresMs: 1500, browserMs: 1500, smokeMs: 6000, qualityMs: 6000, killGraceMs: 50 };
const successfulChild = { code: 0, signal: null, errorCode: null, timedOut: false, interrupted: false, cleanupConfirmed: true, logSanitized: true, logTruncated: false, logBytes: 0 };
const summaryFixture = () => ({ status: 'passed', discoveryOnly: false, duration: 42, counts: { passed: 7, failed: 0, flaky: 0, skipped: 0, notRun: 0, interrupted: 0 }, globalErrors: [], tests: [...CRITICAL_TITLES, '@release-core external-request block', '@release-core owned reset isolation'].map(title => ({ title, outcome: 'passed', attempts: [{ status: 'passed', retry: 0 }] })) });

async function fixture(t, { ready = true, development = false, remote = false, neverRespond = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'torobticket-release-contract-'));
  await mkdir(join(root, 'assets'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ engines: { node: process.versions.node } }));
  for (const path of ['node_modules/@playwright/test/package.json', 'node_modules/nx/dist/bin/nx.js']) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), '{}'); }
  const assets = Object.fromEntries(['/theme-init.js', '/fonts/Vazirmatn-wght.woff2', '/fonts/InterVariable.woff2', '/geography/consumer-geography.json', '/geography/route-geometry.json'].map(path => [path, Buffer.from('fixture-asset:' + path)]));
  for (const [path, bytes] of Object.entries(assets)) { await mkdir(dirname(join(root, 'assets', path)), { recursive: true }); await writeFile(join(root, 'assets', path), bytes); }
  const requests = [];
  const handler = (request, response) => {
    requests.push({ path: request.url, method: request.method });
    if (neverRespond) return;
    if (request.url.startsWith('/api/health/')) {
      response.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
      response.end(JSON.stringify(request.url.endsWith('/live') ? { status: 'ok' } : { status: ready ? 'ready' : 'not-ready', database: 'ready', migrations: 'ready', seed: 'ready' })); return;
    }
    if (request.url === '/' || request.url === '/admin/') {
      const admin = request.url.startsWith('/admin'); response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<html lang="${admin ? 'en' : 'fa'}"><script src="${admin ? '/admin' : ''}/theme-init.js"></script><script type="module" src="${admin ? '/admin' : ''}/assets/entry-12345678.js"></script>${development ? '@vite/client' : ''}${remote ? '<script src="https://remote.invalid/script.js"></script>' : ''}</html>`); return;
    }
    if (request.url.includes('/assets/')) { response.writeHead(200, { 'content-type': 'text/javascript' }); response.end('fixture_entry();'); return; }
    const path = request.url.replace(/^\/admin(?=\/)/, '');
    if (assets[path]) { response.writeHead(200, { 'content-type': path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); response.end(assets[path]); return; }
    response.writeHead(404); response.end();
  };
  const server = createServer(handler), adminServer = createServer(handler);
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  await new Promise(done => adminServer.listen(0, '127.0.0.1', done));
  t.after(async () => { server.closeAllConnections(); adminServer.closeAllConnections(); await Promise.all([new Promise(done => server.close(done)),new Promise(done => adminServer.close(done))]); await rm(root, { recursive: true, force: true }); });
  const options = { adminBaseUrl: `http://127.0.0.1:${adminServer.address().port}`, baseUrl: `http://127.0.0.1:${server.address().port}`, reportDir: join(root, 'run'), profile: 'smoke', postgres: false, browserChannel: 'chrome' };
  const calls = [];
  const runCommand = async (command, args, settings) => {
    calls.push({ command, args, ...settings }); await writeFile(settings.logPath, 'Sanitized contract-fixture command output\n');
    if (args.includes('--config') && args.includes('tests/e2e/playwright.config.ts')) { const directory = join(settings.env.E2E_EVIDENCE_DIR, 'artifacts'); await mkdir(directory, { recursive: true }); await writeFile(join(directory, 'run-summary.json'), JSON.stringify(summaryFixture())); }
    return { ...successfulChild };
  };
  return { root, server, options, requests, calls, runCommand, assets };
}

test('CLI requires an explicit loopback target and a unique report folder', () => {
  for (const target of ['https://127.0.0.1:4300', 'http://example.com:4300', 'http://127.0.0.1', 'http://127.0.0.1:80', 'http://user:private@127.0.0.1:4300', 'http://127.0.0.1:4300/path', 'http://127.0.0.1:4300/?x=1', 'http://127.0.0.1:4300/#hash']) assert.throws(() => parseArguments(['--base-url', target, '--report-dir', 'owned-run']), error => error.code === 'invalid-target' && !error.message.includes('private'));
  assert.throws(() => parseArguments([]), /explicit/);
  assert.throws(() => parseArguments(['--base-url', 'http://127.0.0.1:4300']), /report-dir/);
  assert.throws(() => parseArguments(['--base-url', 'http://127.0.0.1:4300', '--report-dir', 'run', '--profile', 'smoke', '--profile', 'quality']), /only once/);
  const value = parseArguments(['--', '--base-url=http://localhost:4300', '--report-dir', 'new-run']); assert.equal(value.profile, 'smoke'); assert.equal(value.baseUrl, 'http://localhost:4300');
});

test('admin verification uses a distinct matching loopback origin and rejects alternate hosts or credentials', () => {
  const args=['--base-url','http://127.0.0.1:4300','--report-dir','new-run'];
  assert.equal(parseArguments([...args,'--admin-url','http://127.0.0.1:4401']).adminBaseUrl,'http://127.0.0.1:4401');
  for(const value of ['http://localhost:4301','http://127.0.0.1:4300','http://user:private@127.0.0.1:4301','http://127.0.0.1:4301/path']) assert.throws(()=>parseArguments([...args,'--admin-url',value]),error=>error.code==='invalid-admin-target'&&!error.message.includes('private'));
});

test('PostgreSQL is explicit and never falls back to a general database URL', () => {
  const args = ['--base-url', 'http://127.0.0.1:4300', '--report-dir', 'run', '--postgres'];
  for (const env of [{ DATABASE_URL: 'postgresql://fixture:private@localhost/main_test' }, { TEST_DATABASE_URL: 'postgresql://fixture:private@localhost/main' }, { TEST_DATABASE_URL: 'postgresql://fixture:private@localhost/owned_test?database=main' }]) assert.throws(() => parseArguments(args, env), error => error.code === 'invalid-test-database' && !error.message.includes('private'));
  const parsed = parseArguments(args, { TEST_DATABASE_URL: 'postgresql://fixture:contract@127.0.0.1/owned_test' }); assert.equal(parsed.postgres, true); assert.match(parsed.testDatabaseUrl, /owned_test$/);
});

test('child environment cannot inherit an installed-state bypass, evidence root, server mode or lifecycle coordinator', () => {
  const env = childEnvironment({ baseUrl: 'http://127.0.0.1:4308', reportDir: '/tmp/owned-release/run', browserChannel: 'chrome' }, { PATH: '/known', pnpm_config_verify_deps_before_run: 'false', NPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: 'install', pnpm_config_VERIFY_DEPS_BEFORE_RUN: 'false', NX_RUNNER: 'other', nx_cache_directory: '/unowned', E2E_BASE_URL: 'http://other.invalid', E2E_DEV_SERVERS: '1', GRAPHICS_E2E_PORT: '4444', SOME_EVIDENCE_DIR: '/unowned', T33_COORDINATION_DIR: '/unowned', T33_REHEARSAL_ORIGIN: 'http://other.invalid', CI: '1', DATABASE_URL: 'private' }, 'browser-critical');
  assert.equal(env.pnpm_config_verify_deps_before_run, 'error');
  assert.deepEqual(Object.keys(env).filter(key => /verify[-_]deps[-_]before[-_]run/i.test(key)), ['pnpm_config_verify_deps_before_run']);
  for (const key of ['NPM_CONFIG_VERIFY_DEPS_BEFORE_RUN', 'NX_RUNNER', 'nx_cache_directory', 'E2E_DEV_SERVERS', 'GRAPHICS_E2E_PORT', 'SOME_EVIDENCE_DIR', 'T33_COORDINATION_DIR', 'DATABASE_URL', 'CI']) assert.equal(env[key], undefined, key);
  assert.equal(env.E2E_BASE_URL, 'http://127.0.0.1:4308'); assert.equal(env.T33_REHEARSAL_ORIGIN, env.E2E_BASE_URL); assert.equal(env.E2E_BROWSER, 'chromium'); assert.equal(env.PLAYWRIGHT_CHANNEL, 'chrome'); assert.match(env.E2E_EVIDENCE_DIR, /owned-release\/run\/browser$/); assert.equal(env.NX_DAEMON, 'false');
});

test('owned report paths preserve existing files and reject broad or symlink targets', async t => {
  const root = await mkdtemp(join(tmpdir(), 'torobticket-report-path-')); t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of [root, tmpdir(), '/tmp', join(root,'.local'), join(root,'.local/evidence'), join(root,'.local/evidence/release')]) await assert.rejects(createReportDirectory(path, root), /specific/);
  const existing = join(root, 'previous'); await mkdir(existing); await writeFile(join(existing, 'evidence.json'), 'preserve');
  await assert.rejects(createReportDirectory(existing, root), /already exist/);
  const linked = join(root, 'linked'); await symlink(existing, linked, 'dir'); await assert.rejects(createReportDirectory(linked, root), /already exist/);
  assert.equal(await readFile(join(existing, 'evidence.json'), 'utf8'), 'preserve');
});

test('successful smoke proves packaged HTTP facts and seven executed cases while declaring skipped coverage', async t => {
  const f = await fixture(t); const report = await verifyRelease(f.options, { root: f.root, env: {}, runCommand: f.runCommand, limits: shortLimits });
  assert.equal(report.status, 'passed'); assert.equal(report.coverage.completeReleaseProof, false); assert.match(report.coverage.note, /Partial/);
  assert.deepEqual(report.gates.map(gate => [gate.id, gate.status]), [['health', 'passed'], ['packaged-assets', 'passed'], ['dependencies', 'passed'], ['source-quality', 'skipped'], ['tool-contracts', 'skipped'], ['postgres', 'skipped'], ['browser-critical', 'passed']]);
  assert.ok(report.gates.filter(gate => gate.status === 'passed').every(gate => !Object.hasOwn(gate, 'reason')));
  assert.equal(report.gates.at(-1).executed.counts.passed, 7); assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].command, 'pnpm'); assert.deepEqual(f.calls[0].args, ['--config.verify-deps-before-run=error', 'exec', 'node', '--version']);
  assert.ok(f.calls.every(call => !call.args.some(arg => /docker|compose|reset|down/.test(arg)))); assert.ok(f.requests.every(request => request.method === 'GET'));
  const stored = JSON.parse(await readFile(join(f.options.reportDir, 'report.json'), 'utf8')); assert.equal(stored.status, 'passed'); assert.equal(stored.gates.at(-1).executed.cases.length, 7); assert.ok(stored.gates.filter(gate => gate.status === 'passed').every(gate => !Object.hasOwn(gate, 'reason')));
});

test('failed health leaves later selected gates not-run and performs no child or mutation', async t => {
  const f = await fixture(t, { ready: false }); const report = await verifyRelease(f.options, { root: f.root, env: {}, runCommand: f.runCommand, limits: shortLimits });
  assert.equal(report.status, 'failed'); assert.equal(report.gates[0].status, 'failed'); assert.equal(report.gates[1].status, 'not_run'); assert.equal(report.gates.at(-1).status, 'not_run'); assert.equal(report.gates.find(g => g.id === 'postgres').status, 'skipped'); assert.equal(f.calls.length, 0);
});

test('development or remote startup scripts cannot pass packaged verification', async t => {
  for (const mode of [{ development: true }, { remote: true }]) {
    const f = await fixture(t, mode); const report = await verifyRelease(f.options, { root: f.root, env: {}, runCommand: f.runCommand, limits: shortLimits });
    assert.equal(report.gates[1].status, 'failed'); assert.equal(report.gates.at(-1).status, 'not_run'); assert.equal(f.calls.length, 0); assert.ok(f.requests.every(request => !request.path.includes('remote.invalid')));
  }
});

test('missing host modules fail actionably without installing or pretending browser execution', async t => {
  const f = await fixture(t); await rm(join(f.root, 'node_modules'), { recursive: true });
  const report = await verifyRelease(f.options, { root: f.root, env: {}, runCommand: f.runCommand, limits: shortLimits }); const gate = report.gates.find(g => g.id === 'dependencies');
  assert.equal(report.status, 'failed'); assert.equal(gate.errorCode, 'missing-source-dependencies'); assert.match(gate.reason, /install --frozen-lockfile/); assert.equal(report.gates.at(-1).status, 'not_run'); assert.equal(f.calls.length, 1); assert.ok(!f.calls[0].args.includes('install'));
});

test('quality uses strict source verification before tools/browser and PostgreSQL only when selected', async t => {
  const f = await fixture(t); const url = 'postgresql://fixture:contract@127.0.0.1/owned_test'; const options = { ...f.options, profile: 'quality', postgres: true, testDatabaseUrl: url };
  const report = await verifyRelease(options, { root: f.root, env: { pnpm_config_verify_deps_before_run: 'false', TEST_DATABASE_URL: url }, runCommand: f.runCommand, limits: shortLimits });
  assert.equal(report.status, 'passed'); assert.ok(report.gates.every(g => g.status === 'passed' && !Object.hasOwn(g, 'reason')));
  assert.deepEqual(f.calls[1].args, ['--config.verify-deps-before-run=error', 'verify', '--parallel=1', '--output-style=static']); assert.equal(f.calls[1].command, 'pnpm');
  assert.ok(f.calls[2].args.includes('--test-concurrency=1')); assert.ok(f.calls[3].args.includes('api:test-integration')); assert.equal(f.calls[3].env.TEST_DATABASE_URL, url); assert.equal(f.calls[3].env.DATABASE_URL, url);
  for (const call of f.calls) assert.equal(call.env.pnpm_config_verify_deps_before_run, 'error');
  for (const call of f.calls.filter(call => !call.args.includes('api:test-integration'))) assert.equal(call.env.TEST_DATABASE_URL, undefined);
});

test('strict source or dependency failure cannot continue to dependent gates', async t => {
  for (const failedCommand of ['dependencies', 'source-quality']) {
    const f = await fixture(t); const runCommand = async (...args) => { const result = await f.runCommand(...args); return args[2].logPath.endsWith(failedCommand + '.log') ? { ...result, code: 19 } : result; };
    const report = await verifyRelease({ ...f.options, profile: 'quality' }, { root: f.root, env: {}, runCommand, limits: shortLimits });
    assert.equal(report.status, 'failed'); assert.equal(report.gates.find(g => g.id === failedCommand).status, 'failed'); assert.equal(report.gates.find(g => g.id === 'tool-contracts').status, 'not_run'); assert.equal(report.gates.at(-1).status, 'not_run');
  }
});

test('zero/discovery/skipped/retried or incomplete browser selection fails closed despite exit zero', () => {
  const changes = [summary => { summary.counts.passed = 0; summary.tests = []; }, summary => { summary.discoveryOnly = true; }, summary => { summary.counts.skipped = 1; }, summary => { summary.tests[0].attempts.push({ status: 'passed', retry: 1 }); }, summary => { summary.tests.at(-1).title = 'unrelated'; }, summary => { summary.globalErrors.push({ text: 'failure' }); }];
  for (const change of changes) { const summary = summaryFixture(); change(summary); assert.throws(() => browserSummary(summary)); }
  assert.equal(browserSummary(summaryFixture()).counts.passed, 7);
});

test('a child exit-zero without an actual browser report does not count as browser pass', async t => {
  const f = await fixture(t); const report = await verifyRelease(f.options, { root: f.root, env: {}, runCommand: async (_command, _args, settings) => { await writeFile(settings.logPath, 'contract fixture'); return successfulChild; }, limits: shortLimits });
  assert.equal(report.status, 'failed'); assert.equal(report.gates.at(-1).errorCode, 'missing-browser-summary');
});

test('HTTP deadlines stop the gate and preserve a bounded non-passing report', async t => {
  const f = await fixture(t, { neverRespond: true }); const start = performance.now(); const report = await verifyRelease(f.options, { root: f.root, env: {}, runCommand: f.runCommand, limits: { ...shortLimits, httpMs: 80 } });
  assert.equal(report.status, 'failed'); assert.equal(report.gates[0].status, 'timed_out'); assert.ok(performance.now() - start < 1500); assert.equal(f.calls.length, 0);
});

test('child logs redact split credentials, bound long output and truthfully retain nonzero exit', async t => {
  const root = await mkdtemp(join(tmpdir(), 'torobticket-child-output-')); t.after(() => rm(root, { recursive: true, force: true })); const logPath = join(root, 'command.log');
  const source = "process.stdout.write('Set-Coo');process.stdout.write('kie: opaque-fixture\\n');process.stderr.write('postgresql://fixture:private@localhost/owned_test\\n');process.stdout.write('x'.repeat(4000)+'\\n');console.log('end');process.exitCode=17";
  const result = await runChild(process.execPath, ['-e', source], { cwd: root, env: {}, logPath, timeoutMs: 1000, limits: { ...shortLimits, logBytes: 1024, lineBytes: 256 } }); const log = await readFile(logPath, 'utf8');
  assert.equal(result.code, 17); assert.equal(result.logSanitized, true); assert.equal(result.logTruncated, true); assert.ok(Buffer.byteLength(log) <= 1024); assert.equal(result.logBytes, Buffer.byteLength(log)); assert.ok(!log.includes('opaque-fixture')); assert.ok(!log.includes('private')); assert.match(log, /REDACTED/); assert.match(log, /Overlong output/);
});

test('timeout terminates only its owned child group, including an ordinary grandchild', { skip: process.platform === 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'torobticket-child-timeout-')); t.after(() => rm(root, { recursive: true, force: true }));
  const pulse = join(root, 'pulse'); const grandchild = `import{appendFileSync}from'node:fs';setInterval(()=>appendFileSync(${JSON.stringify(pulse)},'.'),15);`;
  const source = `import{spawn}from'node:child_process';spawn(process.execPath,['--input-type=module','-e',${JSON.stringify(grandchild)}],{stdio:'ignore'});setInterval(()=>{},1000);`;
  const result = await runChild(process.execPath, ['--input-type=module', '-e', source], { cwd: root, env: {}, logPath: join(root, 'timeout.log'), timeoutMs: 180, limits: shortLimits });
  assert.equal(result.timedOut, true); assert.notEqual(result.code, 0);
  const before = await readFile(pulse, 'utf8'); await new Promise(done => setTimeout(done, 100)); assert.equal(await readFile(pulse, 'utf8'), before);
});

test('pre-aborted verification records interruption and starts no HTTP/child action', async t => {
  const f = await fixture(t); const controller = new AbortController(); controller.abort();
  const report = await verifyRelease(f.options, { root: f.root, env: {}, runCommand: f.runCommand, signal: controller.signal, limits: shortLimits });
  assert.equal(report.status, 'interrupted'); assert.equal(f.requests.length, 0); assert.equal(f.calls.length, 0); assert.equal(report.gates.at(-1).status, 'not_run');
});

test('invalid programmatic target is rejected before report/network/child actions', async t => {
  const f = await fixture(t); await assert.rejects(verifyRelease({ ...f.options, baseUrl: 'https://other.invalid:4300' }, { root: f.root, runCommand: f.runCommand }), /loopback/); await assert.rejects(access(f.options.reportDir)); assert.equal(f.calls.length, 0); assert.equal(f.requests.length, 0);
});

test('actual CLI runs its safe plan and refuses to overwrite a completed report', async t => {
  const f = await fixture(t);
  for (const [source, target] of [['tools/verify-release.mjs', 'tools/verify-release.mjs'], ['apps/api/test/test-database.cjs', 'apps/api/test/test-database.cjs']]) { await mkdir(dirname(join(f.root, target)), { recursive: true }); await writeFile(join(f.root, target), await readFile(resolve(source))); }
  const bin = join(f.root, 'bin'); await mkdir(bin);
  await writeFile(join(bin, 'pnpm'), '#!/usr/bin/env node\nif(process.env.pnpm_config_verify_deps_before_run!=="error")process.exit(49);else console.log(process.version);\n', { mode: 0o755 });
  const cli = join(f.root, 'node_modules/@playwright/test/cli.js');
  await writeFile(cli, `const fs=require('node:fs');const path=require('node:path');const root=path.join(process.env.E2E_EVIDENCE_DIR,'artifacts');fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'run-summary.json'),JSON.stringify(${JSON.stringify(summaryFixture())}));`);
  const invoke = () => new Promise((done, reject) => { const child = spawn(process.execPath, [join(f.root, 'tools/verify-release.mjs'), '--base-url', f.options.baseUrl, '--admin-url', f.options.adminBaseUrl, '--report-dir', f.options.reportDir], { cwd: f.root, env: { ...process.env, PATH: `${bin}:${dirname(process.execPath)}:${process.env.PATH}`, pnpm_config_verify_deps_before_run: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] }); let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b); child.once('error', reject); child.once('close', code => done({ code, output })); });
  const first = await invoke(); assert.equal(first.code, 0, first.output); assert.match(first.output, /Selected smoke verification: passed/); const before = await readFile(join(f.options.reportDir, 'report.json')); const requests = f.requests.length;
  const second = await invoke(); assert.equal(second.code, 2); assert.match(second.output, /already exist/); assert.deepEqual(await readFile(join(f.options.reportDir, 'report.json')), before); assert.equal(f.requests.length, requests);
});

test('standalone text redaction does not expose known environment secrets or credential headers', () => {
  const value = redactOutput('x fixture-token\nAuthorization: Bearer hidden\nCookie: opaque\ntorob_demo=opaque\nhttps://userinfo-only@registry.invalid/package\n', { API_TOKEN: 'fixture-token' });
  assert.ok(!value.includes('fixture-token')); assert.ok(!value.includes('hidden')); assert.ok(!value.includes('opaque')); assert.ok(!value.includes('userinfo-only'));
});
