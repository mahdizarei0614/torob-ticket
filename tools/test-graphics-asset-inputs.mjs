import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
// Exercise Nx hashes by observing real target executions, not by comparing config strings.
const root = mkdtempSync(join(tmpdir(), 'torobticket-shader-inputs-'));
try {
  for (const file of ['package.json', 'nx.json', 'tsconfig.base.json', 'pnpm-lock.yaml']) copyFileSync(file, join(root, file));
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
  mkdirSync(join(root, 'libs/graphics/src/shaders'), { recursive: true });
  mkdirSync(join(root, 'libs/ui/src'), { recursive: true });
  mkdirSync(join(root, 'assets/geography'), { recursive: true });
  const geography = join(root, 'assets/geography/route-scene-fixtures.json');
  writeFileSync(geography, '{"revision":"first"}');
  writeFileSync(join(root, 'libs/graphics/src/index.ts'), 'export {};');
  writeFileSync(join(root, 'libs/ui/src/index.ts'), 'export {};');
  const shader = join(root, 'libs/graphics/src/shaders/shared.glsl');
  writeFileSync(shader, 'void main() { /* first shader */ }');
  const cases = [['graphics', 'test'], ['graphics', 'build'], ['ui', 'build-storybook']];
  for (const project of ['graphics', 'ui']) {
    const original = JSON.parse(readFileSync(`libs/${project}/project.json`, 'utf8'));
    const targets = {};
    for (const [owner, target] of cases.filter(([owner]) => owner === project)) {
      targets[target] = { ...original.targets[target], dependsOn: [], outputs: [], options: { command: `node libs/${owner}/${target}.mjs` } };
      writeFileSync(join(root, `libs/${owner}/${target}.mjs`), `import { appendFileSync } from 'node:fs'; appendFileSync('${owner}-${target}-runs', 'run\\n');`);
    }
    writeFileSync(join(root, `libs/${project}/project.json`), JSON.stringify({ ...original, targets }));
  }
  function run(project, target) {
    const result = spawnSync(process.execPath, [resolve('node_modules/nx/dist/bin/nx.js'), 'run', `${project}:${target}`, '--output-style=static'], {
      cwd: root, encoding: 'utf8', env: { ...process.env, NX_DAEMON: 'false', NX_ISOLATE_PLUGINS: 'false', NX_TUI: 'false', NX_CACHE_DIRECTORY: join(root, '.nx/cache'), NX_WORKSPACE_DATA_DIRECTORY: join(root, '.nx/workspace-data') },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  for (const [project, target] of cases) { run(project, target); run(project, target); assert.equal(readFileSync(join(root, `${project}-${target}-runs`), 'utf8'), 'run\n'); }
  writeFileSync(shader, 'void main() { /* changed shader */ }');
  for (const [project, target] of cases) {
    run(project, target);
    assert.equal(readFileSync(join(root, `${project}-${target}-runs`), 'utf8'), 'run\nrun\n', `Shader changes must invalidate ${project}:${target}`);
  }
  writeFileSync(geography, '{"revision":"changed"}');
  for (const [project, target] of cases) {
    run(project, target);
    assert.equal(readFileSync(join(root, `${project}-${target}-runs`), 'utf8'), 'run\nrun\nrun\n', `Geography-only changes must invalidate ${project}:${target}`);
  }
  console.log('PASS: shader-only and geography-only changes invalidate warm graphics tests, graphics builds and the shared Storybook gallery.');
} finally { rmSync(root, { recursive: true, force: true }); }
