import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const report = resolve(root, process.argv[2] ?? '.local/evidence/T32/bundles/module-contributions.json');
const outputs = {};
for (const app of ['web', 'admin']) {
  const chunks = [];
  await build({
    configFile: resolve(root, `apps/${app}/vite.config.mts`),
    build: { outDir: resolve(root, `dist/t32/${app}`), emptyOutDir: true, manifest: true },
    plugins: [{
      name: 't32-emitted-module-audit',
      apply: 'build',
      generateBundle(_options, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk') continue;
          chunks.push({
            file: chunk.fileName, isEntry: chunk.isEntry, isDynamicEntry: chunk.isDynamicEntry,
            imports: chunk.imports, dynamicImports: chunk.dynamicImports,
            modules: Object.entries(chunk.modules).map(([id, info]) => ({
              id: id.startsWith(root) ? relative(root, id) : id,
              renderedLength: info.renderedLength ?? null,
              originalLength: info.originalLength ?? null,
            })).sort((left, right) => (right.renderedLength ?? 0) - (left.renderedLength ?? 0)),
          });
        }
      },
    }],
  });
  outputs[app] = { directory: `dist/t32/${app}`, chunks };
}
await mkdir(resolve(report, '..'), { recursive: true });
await writeFile(report, JSON.stringify({
  node: process.version, outputs,
  method: 'Production emitted chunk graph and bundler module rendered-length observations. Module rendered lengths rank causes; they are not additive module gzip attribution. Budget gzip is measured from complete emitted files by measure-bundles.mjs.',
}, null, 2) + '\n');
console.log(`Recorded module contribution audit: ${relative(root, report)}`);
