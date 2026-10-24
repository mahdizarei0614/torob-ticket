import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const project = process.env.COMPOSE_PROJECT_NAME;
assert.match(project ?? '', /^torobticket-t29-/, 'Use only an owned disposable T29 project');
const base = `http://127.0.0.1:${process.env.TOROBTICKET_PORT}`;
async function get(path) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200, path);
  return response;
}
for (const path of ['/api/health/live', '/api/health/ready']) {
  const body = await (await get(path)).json();
  assert.match(body.status, /^(ok|ready)$/);
  console.log('PASS health', path, body);
}
const adminRedirect = await fetch(base + '/admin', { redirect: 'manual' });
assert.equal(adminRedirect.status, 308);
assert.equal(adminRedirect.headers.get('location'), '/admin/');
console.log('PASS admin base redirect');
for (const [path, language] of [['/', 'fa'], ['/search/deep/link', 'fa'], ['/provider-demo/receipt', 'fa'], ['/admin/', 'en'], ['/admin/providers/deep', 'en']]) {
  const response = await get(path);
  const html = await response.text();
  assert.match(html, new RegExp(`lang="${language}"`));
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  const asset = html.match(/src="([^"]*\/assets\/[^\"]+\.js)"/)?.[1];
  assert.ok(asset, `Built asset in ${path}`);
  const script = await get(asset);
  assert.equal(script.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  console.log('PASS SPA and immutable asset', path, asset);
}
for (const prefix of ['', '/admin']) {
  for (const asset of ['/theme-init.js', '/fonts/Vazirmatn-wght.woff2', '/fonts/InterVariable.woff2']) {
    const response = await get(prefix + asset);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(`assets${asset}`));
    assert.equal(response.headers.get('cache-control'), 'no-cache');
    console.log('PASS local asset bytes and revalidation', prefix + asset);
  }
  assert.equal((await fetch(base + prefix + '/assets/missing.js')).status, 404);
}
for (const path of ['/api/v1/not-a-route', '/api/v1/searches/unimplemented/events']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const body = await response.json();
  assert.equal(body.statusCode, 404);
  console.log('PASS JSON 404 (no fabricated endpoint)', path);
}
const create = await fetch(base + '/api/v1/demo/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seed: 2929, anchorInstant: '2026-10-24T12:00:00.000Z' }) });
assert.equal(create.status, 201);
const cookie = create.headers.get('set-cookie').split(';')[0];
const initial = await create.json();
function sessionRows() {
  const result = spawnSync('docker', ['compose', 'exec', '-T', 'database', 'psql', '-U', 'torobticket', '-d', 'torobticket', '-Atc', 'SELECT id, "createdAt" FROM "DemoSession" ORDER BY id;'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
const persistedRows = sessionRows();
console.log('Created current session', initial);
function command(args) {
  const result = spawnSync(args[0], args.slice(1), { stdio: 'inherit', env: process.env });
  assert.equal(result.status, 0, args.join(' '));
}
// Restart the entire project without deleting its volume; rerun the root startup.
command(['docker', 'compose', 'down']);
command(['pnpm', 'docker:up']);
const resume = await fetch(base + '/api/v1/demo/session', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}' });
assert.equal(resume.status, 201);
const resumed = await resume.json();
const { expiresAt: originalExpiry, ...originalState } = initial;
const { expiresAt: resumedExpiry, ...resumedState } = resumed;
assert.deepEqual(resumedState, originalState);
assert.ok(Date.parse(resumedExpiry) >= Date.parse(originalExpiry), 'Resume renews inactivity expiry');
assert.equal(resume.headers.get('set-cookie').split(';')[0], cookie);
assert.equal(sessionRows(), persistedRows, 'Same persisted session row id and creation time');
console.log('PASS current session cookie, stable state and DB row identity persisted after full container recreation; inactivity expiry renewed');
const counts = spawnSync('docker', ['compose', 'exec', '-T', 'database', 'psql', '-U', 'torobticket', '-d', 'torobticket', '-Atc', 'SELECT count(*) FROM "FixtureVersion"; SELECT count(*) FROM "_prisma_migrations";'], { encoding: 'utf8' });
assert.equal(counts.status, 0, counts.stderr);
assert.equal(counts.stdout.trim(), '2\n2');
console.log('PASS repeated initialization: two immutable fixture roots (foundation/showcase) and two completed migrations');
command(['docker', 'compose', 'ps', '--all']);
command(['docker', 'compose', 'exec', '-T', 'api', 'node', '-p', 'process.version + " " + process.arch']);
command(['docker', 'compose', 'exec', '-T', 'api', 'openssl', 'version']);
console.log('PASS early foundation acceptance; T05 inventory is seeded; search/SSE, map rendering/art and full T33 remain pending.');
