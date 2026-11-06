import { chown, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareProviderStore } from './provider-store-permissions.mjs';
const development = process.argv[2] === 'development';
// This is the provider's dedicated Docker volume. Preserve contents while moving
// an older root-owned dev store to the same UID used by the packaged service.
if (process.getuid?.() === 0) {
  await prepareProviderStore('/data', 1000, 1000);
  if (development) {
    const output = resolve('.dev/example-provider'); await mkdir(output, { recursive: true }); await chown(output, 1000, 1000);
  }
  process.setgroups([]); process.setgid(1000); process.setuid(1000);
}
if (development) {
  const { watchApi } = await import('../tools/dev-api.mjs');
  const running = watchApi({ project: 'apps/example-provider/tsconfig.build.json', outDir: '.dev/example-provider', entry: 'apps/example-provider/src/main.js' });
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { if (!closing) { closing = true; void running.close().catch(() => { process.exitCode = 1; }); } });
} else await import(pathToFileURL(resolve('dist/apps/example-provider/apps/example-provider/src/main.js')).href);
