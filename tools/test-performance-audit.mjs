import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createServer, request } from 'node:http';
import { measureApp, staticClosure, deferredFamily, htmlScripts } from './measure-bundles.mjs';
import { createAuditServer } from './serve-performance-audit.mjs';

async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), 't32-bundle-tool-'));
  const root = join(folder, 'web'); await mkdir(join(root, '.vite'), { recursive: true });
  const manifest = {
    'index.html': { file: 'entry.js', isEntry: true, imports: ['shared'], dynamicImports: ['../../libs/graphics/scene.ts', '../../node_modules/maplibre-gl/sdk.js', 'hotel-dialog'] },
    shared: { file: 'shared.js' },
    '../../libs/graphics/scene.ts': { file: 'graphics.js', imports: ['shared', 'index.html'], dynamicImports: ['bloom'] },
    bloom: { file: 'bloom.js', imports: ['shared'] },
    '../../node_modules/maplibre-gl/sdk.js': { file: 'sdk.js', imports: ['shared'], assets: ['worker.js'], css: ['sdk.css'] },
    'hotel-dialog': { file: 'hotel.js', imports: ['shared'] },
  };
  const bodies = { 'entry.js': 'entry'.repeat(30), 'shared.js': 'shared'.repeat(10), 'graphics.js': 'graphics'.repeat(15), 'bloom.js': 'bloom'.repeat(11), 'sdk.js': 'sdk'.repeat(40), 'worker.js': 'worker'.repeat(100), 'hotel.js': 'hotel'.repeat(12), 'sdk.css': '.sdk{}', 'theme-init.js': 'theme();' };
  for (const [file, body] of Object.entries(bodies)) await writeFile(join(root, file), body);
  await writeFile(join(root, 'index.html'), '<script src="/theme-init.js"></script><script type="module" src="/entry.js"></script>');
  const save = () => writeFile(join(root, '.vite/manifest.json'), JSON.stringify(manifest)); await save();
  return { folder, root, manifest, bodies, save, close: () => rm(folder, { recursive: true, force: true }) };
}

test('static closure deduplicates shared/cyclic imports and rejects missing imports', () => {
  const graph = { a: { imports: ['b'] }, b: { imports: ['a'] } };
  assert.deepEqual([...staticClosure(graph, ['a', 'b'])].sort(), ['a', 'b']);
  assert.throws(() => staticClosure({ a: { imports: ['missing'] } }, ['a']), /Missing manifest import/);
});
test('graphics family includes nested lazy work without inheriting the shared entry unrelated features', () => {
  const graph = { entry: { dynamicImports: ['graphics', 'sdk'] }, graphics: { imports: ['entry'], dynamicImports: ['bloom'] }, bloom: {}, sdk: {} };
  assert.deepEqual([...deferredFamily(graph, ['graphics'], new Set(['entry']))].sort(), ['bloom', 'entry', 'graphics']);
});
test('HTML audit includes classic scripts/modulepreloads, excludes data scripts and rejects remote scripts', () => {
  const got = htmlScripts('<script src="/admin/theme.js"></script><script type="application/ld+json">{}</script><script>run()</script><link rel="modulepreload" href="/admin/shared.js">', '/admin/');
  assert.deepEqual(got.files, ['theme.js', 'shared.js']); assert.equal(got.inline[0].toString(), 'run()');
  assert.throws(() => htmlScripts('<script src="https://example.com/unknown.js"></script>'), /Remote initial/);
});
test('actual emitted gzip sums retain classic boot, nested graphics, SDK worker and other lazy app costs once', async () => {
  const f = await fixture();
  try {
    const r = await measureApp(f.root), gzip = files => files.reduce((total, file) => total + gzipSync(f.bodies[file], { level: 9 }).length, 0);
    assert.equal(r.initialJsGzipBytes, gzip(['entry.js', 'shared.js', 'theme-init.js']));
    assert.equal(r.deferredGraphicsJsGzipBytes, gzip(['graphics.js', 'bloom.js']));
    assert.equal(r.mapLibreJsGzipBytes, gzip(['sdk.js', 'worker.js']));
    assert.equal(r.otherDeferredAppJsGzipBytes, gzip(['hotel.js']));
    assert.equal(r.initialAndAllDeferredUnionJsGzipBytes, gzip(Object.keys(f.bodies).filter(file => file.endsWith('.js'))));
    assert.equal(r.totalEmittedJsGzipBytes, r.initialAndAllDeferredUnionJsGzipBytes); assert.deepEqual(r.unassignedJs, []);
    assert.equal(r.mapLibreCss[0].file, 'sdk.css'); assert.equal(r.graphicsAlreadyInitialJs.length, 2);
  } finally { await f.close(); }
});
test('preloaded manifest code becomes initial and its dynamic children stay reachable', async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, 'index.html'), '<script type="module" src="/entry.js"></script><script src="/theme-init.js"></script><link rel="modulepreload" href="/graphics.js">');
    const r = await measureApp(f.root); assert.ok(r.initialJs.some(row => row.file === 'graphics.js')); assert.deepEqual(r.graphicsIncrementalJs.map(row => row.file), ['bloom.js']);
  } finally { await f.close(); }
});
test('missing dynamic imports and build-directory escapes cannot become passing budget reports', async () => {
  const f = await fixture();
  try {
    f.manifest['index.html'].dynamicImports.push('absent'); await f.save(); await assert.rejects(measureApp(f.root), /Missing manifest import/);
    f.manifest['index.html'].dynamicImports.pop(); f.manifest['index.html'].file = '../outside.js'; await writeFile(join(f.folder, 'outside.js'), 'not emitted here'); await f.save();
    await assert.rejects(measureApp(f.root), /escapes build directory/);
  } finally { await f.close(); }
});

const listen = server => new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => done(server.address().port)); });
const call = (port, path, headers = {}, method = 'GET') => new Promise((done, reject) => {
  const req = request({ hostname: '127.0.0.1', port, path, method, headers }, response => { const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => done({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) })); }); req.on('error', reject); req.end();
});
test('isolated server serves correct app shells/assets/gzip and proxies actual stream/headers without manufacturing identity', async () => {
  const f = await fixture(), admin = join(f.folder, 'admin'); await mkdir(admin); await writeFile(join(admin, 'index.html'), 'ADMIN');
  const received = []; const upstream = createServer((req, res) => { received.push({ path: req.url, host: req.headers.host, origin: req.headers.origin, cookie: req.headers.cookie }); res.writeHead(201, { 'Set-Cookie': 'owned-fixture=opaque; Path=/; HttpOnly', 'Content-Type': 'application/json' }); res.write('{"actual":'); res.end('true}'); });
  const apiPort = await listen(upstream); const audit = await createAuditServer({ web: f.root, admin, api: `http://127.0.0.1:${apiPort}` }); const port = await listen(audit.server);
  try {
    const web = await call(port, '/?q=travel', { Accept: 'text/html' }); assert.equal(web.status, 200); assert.match(web.body.toString(), /entry.js/);
    const app = await call(port, '/admin/searches/id', { Accept: 'text/html' }); assert.equal(app.body.toString(), 'ADMIN');
    assert.equal((await call(port, '/admin')).headers.location, '/admin/');
    const zipped = await call(port, '/entry.js', { 'Accept-Encoding': 'br, gzip' }); assert.equal(zipped.headers['content-encoding'], 'gzip'); assert.equal(gunzipSync(zipped.body).toString(), f.bodies['entry.js']); assert.equal(zipped.body.length, gzipSync(Buffer.from(f.bodies['entry.js']), { level: 9 }).length);
    const identity = await call(port, '/entry.js', { 'Accept-Encoding': 'gzip;q=0' }); assert.equal(identity.headers['content-encoding'], undefined); assert.equal(identity.body.toString(), f.bodies['entry.js']);
    const head = await call(port, '/entry.js', { 'Accept-Encoding': 'gzip' }, 'HEAD'); assert.equal(head.body.length, 0); assert.equal(Number(head.headers['content-length']), zipped.body.length);
    const response = await call(port, '/api/v1/owned?x=1', { Host: '127.0.0.1:4307', Origin: 'http://127.0.0.1:4307', Cookie: 'owned-fixture=opaque' }, 'POST');
    assert.equal(response.status, 201); assert.deepEqual(JSON.parse(response.body), { actual: true }); assert.deepEqual(received, [{ path: '/api/v1/owned?x=1', host: '127.0.0.1:4307', origin: 'http://127.0.0.1:4307', cookie: 'owned-fixture=opaque' }]); assert.match(response.headers['set-cookie'][0], /HttpOnly/);
    assert.equal((await call(port, '/missing.js', { Accept: 'text/html' })).status, 404); assert.equal((await call(port, '/.vite/manifest.json')).status, 400);
    await symlink(join(f.folder, 'outside.js'), join(f.root, 'escape.js')); await writeFile(join(f.folder, 'outside.js'), 'outside'); assert.equal((await call(port, '/escape.js')).status, 404);
    assert.equal((await call(port, '/entry.js', {}, 'POST')).status, 405); assert.equal((await call(port, '/%ZZ')).status, 400);
  } finally { await audit.close(); await new Promise(done => upstream.close(done)); await f.close(); }
});
