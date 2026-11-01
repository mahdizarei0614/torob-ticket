import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {test} from 'node:test';
import {build, createServer} from 'vite';
import {publicAssetFallback} from './vite-public-assets.mts';

async function fixture(base, fenced, run) {
  const root = await mkdtemp(resolve(tmpdir(), 't30-vite-assets-'));
  let server;
  try {
    await mkdir(resolve(root, 'public/brand'), {recursive: true});
    await mkdir(resolve(root, 'src'));
    await writeFile(resolve(root, 'index.html'), `<!doctype html><html><head>
<link rel="icon" href="%BASE_URL%brand/logo.png" data-light-src="%BASE_URL%brand/logo.svg">
<link rel="apple-touch-icon" href="%BASE_URL%brand/logo.png">
<link rel="mask-icon" href="%BASE_URL%brand/logo.svg">
<link rel="manifest" href="%BASE_URL%site.webmanifest">
<link rel="stylesheet" href="/src/style.css">
</head><body>owned-spa-proof<script type="module" src="/src/main.js"></script></body></html>`);
    await writeFile(resolve(root, 'src/main.js'), 'export const authority = "source-proof"; document.documentElement.dataset.ownedModule = authority;');
    await writeFile(resolve(root, 'src/style.css'), ':root { --owned-css-proof: 1; }');
    await writeFile(resolve(root, 'public/brand/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    await writeFile(resolve(root, 'public/brand/logo.png'), png);
    await writeFile(resolve(root, 'public/site.webmanifest'), JSON.stringify({name: 'owned-manifest'}));
    const api = {name: 'owned-api-proof', configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.includes('/api/proof.png')) return next();
        response.statusCode = 418; response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify({authority: 'api-proof'}));
      });
    }};
    server = await createServer({configFile: false, root, base, publicDir: 'public', cacheDir: resolve(root, '.vite'), logLevel: 'silent', plugins: [api, ...(fenced ? [publicAssetFallback()] : [])], server: {host: '127.0.0.1', port: 0, strictPort: true}});
    await server.listen();
    const address = server.httpServer.address();
    assert.ok(address && typeof address !== 'string');
    await run((path, init) => fetch(`http://127.0.0.1:${address.port}${base}${path}`, init));
    if (fenced) {
      await server.close(); server = undefined;
      const outDir = resolve(root, 'built');
      await build({configFile: false, root, base, publicDir: 'public', logLevel: 'silent', plugins: [publicAssetFallback()], build: {outDir, emptyOutDir: true}});
      const html = await readFile(resolve(outDir, 'index.html'), 'utf8');
      assert.deepEqual(publicHeadPaths(html), [base+'brand/logo.png', base+'brand/logo.png', base+'brand/logo.svg', base+'site.webmanifest']);
      assert.ok(html.includes(`data-light-src="${base}brand/logo.svg"`));
      assert.ok(!html.includes('%BASE_URL%'));
      const outputs = await readdir(resolve(outDir, 'assets'));
      assert.ok(outputs.some(name => name.endsWith('.css')));
      assert.ok(outputs.some(name => name.endsWith('.js')));
      const css = await Promise.all(outputs.filter(name => name.endsWith('.css')).map(name => readFile(resolve(outDir, 'assets', name), 'utf8')));
      const js = await Promise.all(outputs.filter(name => name.endsWith('.js')).map(name => readFile(resolve(outDir, 'assets', name), 'utf8')));
      assert.ok(css.some(text => text.includes('--owned-css-proof')));
      assert.ok(js.some(text => text.includes('source-proof')));
      assert.equal((await readFile(resolve(outDir, 'brand/logo.png')))[0], 137);
    }
  } finally {
    await server?.close();
    await rm(root, {recursive: true, force: true});
  }
}

function publicHeadPaths(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]).filter(tag => /\srel="(?:icon|apple-touch-icon|mask-icon|manifest)"/.test(tag)).map(tag => tag.match(/\shref="([^"]+)"/)[1]);
}

for (const base of ['/', '/admin/']) test(`public assets keep HTTP authority with the ${base} Vite base`, async () => {
  await fixture(base, false, async get => {
    const missing = await get('brand/missing-logo.svg');
    assert.equal(missing.status, 200);
    assert.match(missing.headers.get('content-type'), /text\/html/);
    assert.match(await missing.text(), /owned-spa-proof/);
  });
  await fixture(base, true, async get => {
    const htmlResponse = await get('');
    assert.equal(htmlResponse.status, 200);
    const html = await htmlResponse.text();
    assert.deepEqual(publicHeadPaths(html), [base+'brand/logo.png', base+'brand/logo.png', base+'brand/logo.svg', base+'site.webmanifest']);
    assert.ok(html.includes(`data-light-src="${base}brand/logo.svg"`));
    const css = await get('src/style.css'); assert.equal(css.status, 200); assert.match(await css.text(), /owned-css-proof/);

    for (const path of ['brand/missing-logo.svg', 'brand/missing-logo.svg?t=1', 'br%61nd/missing-logo.svg', 'favicon-missing.png', 'assets/missing-hash.js', 'fonts/missing.woff2', 'maps/missing.json', 'geography/missing.json', 'licenses/missing.txt']) {
      const missing = await get(path);
      assert.equal(missing.status, 404, path);
      assert.doesNotMatch(missing.headers.get('content-type'), /text\/html/);
      assert.equal(missing.headers.get('cache-control'), 'no-store');
      assert.equal(await missing.text(), 'Not found');
    }
    const head = await get('brand/missing-logo.svg', {method: 'HEAD'});
    assert.equal(head.status, 404); assert.equal(await head.text(), '');
    const art = await get('brand/logo.svg');
    assert.equal(art.status, 200); assert.match(art.headers.get('content-type'), /image\/svg/);
    assert.match(await art.text(), /<svg/);
    const png = await get('brand/logo.png');
    assert.equal(png.status, 200); assert.match(png.headers.get('content-type'), /image\/png/);
    assert.deepEqual([...new Uint8Array(await png.arrayBuffer())].slice(0, 8), [137, 80, 78, 71, 13, 10, 26, 10]);
    const manifest = await get('site.webmanifest');
    assert.equal(manifest.status, 200); assert.equal((await manifest.json()).name, 'owned-manifest');
    const spa = await get('deep/route');
    assert.equal(spa.status, 200); assert.match(await spa.text(), /owned-spa-proof/);
    const source = await get('src/main.js');
    assert.equal(source.status, 200); assert.match(await source.text(), /source-proof/);
    const hmr = await get('@vite/client');
    assert.equal(hmr.status, 200); assert.doesNotMatch(hmr.headers.get('content-type'), /text\/html/);
    assert.ok((await hmr.text()).length > 100);
    const api = await get('api/proof.png');
    assert.equal(api.status, 418); assert.deepEqual(await api.json(), {authority: 'api-proof'});
  });
});
