import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// Retained command name for existing maintainer workflows; verifies the current product.
// Reject ownership mistakes before any Docker operation, especially full recreation.
const project = process.env.COMPOSE_PROJECT_NAME;
const owner = process.env.TOROBTICKET_VERIFY_OWNER;
assert.match(project ?? '', /^torobticket-t29-[a-z0-9-]+$/, 'Use an explicitly owned disposable T29 project');
assert.match(owner ?? '', /^t29-[a-z0-9-]+$/, 'Set TOROBTICKET_VERIFY_OWNER to the exact resource label');
const port = Number(process.env.TOROBTICKET_PORT);
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536 && port !== 4300, 'Use a non-default disposable loopback port');
const base = `http://127.0.0.1:${port}`;
function docker(args, capture = true) {
  const result = spawnSync('docker', args, { encoding: 'utf8', env: process.env, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  assert.equal(result.status, 0, capture ? result.stderr : `docker ${args.join(' ')} failed`);
  return result.stdout;
}
function assertOwned() {
  const ids = docker(['compose', 'ps', '-aq']).trim().split(/\s+/).filter(Boolean);
  assert.equal(ids.length, 4, 'Expected four owned services');
  for (const container of JSON.parse(docker(['inspect', ...ids]))) {
    assert.equal(container.Config.Labels['com.docker.compose.project'], project);
    assert.equal(container.Config.Labels['torobticket.owner'], owner);
  }
  const volume = JSON.parse(docker(['volume', 'inspect', `${project}_database`]))[0];
  assert.equal(volume.Labels['com.docker.compose.project'], project);
  assert.equal(volume.Labels['torobticket.owner'], owner);
}
assertOwned();
async function request(path, options = {}) {
  return fetch(base + path, { ...options, signal: AbortSignal.timeout(10000) });
}
async function get(path, cookie) {
  const response = await request(path, { headers: cookie ? { cookie } : {} });
  assert.equal(response.status, 200, path);
  return response;
}
async function post(path, body, cookie) {
  return request(path, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
}
function query(sql) {
  return docker(['compose', 'exec', '-T', 'database', 'psql', '-U', 'torobticket', '-d', 'torobticket', '-Atc', sql]).trim();
}
for (const path of ['/api/health/live', '/api/health/ready']) {
  const body = await (await get(path)).json(); assert.match(body.status, /^(ok|ready)$/); console.log('PASS health', path);
}
const redirect = await request('/admin', { redirect: 'manual' });
assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/admin/');
console.log('PASS admin base redirect');
for (const [path, language] of [['/', 'fa'], ['/search/deep/link', 'fa'], ['/provider-demo/receipt', 'fa'], ['/admin/', 'en'], ['/admin/providers/deep', 'en']]) {
  const response = await get(path), html = await response.text();
  assert.match(html, new RegExp(`lang="${language}"`)); assert.equal(response.headers.get('cache-control'), 'no-cache');
  const asset = html.match(/src="([^"]*\/assets\/[^\"]+\.js)"/)?.[1]; assert.ok(asset, `Built asset in ${path}`);
  const script = await get(asset); assert.match(script.headers.get('content-type'), /javascript/); assert.equal(script.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  console.log('PASS SPA, revalidated HTML and immutable built script', path);
}
for (const prefix of ['', '/admin']) {
  for (const asset of ['/theme-init.js', '/fonts/Vazirmatn-wght.woff2', '/fonts/InterVariable.woff2', '/geography/consumer-geography.json', '/geography/route-geometry.json', '/geography/destination-landmarks.geojson', '/ground-operators/manifest.json', '/ground-operators/raja-64.png', '/ground-operators/iran-peyma-64.png', '/licenses/maplibre-gl-6.16.0.txt', '/licenses/osm-vector-notice.md', '/provenance.json']) {
    const response = await get(prefix + asset);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(`assets${asset}`)); assert.equal(response.headers.get('cache-control'), 'no-cache');
    console.log('PASS local asset exact bytes and revalidation', prefix + asset);
  }
  for (const asset of ['/assets/missing.js', '/fonts/missing.woff2', '/airlines/missing.png', '/ground-operators/missing.png', '/geography/missing.json', '/licenses/missing.txt']) {
    const response = await request(prefix + asset); assert.equal(response.status, 404); assert.doesNotMatch(response.headers.get('content-type') ?? '', /text\/html/);
    console.log('PASS missing static asset404', prefix + asset);
  }
}
const unknownApi = await request('/api/v1/not-a-route'); assert.equal(unknownApi.status, 404); assert.match(unknownApi.headers.get('content-type'), /application\/json/);
const guarded = await request('/api/v1/searches/not-owned/events'); assert.equal(guarded.status, 401); assert.match(guarded.headers.get('content-type'), /application\/json/);
console.log('PASS actual API JSON404 and guarded stream401');

const create = await post('/api/v1/demo/session', { seed: 2929, anchorInstant: '2026-10-25T00:00:00.000Z' });
assert.equal(create.status, 201);
const cookie = create.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie); // Never print credentials.
const initial = await create.json();
const catalog = await (await get('/api/v1/catalog', cookie)).json();
assert.equal(catalog.fixtureVersion, 'showcase-v3'); assert.equal(catalog.cities.length, 34); assert.ok(catalog.supportedConnections.length > 122);
const missingOwned = await request('/api/v1/searches/not-owned/events', { headers: { cookie } }); assert.equal(missingOwned.status, 404); assert.match(missingOwned.headers.get('content-type'), /application\/json/);
console.log('PASS rich catalog and scoped unknown stream404');
const started = await post('/api/v1/searches', { clientGeneration: 't29-packaged', query: { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' } }, cookie);
assert.equal(started.status, 201); const start = await started.json(); const id = start.snapshot.searchId;
const beforeStream = Date.now(); const stream = await get(`/api/v1/searches/${id}/events`, cookie);
assert.match(stream.headers.get('content-type'), /text\/event-stream/); assert.equal(stream.headers.get('x-accel-buffering'), 'no');
const reader = stream.body.getReader(), decoder = new TextDecoder(); let buffer = '', firstEventMs; const events = [];
while (true) {
  const { done, value } = await reader.read(); if (done) break;
  buffer += decoder.decode(value, { stream: true });
  let split;
  while ((split = buffer.indexOf('\n\n')) >= 0) {
    const frame = buffer.slice(0, split); buffer = buffer.slice(split + 2);
    const line = frame.split('\n').find(part => part.startsWith('data: ')); if (!line) continue;
    const event = JSON.parse(line.slice(6)); assert.equal(event.searchId, id); assert.equal(event.clientGeneration, 't29-packaged'); assert.equal(event.sequence, events.length + 1);
    if (firstEventMs === undefined) firstEventMs = Date.now() - beforeStream;
    events.push(event);
  }
}
assert.ok(events.length > 1); assert.ok(firstEventMs < 5000, 'An actual data frame must arrive before the bounded request timeout'); assert.equal(events.at(-1).type, 'terminal'); assert.equal(events.at(-1).payload.status, 'complete');
const completed = await (await get(`/api/v1/searches/${id}`, cookie)).json(); assert.ok(completed.snapshot.groups.length > 0); assert.deepEqual(events.at(-1).payload, completed.snapshot);
console.log('PASS real gateway SSE first data frame, ordered events and completed projection', JSON.stringify({ firstEventMs, events: events.length, status: completed.snapshot.status, groups: completed.snapshot.groups.length }));
const replay = await get(`/api/v1/searches/${id}/events`, cookie); const replayBody = await replay.text(); assert.match(replayBody, /"type":"terminal"/);
console.log('PASS completed SSE replay');
const rows = () => query('SELECT id, "createdAt" FROM "DemoSession" ORDER BY id;');
const persistedRows = rows();
const counts = () => query('SELECT count(*) FROM "FixtureVersion"; SELECT count(*) FROM "Place"; SELECT count(*) FROM "Hotel"; SELECT count(*) FROM "RoomRate"; SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;');
assert.equal(counts(), '4\n316\n1246\n3738\n3');
assertOwned();
// Recreate all owned containers without deleting the named volume, then use the actual root runner again.
docker(['compose', 'down'], false);
const restart = spawnSync('pnpm', ['docker:up'], { env: process.env, stdio: 'inherit' }); assert.equal(restart.status, 0);
assertOwned();
const resume = await post('/api/v1/demo/session', {}, cookie); assert.equal(resume.status, 201); assert.equal(resume.headers.get('set-cookie'), null, 'Valid resume must not echo an obsolete credential');
const resumed = await resume.json();
const { expiresAt: oldExpiry, ...oldState } = initial, { expiresAt: newExpiry, ...newState } = resumed;
assert.deepEqual(newState, oldState); assert.ok(Date.parse(newExpiry) >= Date.parse(oldExpiry)); assert.equal(rows(), persistedRows); assert.equal(counts(), '4\n316\n1246\n3738\n3');
assert.deepEqual(await (await get(`/api/v1/searches/${id}`, cookie)).json(), completed);
console.log('PASS same session row, complete immutable search and three migrations survive repeated initialization/container recreation');
const reset = await post('/api/v1/admin/reset', {}, cookie); assert.equal(reset.status, 201); // Scope-only cleanup; fixture volume remains for independent acceptance.
console.log('PASS explicit owned reviewer reset201');
docker(['compose', 'ps', '--all'], false); docker(['compose', 'exec', '-T', 'api', 'node', '-p', 'process.version + " " + process.arch'], false);
console.log('PASS current T29 packaged acceptance; full browser/offline/lifecycle release rehearsal remains T33.');
