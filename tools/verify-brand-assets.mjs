import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const load = file => readFileSync(resolve(root, file));
const manifest = JSON.parse(load('assets/brand/asset-manifest.json'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const source of manifest.master) assert.equal(hash(load(source.file)), source.sha256, `Stale brand exports: ${source.file}; run pnpm brand:generate`);
for (const asset of manifest.files) {
  const bytes = load('assets/' + asset.file);
  assert.equal(hash(bytes), asset.sha256, `Changed/corrupt asset: ${asset.file}`);
  assert.equal(bytes.length, asset.bytes);
  if (asset.file.endsWith('.svg')) assert(!/<(?:text|image|script)\b|https?:\/\/(?!www\.w3\.org)/i.test(bytes.toString()), `SVG must be self-contained outlined artwork: ${asset.file}`);
}
const size = file => { const bytes = load('assets/' + file); assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a'); return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]; };
assert.deepEqual(size('apple-touch-icon.png'), [180, 180]);
assert.deepEqual(size('brand/social-light.png'), [1200, 630]);
assert.deepEqual(size('brand/social-dark.png'), [1200, 630]);
for (const n of [16, 32, 48]) assert.deepEqual(size(`favicon-${n}x${n}.png`), [n, n]);
for (const [file, base, lang, dir] of [['site.webmanifest', '/', 'fa', 'rtl'], ['admin.webmanifest', '/admin/', 'en', 'ltr']]) {
  const web = JSON.parse(load('assets/' + file));
  assert.equal(web.id, base); assert.equal(web.start_url, base); assert.equal(web.scope, base); assert.equal(web.lang, lang); assert.equal(web.dir, dir);
  for (const icon of web.icons) {
    assert(['any', 'maskable'].includes(icon.purpose));
    const n = Number(icon.sizes.split('x')[0]); assert.deepEqual(size(icon.src), [n, n]);
    assert.equal(new URL(icon.src, `https://brand.invalid${base}${file}`).pathname, base + icon.src);
  }
}
const ico = load('assets/favicon.ico'); assert.equal(ico.readUInt16LE(0), 0); assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.readUInt16LE(4), 3);
for (let i = 0; i < 3; i++) {
  const p = 6 + i * 16, length = ico.readUInt32LE(p + 8), offset = ico.readUInt32LE(p + 12);
  assert(offset + length <= ico.length);
  assert.equal(ico.toString('hex', offset, offset + 8), '89504e470d0a1a0a');
}
for (const app of ['web', 'admin']) {
  const input = JSON.parse(load(`apps/${app}/project.json`)).targets.build.inputs;
  assert(input.includes('{workspaceRoot}/tools/vite-brand-metadata.mts'));
  assert(input.some(item => item?.env === 'TOROBTICKET_PUBLIC_ORIGIN'));
  const typecheck = JSON.parse(load(`apps/${app}/project.json`)).targets.typecheck.inputs;
  assert(typecheck.includes('{workspaceRoot}/tools/vite-brand-metadata.mts'));
}
console.log(`PASS: ${manifest.files.length} exported assets match masters/hashes; SVGs are outlined; PNG/ICO dimensions and both manifest scopes resolve correctly.`);
