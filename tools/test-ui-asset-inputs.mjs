import assert from 'node:assert/strict';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
// Execute the owning project's actual Nx input policy against observable build runs.
const root = mkdtempSync(join(tmpdir(), 'torobticket-ui-assets-'));
const original = JSON.parse(readFileSync('libs/ui/project.json', 'utf8'));
try {
  for (const file of ['package.json', 'nx.json', 'tsconfig.base.json', 'pnpm-lock.yaml'])
    copyFileSync(file, join(root, file));
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
  mkdirSync(join(root, 'libs/ui/src'), { recursive: true });
  mkdirSync(join(root, 'assets/fonts'), { recursive: true });
  writeFileSync(join(root, 'assets/fonts/probe.woff2'), 'font-v1');
  writeFileSync(join(root, 'libs/ui/src/index.ts'), 'export {};');
  const targets = {};
  for (const name of ['build', 'build-storybook']) {
    targets[name] = {
      ...original.targets[name],
      dependsOn: [],
      outputs: [],
      options: { command: `node libs/ui/${name}.mjs` },
    };
    writeFileSync(
      join(root, `libs/ui/${name}.mjs`),
      `import { appendFileSync } from 'node:fs'; appendFileSync('${name}-runs', 'run\\n');`,
    );
  }
  writeFileSync(join(root, 'libs/ui/project.json'), JSON.stringify({ ...original, targets }));
  const run = (name) => {
    const result = spawnSync(
      process.execPath,
      [resolve('node_modules/nx/dist/bin/nx.js'), 'run', `ui:${name}`, '--output-style=static'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          NX_DAEMON: 'false',
          NX_ISOLATE_PLUGINS: 'false',
          NX_TUI: 'false',
          NX_CACHE_DIRECTORY: join(root, '.nx/cache'),
          NX_WORKSPACE_DATA_DIRECTORY: join(root, '.nx/workspace-data'),
        },
      },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  for (const name of ['build', 'build-storybook']) {
    run(name);
    run(name);
    assert.equal(readFileSync(join(root, `${name}-runs`), 'utf8'), 'run\n');
  }
  writeFileSync(join(root, 'assets/fonts/probe.woff2'), 'font-v2');
  for (const name of ['build', 'build-storybook']) {
    run(name);
    assert.equal(
      readFileSync(join(root, `${name}-runs`), 'utf8'),
      'run\nrun\n',
      `Root font changes must invalidate ui:${name}`,
    );
  }
  console.log(
    'PASS: changing only a root font invalidates warm UI and Storybook builds (both executions 1 → 2).',
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
