import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { chromium } from '@playwright/test';
import { compactLoop as mark } from '../libs/ui/src/brand/compact-loop.ts';

// Vector geometry, outlined licensed wordmarks and semantic palette are the masters.
// Rasterization uses the project's existing Playwright dependency, not an image API.
const root = resolve(import.meta.dirname, '..');
const at = path => resolve(root, path);
const wordmarks = JSON.parse(readFileSync(at('libs/ui/src/brand/wordmarks.json'), 'utf8'));
const tokens = readFileSync(at('libs/ui/src/styles/tokens.css'), 'utf8');
const token = name => {
  const value = tokens.match(new RegExp(`--${name}:\\s*(#[\\da-f]{6});`, 'i'))?.[1];
  if (!value) throw Error(`Missing export palette token: ${name}`);
  return value;
};
const palette = { primary: token('brand-primary'), leaf: token('brand-leaf'), ink: token('brand-ink'), white: token('brand-white'), light: token('brand-surface-light'), dark: token('brand-surface-dark') };
const files = [];
const svg = (w, h, content, title = 'TorobTicket') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">${content}</svg>\n`;
const path = (d, fill, extra = '') => `<path fill="${fill}" d="${d}"${extra}/>`;
function symbol(variant = 'color') {
  const primary = variant === 'white' ? palette.white : variant === 'mono' ? palette.ink : palette.primary;
  const leaf = variant === 'color' ? palette.leaf : primary;
  return path(mark.arch, primary) + path(mark.route, primary) + mark.endpoints.map(cx => path(`M${cx - mark.endpointRadius} ${mark.endpointY}a${mark.endpointRadius} ${mark.endpointRadius} 0 1 0 ${mark.endpointRadius * 2} 0a${mark.endpointRadius} ${mark.endpointRadius} 0 1 0 -${mark.endpointRadius * 2} 0M${cx - mark.holeRadius} ${mark.endpointY}a${mark.holeRadius} ${mark.holeRadius} 0 1 0 ${mark.holeRadius * 2} 0a${mark.holeRadius} ${mark.holeRadius} 0 1 0 -${mark.holeRadius * 2} 0`, primary, ' fill-rule="evenodd"')).join('') + mark.leaves.map(d => path(d, leaf)).join('');
}
function wordmark(lang, variant = 'color', x = 0, y = 0, height = 144) {
  const word = wordmarks[lang];
  const [bx, by, , bh] = word.viewBox;
  return `<g fill="${variant === 'white' ? palette.white : palette.ink}" transform="translate(${x} ${y}) scale(${height / bh}) translate(${-bx} ${-by})">${word.paths.map(p => `<path d="${p.d}"${p.transform ? ` transform="${p.transform}"` : ''}/>`).join('')}</g>`;
}
function horizontal(lang, variant) {
  const wordWidth = wordmarks[lang].viewBox[2] * 144 / wordmarks[lang].viewBox[3];
  return svg(290 + wordWidth, 256, `<g transform="translate(${lang === 'fa' ? wordWidth + 34 : 0} 0)">${symbol(variant)}</g>` + wordmark(lang, variant, lang === 'fa' ? 0 : 290, 56), wordmarks[lang].text);
}
function stacked(lang, variant) {
  const height = lang === 'fa' ? 100 : 72;
  const wordWidth = wordmarks[lang].viewBox[2] * height / wordmarks[lang].viewBox[3];
  return svg(560, 430, `<g transform="translate(152 12)">${symbol(variant)}</g>` + wordmark(lang, variant, (560 - wordWidth) / 2, 310, height), wordmarks[lang].text);
}
function icon(variant = 'color', safe = false) {
  const size = safe ? 152 : 200;
  const inset = (256 - size) / 2;
  return svg(256, 256, `<rect width="256" height="256" fill="${variant === 'white' ? palette.dark : palette.light}"/><g transform="translate(${inset} ${inset}) scale(${size / 256})">${symbol(variant)}</g>`);
}
function social(variant = 'color') {
  const bg = variant === 'white' ? palette.dark : palette.light;
  const wordWidth = wordmarks.fa.viewBox[2] * 104 / wordmarks.fa.viewBox[3];
  const enWidth = wordmarks.en.viewBox[2] * 40 / wordmarks.en.viewBox[3];
  return svg(1200, 630, `<rect width="1200" height="630" fill="${bg}"/><g transform="translate(472 58)">${symbol(variant)}</g>` + wordmark('fa', variant, (1200 - wordWidth) / 2, 350, 104) + wordmark('en', variant, (1200 - enWidth) / 2, 493, 40));
}
function save(file, content) {
  mkdirSync(dirname(at(file)), { recursive: true });
  writeFileSync(at(file), content);
  files.push(file);
}
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  async function png(file, source, width, height = width) {
    await page.setViewportSize({ width, height });
    await page.setContent(`<html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style></head><body>${source}</body></html>`);
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    save(file, await page.screenshot({ omitBackground: true }));
  }
  for (const variant of ['color', 'white', 'mono']) {
    const source = svg(256, 256, symbol(variant));
    save(`assets/brand/symbol-${variant}.svg`, source);
    for (const size of [256, 512, 1024]) await png(`assets/brand/symbol-${variant}-${size}.png`, source, size);
    for (const lang of ['fa', 'en']) {
      const horizontalSvg = horizontal(lang, variant);
      save(`assets/brand/logo-${lang}-${variant}.svg`, horizontalSvg);
      const [w] = horizontalSvg.match(/width="([\d.]+)"/).slice(1).map(Number);
      await png(`assets/brand/logo-${lang}-${variant}.png`, horizontalSvg, 1600, Math.round(1600 * 256 / w));
      const stack = stacked(lang, variant);
      save(`assets/brand/stacked-${lang}-${variant}.svg`, stack);
      await png(`assets/brand/stacked-${lang}-${variant}.png`, stack, 1120, 860);
      const word = wordmarks[lang];
      save(`assets/brand/wordmark-${lang}-${variant}.svg`, svg(word.viewBox[2], word.viewBox[3], wordmark(lang, variant, 0, 0, word.viewBox[3]), word.text));
    }
  }
  for (const [name, variant] of [['light', 'color'], ['dark', 'white']]) {
    save(`assets/brand/favicon-${name}.svg`, svg(256, 256, symbol(variant)));
    await png(`assets/brand/social-${name}.png`, social(variant), 1200, 630);
    save(`assets/brand/social-${name}.svg`, social(variant));
  }
  // Standalone fallback adapts to browser chrome; app head script selects light/dark
  // assets explicitly so a manually chosen theme wins over OS preference.
  save('assets/favicon.svg', svg(256, 256, `<style>:root{--primary:${palette.primary};--leaf:${palette.leaf}}@media(prefers-color-scheme:dark){:root{--primary:${palette.white};--leaf:${palette.white}}}</style>` + symbol().replaceAll(`fill="${palette.primary}"`, 'fill="var(--primary)"').replaceAll(`fill="${palette.leaf}"`, 'fill="var(--leaf)"')));
  const icoImages = [];
  for (const size of [16, 32, 48]) {
    const file = `assets/favicon-${size}x${size}.png`;
    await png(file, svg(256, 256, symbol()), size);
    icoImages.push({ size, data: readFileSync(at(file)) });
  }
  const header = Buffer.alloc(6 + icoImages.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(icoImages.length, 4);
  let offset = header.length;
  for (const [i, { size, data }] of icoImages.entries()) {
    const p = 6 + i * 16; header[p] = size; header[p + 1] = size;
    header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(data.length, p + 8); header.writeUInt32LE(offset, p + 12); offset += data.length;
  }
  save('assets/favicon.ico', Buffer.concat([header, ...icoImages.map(p => p.data)]));
  await png('assets/apple-touch-icon.png', icon(), 180);
  for (const size of [192, 512]) {
    await png(`assets/brand/icon-${size}.png`, icon(), size);
    await png(`assets/brand/icon-maskable-${size}.png`, icon('color', true), size);
  }
  save('assets/safari-pinned-tab.svg', svg(256, 256, symbol('mono').replaceAll(`fill="${palette.ink}"`, 'fill="black"')));
  for (const [file, admin] of [['site.webmanifest', false], ['admin.webmanifest', true]]) {
    const base = admin ? '/admin/' : '/';
    save(`assets/${file}`, JSON.stringify({ id: base, name: admin ? 'TorobTicket Admin' : 'ترب تیکت', short_name: admin ? 'TorobTicket Admin' : 'ترب تیکت', lang: admin ? 'en' : 'fa', dir: admin ? 'ltr' : 'rtl', start_url: base, scope: base, display: 'standalone', background_color: palette.light, theme_color: palette.light, icons: [192, 512].map(size => ({ src: `brand/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })).concat([192, 512].map(size => ({ src: `brand/icon-maskable-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'maskable' }))) }, null, 2) + '\n');
  }
  const hash = file => createHash('sha256').update(readFileSync(at(file))).digest('hex');
  save('assets/brand/asset-manifest.json', JSON.stringify({ identity: 'Compact Loop / paired leaves', palette, master: ['libs/ui/src/brand/compact-loop.ts', 'libs/ui/src/brand/wordmarks.json', 'libs/ui/src/styles/tokens.css'].map(file => ({ file, sha256: hash(file) })), fonts: ['Vazirmatn-wght.woff2', 'InterVariable.woff2'].map(file => ({ file: `fonts/${file}`, sha256: hash(`assets/fonts/${file}`), license: 'SIL Open Font License 1.1' })), generatedWith: { tool: 'tools/generate-brand-assets.mjs', browser: browser.version() }, files: files.map(file => ({ file: file.replace('assets/', ''), bytes: readFileSync(at(file)).length, sha256: hash(file) })) }, null, 2) + '\n');
  console.log(`Exported ${files.length} local brand assets, icons, manifests and hash registry.`);
} finally {
  await browser.close();
}
