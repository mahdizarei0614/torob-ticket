import assert from 'node:assert/strict';
import { appendFileSync, copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = mkdtempSync(join(tmpdir(), 'torobticket-cache-'));
const nx = resolve('node_modules/nx/dist/bin/nx.js');
const tsc = resolve('node_modules/typescript/bin/tsc');
const failures = [];
const write = (file, content) => {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
};
const run = (target) => {
  const result = spawnSync(process.execPath, [nx, 'run', target, '--outputStyle=static'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NX_DAEMON: 'false', NX_ISOLATE_PLUGINS: 'false', NX_TUI: 'false', NX_CACHE_DIRECTORY: join(root, '.nx/cache'), NX_WORKSPACE_DATA_DIRECTORY: join(root, '.nx/workspace-data') }
  });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
};
const check = (name, fn) => {
  try { fn(); } catch (error) { failures.push(`${name}: ${error.message}`); }
};
try {
  for (const file of ['package.json', 'nx.json', 'tsconfig.base.json', 'eslint.config.mjs', 'pnpm-lock.yaml', 'vitest.config.mts']) copyFileSync(file, join(root, file));
  cpSync('prisma', join(root, 'prisma'), { recursive: true });
  copyFileSync('prisma.config.ts', join(root, 'prisma.config.ts'));
  mkdirSync(join(root, 'apps/api'), { recursive: true });
  copyFileSync('apps/api/vitest.integration.config.ts', join(root, 'apps/api/vitest.integration.config.ts'));
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
  cpSync('apps/web', join(root, 'apps/web'), { recursive: true });
  // The real consumer now has a lazy graphics route; its browser library imports must resolve
  // in this isolated workspace even when the foundation test never opens that route.
  for (const library of ['client', 'graphics', 'ui', 'contracts', 'domain']) cpSync(`libs/${library}`, join(root, `libs/${library}`), { recursive: true });
  mkdirSync(join(root, 'tools'), { recursive: true });
  copyFileSync('tools/test-setup.ts', join(root, 'tools/test-setup.ts'));
  const base = JSON.parse(readFileSync(join(root, 'tsconfig.base.json'), 'utf8'));
  base.compilerOptions.paths['@torob-ticket/cache-source'] = ['libs/cache-source/src/index.ts'];
  write('tsconfig.base.json', base);
  for (const name of ['cache-source', 'cache-consumer']) {
    const dir = `libs/${name}`;
    write(`${dir}/tsconfig.json`, { extends: '../../tsconfig.base.json', include: ['src/**/*.ts'] });
    write(`${dir}/project.json`, { name, projectType: 'library', sourceRoot: `${dir}/src`, targets: { typecheck: { executor: 'nx:run-commands', options: { command: `node ${JSON.stringify(join(root, dir, 'check.mjs'))}` } } } });
    write(`${dir}/check.mjs`, `import { appendFileSync } from 'node:fs';\nimport { spawnSync } from 'node:child_process';\nappendFileSync(${JSON.stringify(join(root, `${name}-runs`))}, 'run\\n');\nconst result = spawnSync(process.execPath, [${JSON.stringify(tsc)}, '--noEmit', '-p', ${JSON.stringify(`${dir}/tsconfig.json`)}], { stdio: 'inherit' });\nprocess.exit(result.status ?? 1);\n`);
  }
  write('libs/cache-source/src/index.ts', "export const cacheValue: string = 'ok';\n");
  write('libs/cache-consumer/src/index.ts', "import { cacheValue } from '@torob-ticket/cache-source';\nconst consumerValue: string = cacheValue;\nvoid consumerValue;\n");
  check('dependency source invalidation', () => {
    const cold = run('cache-consumer:typecheck');
    assert.equal(cold.status, 0, cold.output);
    const warm = run('cache-consumer:typecheck');
    assert.equal(warm.status, 0, warm.output);
    assert.equal(readFileSync(join(root, 'cache-consumer-runs'), 'utf8'), 'run\n', 'Unchanged consumer must actually use its cached successful result');
    write('libs/cache-source/src/index.ts', 'export const cacheValue: number = 42;\n');
    const changed = run('cache-consumer:typecheck');
    assert.equal(changed.status, 1, `Changing only the dependency export must reject stale consumer success:\n${changed.output}`);
    assert.match(changed.output, /TS2322/);
    assert.equal(readFileSync(join(root, 'cache-consumer-runs'), 'utf8'), 'run\nrun\n');
    console.log('PASS: dependency-only export change invalidates cached consumer and exposes TS2322 (consumer executions 1 → 2).');
  });
  check('root Prisma schema invalidation', () => {
    const before = readFileSync(join(root, 'cache-source-runs'), 'utf8');
    assert.equal(run('cache-source:typecheck').status, 0);
    assert.equal(readFileSync(join(root, 'cache-source-runs'), 'utf8'), before);
    appendFileSync(join(root, 'prisma/schema.prisma'), '\n// cache invalidation probe\n');
    const changed = run('cache-source:typecheck');
    assert.equal(changed.status, 0, changed.output);
    assert.equal(readFileSync(join(root, 'cache-source-runs'), 'utf8'), before + 'run\n');
    console.log('PASS: root Prisma schema change invalidates a cached consumer check.');
  });
  check('root test setup invalidation', () => {
    const marker = join(root, 'setup-runs');
    appendFileSync(join(root, 'tools/test-setup.ts'), `\nimport { appendFileSync as markCacheProbe } from 'node:fs';\nmarkCacheProbe(${JSON.stringify(marker)}, 'run\\n');\n`);
    const cold = run('web:test');
    assert.equal(cold.status, 0, cold.output);
    const warm = run('web:test');
    assert.equal(warm.status, 0, warm.output);
    assert.equal(readFileSync(marker, 'utf8'), 'run\n', 'Unchanged web test must actually use its cached successful result');
    appendFileSync(join(root, 'tools/test-setup.ts'), "\nthrow new Error('CACHE_SETUP_PROBE');\n");
    const changed = run('web:test');
    assert.equal(changed.status, 1, `Changing only root test setup must invalidate cached web success:\n${changed.output}`);
    assert.match(changed.output, /CACHE_SETUP_PROBE/);
    assert.equal(readFileSync(marker, 'utf8'), 'run\nrun\n');
    console.log('PASS: root setup change invalidates cached UI tests and exposes the setup failure (setup executions 1 → 2).');
  });
  assert.deepEqual(failures, []);
} finally { rmSync(root, { recursive: true, force: true }); }
