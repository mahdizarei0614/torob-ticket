import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const probes = [
  { file: 'apps/web/src/boundary-verification.ts', source: "import '@torob-ticket/data-access';\n", rejected: true, reason: 'scope:shared' },
  ...['contracts', 'domain'].flatMap(name => [
    { file: `libs/${name}/src/boundary-verification.ts`, source: "import { expect } from 'vitest';\nvoid expect;\n", rejected: true, reason: 'vitest' },
    { file: `libs/${name}/src/boundary-verification.spec.ts`, source: "import { expect } from 'vitest';\nvoid expect;\n", rejected: false },
    { file: `libs/${name}/src/boundary-server-verification.spec.ts`, source: "import '@torob-ticket/fixtures';\n", rejected: true, reason: 'scope:shared' }
  ])
];
const failures = [];
const records = [];
mkdirSync('docs/evidence/T01', { recursive: true });
for (const probe of probes) {
  writeFileSync(probe.file, probe.source, { flag: 'wx' });
  try {
    const result = spawnSync('pnpm', ['exec', 'eslint', probe.file, '--no-cache'], { encoding: 'utf8', env: { ...process.env, NX_DAEMON: 'false' } });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    const record = `$ pnpm exec eslint ${probe.file} --no-cache\nexit=${result.status}\n${output}`;
    records.push(record);
    if (probe.file === 'apps/web/src/boundary-verification.ts') writeFileSync('docs/evidence/T01/boundary-rejection.log', record);
    const passed = probe.rejected
      ? result.status === 1 && output.includes('@nx/enforce-module-boundaries') && output.includes(probe.reason)
      : result.status === 0;
    if (!passed) failures.push(`Unexpected boundary result:\n${record}`);
  } finally { rmSync(probe.file, { force: true }); }
}
writeFileSync('docs/evidence/T01/boundary-regression.log', records.join('\n'));
if (failures.length) throw new Error(failures.join('\n'));
console.log('PASS: browser → data-access rejected; contracts/domain reject production Vitest, allow unit Vitest, and retain unit server-import restrictions (7 probes).');
