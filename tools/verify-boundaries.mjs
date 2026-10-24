import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const file = 'apps/web/src/boundary-verification.ts';
mkdirSync('docs/evidence/T01', { recursive: true });
writeFileSync(file, "import '@torob-ticket/data-access';\n", { flag: 'wx' });
try {
  const result = spawnSync('pnpm', ['exec', 'eslint', file, '--no-cache'], { encoding: 'utf8', env: { ...process.env, NX_DAEMON: 'false' } });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  writeFileSync('docs/evidence/T01/boundary-rejection.log', `$ pnpm exec eslint ${file} --no-cache\nexit=${result.status}\n${output}`);
  if (result.status === 0 || !output.includes('@nx/enforce-module-boundaries') || !output.includes('scope:shared')) {
    throw new Error(`Expected Nx to reject browser → data-access. Actual exit ${result.status}:\n${output}`);
  }
  console.log('PASS: Nx rejected browser → data-access with @nx/enforce-module-boundaries.');
} finally { rmSync(file, { force: true }); }
