import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { requireTestDatabaseUrl } = require('../apps/api/test/test-database.cjs');
const workspace = fileURLToPath(new URL('../', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const LIMITS = Object.freeze({ httpMs: 5000, healthMs: 20_000, assetsMs: 60_000, dependenciesMs: 30_000, sourceMs: 900_000, toolsMs: 180_000, postgresMs: 600_000, browserMs: 600_000, smokeMs: 780_000, qualityMs: 2_400_000, killGraceMs: 1500, logBytes: 2_097_152, lineBytes: 65_536, responseBytes: 4_194_304 });
export const CRITICAL_TITLES = Object.freeze(['priced provisional Jalali calendar', 'arrival hotels, room capacity', 'real keyboard traversal', 'seeded legacy round-trip checkpoint', 'mobile seeded legacy hotel checkpoint']);
export const BROWSER_GREP = ['@release-core', ...CRITICAL_TITLES].join('|');
const gateNames = ['health', 'packaged-assets', 'dependencies', 'source-quality', 'tool-contracts', 'postgres', 'browser-critical'];

function problem(code, message) { return Object.assign(new Error(message), { code }); }
export function parseArguments(argv, env = process.env) {
  const args = [...argv]; if (args[0] === '--') args.shift();
  const options = { profile: 'smoke', postgres: false, browserChannel: undefined };
  const seen = new Set();
  const keys = { '--base-url': 'baseUrl', '--admin-url': 'adminBaseUrl', '--report-dir': 'reportDir', '--profile': 'profile', '--browser-channel': 'browserChannel' };
  for (let i = 0; i < args.length; i++) {
    const [flag, ...inline] = args[i].split('=');
    if (flag === '--help' || flag === '-h') { options.help = true; continue; }
    if (seen.has(flag)) throw problem('invalid-arguments', 'Use each verification option only once.');
    seen.add(flag);
    if (flag === '--postgres' && !inline.length) { options.postgres = true; continue; }
    const key = keys[flag]; if (!key) throw problem('invalid-arguments', 'Unknown release verification option.');
    const value = inline.length ? inline.join('=') : args[++i];
    if (!value || value.startsWith('--') || /[\x00-\x1f\x7f]/.test(value)) throw problem('invalid-arguments', 'Every verification option needs a valid value.');
    options[key] = value;
  }
  return options.help ? options : validateOptions(options, env);
}

function validateOptions(options, env) {
  options = { profile: 'smoke', postgres: false, ...options };
  if (!options.baseUrl || !options.reportDir) throw problem('missing-target', 'Supply explicit --base-url and a new --report-dir.');
  let url;
  try { url = new URL(options.baseUrl); } catch { throw problem('invalid-target', 'The verification target must be an explicit loopback HTTP origin.'); }
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !url.port || Number(url.port) < 1024 || Number(url.port) > 65535) throw problem('invalid-target', 'The verification target must be an explicit loopback HTTP origin with a nonprivileged port and no credentials, path, query or fragment.');
  options.baseUrl = url.origin;
  const defaultAdmin = new URL(url); defaultAdmin.port = '4301';
  let admin;
  try { admin = new URL(options.adminBaseUrl || defaultAdmin.origin); } catch { throw problem('invalid-admin-target', 'Supply an explicit loopback admin origin.'); }
  if (admin.protocol !== url.protocol || admin.hostname !== url.hostname || !admin.port || Number(admin.port) < 1024 || Number(admin.port) > 65535 || admin.username || admin.password || admin.pathname !== '/' || admin.search || admin.hash || admin.origin === url.origin) throw problem('invalid-admin-target', 'Admin requires a distinct loopback origin with the same hostname and scheme.');
  options.adminBaseUrl = admin.origin;
  if (!['smoke', 'quality'].includes(options.profile)) throw problem('invalid-profile', 'The verification profile must be smoke or quality.');
  if (options.browserChannel && !['chrome', 'chromium', 'msedge'].includes(options.browserChannel)) throw problem('invalid-channel', 'The browser channel must be chrome, chromium or msedge. Omit it to use bundled Chromium.');
  if (typeof options.postgres !== 'boolean') throw problem('invalid-postgres', 'The PostgreSQL gate must be selected explicitly.');
  if (options.postgres) {
    try { options.testDatabaseUrl = requireTestDatabaseUrl(options.testDatabaseUrl ?? env.TEST_DATABASE_URL); }
    catch { throw problem('invalid-test-database', 'The PostgreSQL gate requires an explicit existing TEST_DATABASE_URL with a simple _test database name and no query or fragment. DATABASE_URL is never a fallback.'); }
  }
  return options;
}

/** Logs are explicitly sanitized and bounded, never presented as raw output. */
export function redactOutput(value, env = process.env) {
  let text = String(value).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
  const secrets = Object.entries(env).filter(([key, entry]) => entry && /(?:PASSWORD|TOKEN|SECRET|(?:^|_)KEY$|(?:^|_)DATABASE_URL$)/i.test(key)).map(([, entry]) => entry).sort((a, b) => b.length - a.length);
  for (const secret of secrets) text = text.split(secret).join('[REDACTED_ENV]');
  return text.replace(/\b((?:cookie|set-cookie|authorization|proxy-authorization)["']?\s*:\s*)("[^"\r\n]*"|'[^'\r\n]*'|[^\r\n]+)/gi, '$1[REDACTED]')
    .replace(/(\btorob_demo\s*=\s*)[^;\s"'<>`]+/g, '$1[REDACTED]')
    .replace(/\b((?:postgres(?:ql)?|https?):\/\/)[^\s/@]+@/gi, '$1[REDACTED]@');
}

export function childEnvironment(options, env = process.env, gate = '') {
  const clean = { ...env };
  for (const key of Object.keys(clean)) if (/^(?:NX_|E2E_|ADMIN_E2E_|GRAPHICS_E2E_)/i.test(key) || /EVIDENCE_DIR$/i.test(key) || /^T33_(?:COORDINATION|REHEARSAL)/i.test(key) || /(?:^|_)(?:verify[-_]deps[-_]before[-_]run)$/i.test(key)) delete clean[key];
  for (const key of ['CI', 'FORCE_COLOR', 'PLAYWRIGHT_CHANNEL', 'DATABASE_URL', 'TEST_DATABASE_URL']) delete clean[key];
  Object.assign(clean, { NX_DAEMON: 'false', NX_NO_CLOUD: 'true', NX_SKIP_NX_CACHE: 'true', NX_ISOLATE_PLUGINS: 'false', NX_TUI: 'false', NO_COLOR: '1', pnpm_config_verify_deps_before_run: 'error' });
  if (gate === 'postgres') Object.assign(clean, { TEST_DATABASE_URL: options.testDatabaseUrl, DATABASE_URL: options.testDatabaseUrl });
  if (gate === 'browser-critical') {
    const admin = new URL(options.baseUrl); admin.port = '4301';
    const adminOrigin = options.adminBaseUrl || admin.origin;
    Object.assign(clean, { E2E_BROWSER: 'chromium', E2E_BASE_URL: options.baseUrl, ADMIN_E2E_URL: adminOrigin, TOROBTICKET_ADMIN_ORIGIN: adminOrigin, TOROBTICKET_ADMIN_PORT: new URL(adminOrigin).port, E2E_EVIDENCE_DIR: resolve(options.reportDir, 'browser'), T33_REHEARSAL_ORIGIN: options.baseUrl });
    if (options.browserChannel) clean.PLAYWRIGHT_CHANNEL = options.browserChannel;
  }
  return clean;
}

async function canonicalFuture(path) {
  let parent = resolve(path); const tail = [];
  while (true) {
    try { return resolve(await realpath(parent), ...tail); }
    catch (error) { if (error.code !== 'ENOENT') throw error; const next = dirname(parent); if (next === parent) throw error; tail.unshift(basename(parent)); parent = next; }
  }
}
const contains = (parent, child) => { const part = relative(parent, child); return part === '' || part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part); };
export async function createReportDirectory(path, root = workspace) {
  const candidate = await canonicalFuture(resolve(root, path));
  const anchors = [root, homedir(), tmpdir(), '/tmp', resolve(root, '.local'), resolve(root, '.local/evidence'), resolve(root, '.local/evidence/release'), resolve(root, '.local/evidence/T33'), resolve(root, 'docs/evidence'), resolve(root, 'docs/evidence/release'), resolve(root, 'docs/evidence/T33')];
  for (const anchor of anchors) if (contains(candidate, await canonicalFuture(anchor))) throw problem('unsafe-report', 'Use a new, specific child report directory, not a protected parent.');
  try { await lstat(candidate); throw problem('existing-report', 'The report directory must not already exist; prior evidence is preserved.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(dirname(candidate), { recursive: true });
  await mkdir(candidate, { mode: 0o700 });
  if (await realpath(candidate) !== candidate) throw problem('unsafe-report', 'The report directory must not redirect through another path.');
  return candidate;
}

export async function runChild(command, args, { cwd, env, logPath, timeoutMs, signal, limits = LIMITS }) {
  const started = performance.now(); const chunks = []; let logBytes = 0, truncated = false;
  let child, errorCode, timedOut = false, interrupted = false, termination, cleanupConfirmed = true;
  const footer = '[Log is sanitized and truncated to the configured output bounds]\n';
  const append = line => { const safe = redactOutput(line, env) + '\n'; if (logBytes + Buffer.byteLength(safe) > limits.logBytes - Buffer.byteLength(footer)) { truncated = true; return; } chunks.push(safe); logBytes += Buffer.byteLength(safe); };
  const makeSink = () => {
    const decoder = new StringDecoder('utf8'); let pending = '', discarded = false;
    const consume = (value, flush = false) => {
      const pieces = (pending + value).split('\n'); pending = flush ? '' : pieces.pop();
      for (const line of pieces) { if (!discarded && Buffer.byteLength(line) <= limits.lineBytes) append(line); else { append('[Overlong output line discarded]'); truncated = true; } discarded = false; }
      if (Buffer.byteLength(pending) > limits.lineBytes) { pending = ''; discarded = true; truncated = true; }
      if (flush && pending) { if (!discarded) append(pending); pending = ''; }
    };
    return { write: data => consume(decoder.write(data)), end: () => consume(decoder.end(), true) };
  };
  const stdout = makeSink(), stderr = makeSink();
  const groupAlive = () => { if (!child?.pid) return false; try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; } };
  const terminate = kind => {
    if (termination) return termination;
    if (kind === 'timeout') timedOut = true; else if (kind === 'interrupted') interrupted = true; else errorCode = 'descendants-remained';
    termination = (async () => {
      try {
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
          await new Promise(done => { const timer = setTimeout(() => { killer.kill(); done(); }, limits.killGraceMs); killer.once('error', () => { clearTimeout(timer); cleanupConfirmed = false; done(); }); killer.once('close', code => { clearTimeout(timer); if (code) cleanupConfirmed = false; done(); }); });
        } else { try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') cleanupConfirmed = false; } }
        await new Promise(done => setTimeout(done, limits.killGraceMs));
        if (groupAlive()) { try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') cleanupConfirmed = false; } }
        for (let attempt = 0; attempt < 10 && groupAlive(); attempt++) await new Promise(done => setTimeout(done, 20));
        if (groupAlive()) cleanupConfirmed = false;
      } catch { cleanupConfirmed = false; }
    })();
    return termination;
  };
  let timer, abort;
  const result = await new Promise(resolveResult => {
    try { child = spawn(command, args, { cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false }); }
    catch (error) { errorCode = error.code ?? 'spawn-error'; resolveResult({ code: null, signal: null }); return; }
    child.stdout.on('data', stdout.write); child.stderr.on('data', stderr.write);
    child.once('error', error => { errorCode = error.code ?? 'spawn-error'; });
    child.once('close', async (code, childSignal) => { clearTimeout(timer); if (abort) signal?.removeEventListener('abort', abort); if (!termination && groupAlive()) terminate('orphaned'); if (termination) await termination; resolveResult({ code, signal: childSignal }); });
    timer = setTimeout(() => terminate('timeout'), timeoutMs);
    abort = () => terminate(signal?.reason === 'deadline' ? 'timeout' : 'interrupted'); signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort();
  });
  stdout.end(); stderr.end();
  if (truncated) chunks.push(footer);
  const output = chunks.join(''); await writeFile(logPath, output); logBytes = Buffer.byteLength(output);
  return { ...result, errorCode: errorCode ?? null, timedOut, interrupted, cleanupConfirmed, durationMs: performance.now() - started, log: basename(logPath), logSanitized: true, logTruncated: truncated, logBytes };
}

async function readResponse(response, maximum) {
  if (Number(response.headers.get('content-length')) > maximum) throw problem('http-body-limit', 'A verification response exceeded the bounded body size.');
  const reader = response.body?.getReader(); if (!reader) return Buffer.alloc(0); const chunks = []; let size = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > maximum) throw problem('http-body-limit', 'A verification response exceeded the bounded body size.'); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}
async function request(options, path, type, signal, fetchImpl, limits) {
  const response = await fetchImpl(options.baseUrl + path, { redirect: 'manual', headers: { Accept: type }, signal: AbortSignal.any([signal, AbortSignal.timeout(limits.httpMs)]) });
  if (response.status !== 200 || !response.headers.get('content-type')?.includes(type)) throw problem('http-response', 'A verification endpoint returned an unexpected status or media type.');
  return readResponse(response, limits.responseBytes);
}

export function browserSummary(summary) {
  const counts = summary?.counts, keys = ['passed', 'failed', 'flaky', 'skipped', 'notRun', 'interrupted'];
  if (summary?.status !== 'passed' || summary.discoveryOnly !== false || !counts || keys.some(key => !Number.isSafeInteger(counts[key]) || counts[key] < 0) || counts.passed < 7 || keys.slice(1).some(key => counts[key] !== 0) || !Array.isArray(summary.globalErrors) || summary.globalErrors.length || !Array.isArray(summary.tests)) throw problem('browser-summary', 'The browser report must contain real passing execution without skips, retries, discovery-only or global errors.');
  if (summary.tests.length !== counts.passed || summary.tests.some(test => test.outcome !== 'passed' || test.attempts?.length !== 1 || test.attempts[0].status !== 'passed' || test.attempts[0].retry !== 0)) throw problem('browser-summary', 'Every selected browser case must execute once and pass.');
  if (CRITICAL_TITLES.some(title => summary.tests.filter(test => test.title.includes(title)).length !== 1) || summary.tests.filter(test => test.title.includes('@release-core')).length < 2) throw problem('browser-summary', 'The report must include all five critical journeys and at least two release-core cases.');
  return { counts, cases: summary.tests.map(test => ({ title: test.title, outcome: test.outcome })), durationMs: summary.duration };
}

function sourceProvenance(root) {
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8', timeout: 3000, maxBuffer: 1_048_576, stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').filter(Boolean);
    return { head, cleanAtStart: status.length === 0, trackedChanges: status.filter(line => !line.startsWith('??')).length, untrackedEntries: status.filter(line => line.startsWith('??')).length, note: 'Captured before creating this report directory; a working tree is not automatically a clean-checkout proof.' };
  } catch { return { head: null, cleanAtStart: null, note: 'Git provenance unavailable; no clean-checkout claim.' }; }
}

/** Verification never provisions/restarts/resets Docker or an existing database. */
export async function verifyRelease(options, { root = workspace, env = process.env, fetchImpl = fetch, runCommand = runChild, limits = LIMITS, signal: externalSignal } = {}) {
  options = validateOptions(options, env);
  const provenance = sourceProvenance(root);
  const reportDir = await createReportDirectory(options.reportDir, root); options = { ...options, reportDir };
  const controller = new AbortController(); const overall = setTimeout(() => controller.abort('deadline'), options.profile === 'quality' ? limits.qualityMs : limits.smokeMs);
  const abort = () => controller.abort('interrupted'); externalSignal?.addEventListener('abort', abort, { once: true }); if (externalSignal?.aborted) abort();
  const report = { schemaVersion: 1, runId: randomUUID(), startedAt: new Date().toISOString(), finishedAt: null, status: 'running', profile: options.profile, baseUrl: options.baseUrl, adminBaseUrl: options.adminBaseUrl, source: provenance, node: process.version, platform: process.platform, browser: { engine: 'chromium', requestedChannel: options.browserChannel ?? 'bundled' }, coverage: { completeReleaseProof: false, sourceQualitySelected: options.profile === 'quality', postgresSelected: options.postgres, excluded: ['Docker provisioning and fresh-start proof', 'API/stack restart and failed-initializer rehearsal', 'physical devices and assistive-technology speech', 'full visual/performance matrix unless separately run'] }, output: { directory: reportDir, commandLogs: 'sanitized, bounded UTF-8 lines' }, gates: gateNames.map(id => ({ id, status: id === 'postgres' && !options.postgres || ['source-quality', 'tool-contracts'].includes(id) && options.profile !== 'quality' ? 'skipped' : 'not_run', reason: id === 'postgres' && !options.postgres ? 'Not selected. --postgres requires an existing explicit validated TEST_DATABASE_URL; no database was created or reset.' : ['source-quality', 'tool-contracts'].includes(id) && options.profile !== 'quality' ? 'Smoke does not run source-quality/tool gates; select quality explicitly.' : 'Not reached.' })) };
  const persist = () => writeFile(resolve(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const child = async (gate, script, args, timeoutMs, command = process.execPath) => {
    const argv = [script, ...args];
    const result = await runCommand(command, argv, { cwd: root, env: childEnvironment(options, env, gate), logPath: resolve(reportDir, gate + '.log'), timeoutMs, signal: controller.signal, limits });
    const status = result.timedOut ? 'timed_out' : result.interrupted ? 'interrupted' : result.code === 0 && !result.errorCode && result.cleanupConfirmed ? 'passed' : 'failed';
    return { status, command: [command === process.execPath ? 'node' : command, ...argv], ...result };
  };
  try {
    const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
    if (pkg.engines?.node !== process.versions.node) throw problem('node-version', 'Use the exact Node version pinned in package.json before release verification.');
    await persist();
    for (const gate of report.gates) {
      if (controller.signal.aborted) break;
      if (gate.status === 'skipped') continue;
      gate.startedAt = new Date().toISOString(); const start = performance.now();
      const gateController = new AbortController();
      const gateTimer = ['health', 'packaged-assets'].includes(gate.id) ? setTimeout(() => gateController.abort('deadline'), gate.id === 'health' ? limits.healthMs : limits.assetsMs) : undefined;
      const gateSignal = AbortSignal.any([controller.signal, gateController.signal]);
      try {
        if (gate.id === 'health') {
          const results = [];
          for (const [path, status] of [['/api/health/live', 'ok'], ['/api/health/ready', 'ready']]) { const bytes = await request(options, path, 'application/json', gateSignal, fetchImpl, limits); let body; try { body = JSON.parse(bytes); } catch { throw problem('http-json', 'A health endpoint returned invalid JSON.'); } if (body.status !== status || status === 'ready' && ['database', 'migrations', 'seed'].some(key => body[key] !== 'ready')) throw problem('not-ready', 'The API/database/migration/seed readiness gate did not pass.'); results.push({ path, status: body.status }); }
          Object.assign(gate, { status: 'passed', results });
        } else if (gate.id === 'packaged-assets') {
          const results = [], scripts = new Set();
          for (const [path, language, origin] of [['/', 'fa', options.baseUrl], ['/admin/', 'en', options.adminBaseUrl]]) {
            const bytes = await request({ ...options, baseUrl: origin }, path, 'text/html', gateSignal, fetchImpl, limits), html = bytes.toString();
            if (!new RegExp(`lang=["']${language}["']`).test(html) || html.includes('@vite/client')) throw problem('frontend-mode', 'Expected packaged Persian consumer and English admin frontends, not a development shell.');
            const entries = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(match => new URL(match[1], origin));
            if (!entries.some(url => /\/assets\/[^/]+\.js$/.test(url.pathname))) throw problem('frontend-entry', 'A packaged frontend JavaScript entry is missing.');
            for (const url of entries) { if (url.origin !== origin || url.search || url.hash || !/^(?:\/admin)?\/(?:assets\/[^/]+\.js|theme-init\.js)$/.test(url.pathname)) throw problem('remote-startup', 'Startup scripts must be local packaged assets.'); scripts.add(url.href); }
            results.push({ path, language, sha256: sha256(bytes) });
          }
          for (const href of scripts) { const url = new URL(href), path = url.pathname; const bytes = await request({ ...options, baseUrl: url.origin }, path, 'javascript', gateSignal, fetchImpl, limits); if (!bytes.length) throw problem('empty-script', 'A packaged startup script is empty.'); results.push({ path, bytes: bytes.length, sha256: sha256(bytes) }); }
          for (const path of ['/theme-init.js', '/fonts/Vazirmatn-wght.woff2', '/fonts/InterVariable.woff2', '/geography/consumer-geography.json', '/geography/route-geometry.json']) {
            const response = await fetchImpl(options.baseUrl + path, { redirect: 'manual', signal: AbortSignal.any([gateSignal, AbortSignal.timeout(limits.httpMs)]) });
            if (response.status !== 200) throw problem('local-asset', 'A required local startup asset is unavailable.'); const bytes = await readResponse(response, limits.responseBytes), expected = await readFile(resolve(root, 'assets', path.slice(1)));
            if (sha256(bytes) !== sha256(expected)) throw problem('local-asset-mismatch', 'A served startup asset differs from this checkout.'); results.push({ path, bytes: bytes.length, sha256: sha256(bytes), matchesCheckout: true });
          }
          Object.assign(gate, { status: 'passed', results });
        } else if (gate.id === 'dependencies') {
          Object.assign(gate, await child(gate.id, '--config.verify-deps-before-run=error', ['exec', 'node', '--version'], limits.dependenciesMs, 'pnpm'));
          if (gate.status !== 'passed') gate.reason = 'Strict host dependency verification failed. Install this checkout with pinned pnpm install --frozen-lockfile; no host install was performed.';
          else {
          try { await readFile(resolve(root, 'node_modules/@playwright/test/package.json')); await readFile(resolve(root, 'node_modules/nx/dist/bin/nx.js')); }
          catch { throw problem('missing-source-dependencies', 'Host verification dependencies are missing. Install this checkout with pinned pnpm install --frozen-lockfile; Docker-only application startup does not need host node_modules.'); }
          gate.note = 'Strict pnpm builtins guard passed and required host verification files are present; quality additionally verifies the actual source script with strict installed-state policy.';
          }
        } else if (gate.id === 'source-quality') Object.assign(gate, await child(gate.id, '--config.verify-deps-before-run=error', ['verify', '--parallel=1', '--output-style=static'], limits.sourceMs, 'pnpm'));
        else if (gate.id === 'tool-contracts') Object.assign(gate, await child(gate.id, '--test', ['--test-concurrency=1', 'tools/test-docker-runner.mjs', 'tools/test-dev-api.mjs', 'tools/test-test-database.mjs', 'tools/test-performance-audit.mjs', 'tools/test-admin-schema-bundling.mjs', 'tools/test-verify-release.mjs'], limits.toolsMs));
        else if (gate.id === 'postgres') Object.assign(gate, await child(gate.id, 'node_modules/nx/dist/bin/nx.js', ['run', 'api:test-integration', '--skip-nx-cache', '--output-style=stream'], limits.postgresMs));
        else {
          Object.assign(gate, await child(gate.id, 'node_modules/@playwright/test/cli.js', ['test', '--config', 'tests/e2e/playwright.config.ts', '--grep', BROWSER_GREP, '--workers=1', '--retries=0', '--trace=off'], limits.browserMs));
          if (gate.status === 'passed') { let summary; try { summary = JSON.parse(await readFile(resolve(reportDir, 'browser/artifacts/run-summary.json'), 'utf8')); } catch { throw problem('missing-browser-summary', 'The actual executed browser report is missing.'); } gate.executed = browserSummary(summary); }
        }
      } catch (error) { Object.assign(gate, { status: gateSignal.aborted || error.name === 'TimeoutError' ? controller.signal.reason === 'interrupted' ? 'interrupted' : 'timed_out' : 'failed', errorCode: error.code ?? error.cause?.code ?? 'verification-error', reason: redactOutput(error.code ? error.message : 'Verification operation failed; inspect its sanitized bounded log.', env) }); }
      if (gate.status === 'passed') delete gate.reason;
      clearTimeout(gateTimer);
      gate.durationMs = performance.now() - start; gate.finishedAt = new Date().toISOString(); await persist();
      if (gate.status !== 'passed') break;
    }
    const failed = report.gates.some(gate => ['failed', 'timed_out', 'interrupted'].includes(gate.status));
    report.status = controller.signal.reason === 'interrupted' ? 'interrupted' : failed || report.gates.some(gate => gate.status === 'not_run') ? 'failed' : 'passed';
    if (!options.postgres || options.profile === 'smoke') report.coverage.note = 'Partial verification scope: passed selected gates are not full release certification.';
  } catch (error) { report.status = 'failed'; report.setupError = { code: error.code ?? 'setup-error', message: redactOutput(error.code ? error.message : 'Verification setup failed.', env) }; }
  finally { clearTimeout(overall); externalSignal?.removeEventListener('abort', abort); report.finishedAt = new Date().toISOString(); await persist(); }
  return report;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) { console.log('Usage: pnpm verify:release --base-url http://127.0.0.1:PORT --report-dir NEW_RUN_FOLDER [--admin-url http://127.0.0.1:ADMIN_PORT] [--profile smoke|quality] [--browser-channel chrome|chromium|msedge] [--postgres]\nSmoke checks packaged readiness/assets and seven safe critical/core browser cases. Quality also runs fixed sequential source/tool checks. --postgres uses only an explicitly configured existing TEST_DATABASE_URL. No Docker provisioning, restart, shutdown or reset is performed.'); return; }
    const controller = new AbortController(); const stop = () => controller.abort(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
    let report;
    try { report = await verifyRelease(options, { signal: controller.signal }); }
    finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
    for (const gate of report.gates) console.log(`${gate.status.toUpperCase()} ${gate.id}${gate.durationMs === undefined ? '' : ` (${Math.round(gate.durationMs)}ms)`}`);
    console.log(`Selected ${report.profile} verification: ${report.status}. Report: ${resolve(report.output.directory, 'report.json')}`);
    process.exitCode = report.status === 'passed' ? 0 : report.status === 'interrupted' ? 130 : 1;
  } catch (error) { console.error(redactOutput(error.code ? error.message : 'Release verification configuration failed.')); process.exitCode = 2; }
}
if (process.argv[1] && await realpath(process.argv[1]).catch(() => resolve(process.argv[1])) === await realpath(fileURLToPath(import.meta.url))) await main();
