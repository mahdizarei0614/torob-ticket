import { readFile, readdir, realpath, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const workspace = resolve(fileURLToPath(new URL('..', import.meta.url)));
const limits = { initialJsGzipBytes: 350 * 1024, deferredGraphicsJsGzipBytes: 500 * 1024 };
const jsFile = file => /\.(?:m?js|cjs)$/.test(file);
const sum = (rows, property) => rows.reduce((total, row) => total + row[property], 0);

export function staticClosure(manifest, roots) {
  const visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    const record = manifest[key];
    if (!record) throw new Error(`Missing manifest import: ${key}`);
    visited.add(key);
    for (const dependency of record.imports ?? []) visit(dependency);
  }
  roots.forEach(visit);
  return visited;
}

export function deferredFamily(manifest, roots, initialKeys) {
  const visited = new Set(), rootKeys = new Set(roots);
  function visit(key) {
    if (visited.has(key)) return;
    const record = manifest[key];
    if (!record) throw new Error(`Missing manifest import: ${key}`);
    visited.add(key);
    // Shared entry code is already present. Its unrelated dynamic features do
    // not become graphics dependencies merely because the bundler shares it.
    if (initialKeys.has(key) && !rootKeys.has(key)) return;
    for (const dependency of [...record.imports ?? [], ...record.dynamicImports ?? []]) visit(dependency);
  }
  roots.forEach(visit); return visited;
}

function attributes(source) {
  return Object.fromEntries([...source.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(match => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]]));
}

export function htmlScripts(html, base = '/') {
  const files = [], inline = [];
  const local = url => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) throw new Error('Remote initial script cannot be measured from emitted files');
    const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]);
    if (pathname.startsWith('/') && !pathname.startsWith(base)) throw new Error(`Initial script is outside app base: ${url}`);
    return pathname.startsWith('/') ? pathname.slice(base.length) : pathname.replace(/^\.\//, '');
  };
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const props = attributes(match[1]);
    if (props.type && !['module', 'text/javascript', 'application/javascript'].includes(props.type)) continue;
    if (props.src) files.push(local(props.src));
    else if (match[2].trim()) inline.push(Buffer.from(match[2]));
  }
  for (const match of html.matchAll(/<link\b([^>]*)>/gi)) {
    const props = attributes(match[1]);
    if (props.rel?.toLowerCase() === 'modulepreload' && props.href) files.push(local(props.href));
  }
  return { files: [...new Set(files)], inline };
}

export async function measureApp(directory, { base = '/', graphicsRoot = key => key.includes('/libs/graphics/'), sdkRoot = key => key.includes('/maplibre-gl/'), budgets = limits } = {}) {
  const root = await realpath(directory);
  const manifestPath = resolve(root, '.vite/manifest.json');
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  for (const [key, record] of Object.entries(manifest)) {
    if (typeof record.file !== 'string') throw new Error(`Manifest record has no file: ${key}`);
    for (const target of [...record.imports ?? [], ...record.dynamicImports ?? []]) if (!manifest[target]) throw new Error(`Missing manifest import: ${target}`);
  }
  const entries = Object.keys(manifest).filter(key => manifest[key].isEntry);
  if (!entries.length) throw new Error('Manifest has no application entry');
  const records = new Map();
  async function inspect(file) {
    if (records.has(file)) return records.get(file);
    const path = await realpath(resolve(root, file));
    if (!path.startsWith(root + sep)) throw new Error(`Emitted path escapes build directory: ${file}`);
    const bytes = await readFile(path);
    const row = { file, bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length, sha256: createHash('sha256').update(bytes).digest('hex') };
    records.set(file, row); return row;
  }
  const initialKeys = staticClosure(manifest, entries);
  const scriptInventory = htmlScripts(await readFile(resolve(root, 'index.html'), 'utf8'), base);
  const byFile = new Map(Object.entries(manifest).map(([key, record]) => [record.file, key]));
  const htmlRoots = scriptInventory.files.flatMap(file => byFile.has(file) ? [byFile.get(file)] : []);
  for (const dependency of staticClosure(manifest, htmlRoots)) initialKeys.add(dependency);
  const graphicsRoots = Object.keys(manifest).filter(graphicsRoot);
  const sdkRoots = Object.keys(manifest).filter(sdkRoot);
  const graphicsKeys = deferredFamily(manifest, graphicsRoots, initialKeys);
  const sdkKeys = deferredFamily(manifest, sdkRoots, initialKeys);
  const reachableKeys = deferredFamily(manifest, [...entries, ...htmlRoots], new Set());
  const filesFor = keys => new Set([...keys].flatMap(key => [manifest[key].file, ...(manifest[key].css ?? []), ...(manifest[key].assets ?? [])]));
  const initialFiles = filesFor(initialKeys);
  for (const file of scriptInventory.files) {
    initialFiles.add(file);
  }
  const graphicsFiles = filesFor(graphicsKeys), sdkFiles = filesFor(sdkKeys);
  const reachableFiles = new Set([...filesFor(reachableKeys), ...initialFiles, ...sdkFiles]);
  const inventory = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const path = resolve(folder, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) inventory.push(await inspect(relative(root, path).split(sep).join('/')));
      else if (entry.isSymbolicLink()) throw new Error('Symlinks are not accepted in an audited build');
    }
  }
  await walk(root);
  for (const file of new Set([...initialFiles, ...graphicsFiles, ...sdkFiles, ...reachableFiles])) await inspect(file);
  const rows = set => [...set].sort().map(file => records.get(file));
  const initialJs = rows(initialFiles).filter(row => jsFile(row.file));
  const graphicsIncremental = rows(graphicsFiles).filter(row => jsFile(row.file) && !initialFiles.has(row.file));
  const sdkIncremental = rows(sdkFiles).filter(row => jsFile(row.file) && !initialFiles.has(row.file));
  const otherDeferred = rows(reachableFiles).filter(row => jsFile(row.file) && !initialFiles.has(row.file) && !graphicsFiles.has(row.file) && !sdkFiles.has(row.file));
  const deferredUnion = new Set([...reachableFiles].filter(file => !initialFiles.has(file) && jsFile(file)));
  const inline = scriptInventory.inline.map((bytes, index) => ({ file: `index.html:inline-script-${index + 1}`, bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length, sha256: createHash('sha256').update(bytes).digest('hex') }));
  const initialJsGzipBytes = sum([...initialJs, ...inline], 'gzipBytes');
  const deferredGraphicsJsGzipBytes = sum(graphicsIncremental, 'gzipBytes');
  const initialAndAllDeferredJs = new Set([...initialJs.map(row => row.file), ...deferredUnion]);
  const unassignedJs = inventory.filter(row => jsFile(row.file) && !initialAndAllDeferredJs.has(row.file));
  const sharedGraphicsSdkJs = rows(new Set([...graphicsFiles].filter(file => sdkFiles.has(file) && !initialFiles.has(file) && jsFile(file))));
  return {
    directory: relative(workspace, root), manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'), entries, graphicsRoots, sdkRoots,
    limits: budgets, initialJsGzipBytes, deferredGraphicsJsGzipBytes,
    initialBudgetPass: budgets ? initialJsGzipBytes <= budgets.initialJsGzipBytes : null,
    graphicsBudgetPass: budgets ? deferredGraphicsJsGzipBytes <= budgets.deferredGraphicsJsGzipBytes : null,
    initialJs: [...initialJs, ...inline], graphicsIncrementalJs: graphicsIncremental,
    graphicsAlreadyInitialJs: rows(graphicsFiles).filter(row => initialFiles.has(row.file) && jsFile(row.file)),
    mapLibreIncrementalJs: sdkIncremental, mapLibreJsGzipBytes: sum(sdkIncremental, 'gzipBytes'),
    otherDeferredAppJs: otherDeferred, otherDeferredAppJsGzipBytes: sum(otherDeferred, 'gzipBytes'),
    mapLibreCss: rows(sdkFiles).filter(row => extname(row.file) === '.css'),
    sharedGraphicsMapLibreJs: sharedGraphicsSdkJs,
    allDeferredUnionJsGzipBytes: sum(rows(deferredUnion), 'gzipBytes'),
    initialAndAllDeferredUnionJsGzipBytes: sum(rows(initialAndAllDeferredJs), 'gzipBytes') + sum(inline, 'gzipBytes'),
    initialCss: rows(initialFiles).filter(row => extname(row.file) === '.css'),
    deferredGraphicsCss: rows(graphicsFiles).filter(row => extname(row.file) === '.css' && !initialFiles.has(row.file)),
    totalEmittedJsGzipBytes: sum(inventory.filter(row => jsFile(row.file)), 'gzipBytes'), unassignedJs,
    allEmittedFiles: inventory.sort((left, right) => left.file.localeCompare(right.file)),
    externalMapNetwork: 'Style JSON, raster/vector tiles, glyphs and remote imagery are runtime network costs, not included in emitted file totals; record browser network separately.',
    method: 'Unique individually-compressed emitted-file gzip(level9) sums. Static entry imports + real HTML scripts/modulepreloads are initial. Graphics roots use actual manifest source identity; their static/nested-dynamic family stops at already-initial shared modules and subtracts initial files. A visible desktop scene may request deferred graphics immediately; deferred does not mean post-interaction only. Lazy SDK/worker emitted assets are separately disclosed; union totals prevent shared-file double counting. CSS/fonts/images/public assets are inventoried separately. This is artifact weight, not measured network transfer, parse time or a deployment proof.',
  };
}

async function main() {
  const args = process.argv.slice(2); const options = { web: 'dist/t32/web', admin: 'dist/t32/admin', output: '.local/evidence/T32/bundles/bundle-report.json' };
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index].replace(/^--/, '');
    if (!Object.hasOwn(options, key) || !args[index + 1]) throw new Error('Usage: measure-bundles.mjs [--web path] [--admin path] [--output report.json]');
    options[key] = args[index + 1];
  }
  const web = await measureApp(resolve(workspace, options.web));
  if (!web.graphicsRoots.length || !web.sdkRoots.length) throw new Error('Consumer graphics/MapLibre roots are missing from the manifest audit');
  const admin = await measureApp(resolve(workspace, options.admin), { base: '/admin/', budgets: null });
  const result = { capturedAt: new Date().toISOString(), node: process.version, web, admin, budgetScope: '350/500KiB defaults apply to consumer initial/app-graphics JS. Admin and on-demand hotel SDK costs are separately reported, not silently removed from total app cost.' };
  await mkdir(resolve(workspace, options.output, '..'), { recursive: true });
  await writeFile(resolve(workspace, options.output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ report: options.output, initialKiB: web.initialJsGzipBytes / 1024, graphicsKiB: web.deferredGraphicsJsGzipBytes / 1024, mapLibreKiB: web.mapLibreJsGzipBytes / 1024, initialPass: web.initialBudgetPass, graphicsPass: web.graphicsBudgetPass }));
  if (!web.initialBudgetPass || !web.graphicsBudgetPass || web.unassignedJs.length) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
