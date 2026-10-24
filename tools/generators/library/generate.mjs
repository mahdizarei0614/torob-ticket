import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [name, type, scope = 'shared'] = process.argv.slice(2);
const allowedTypes = ['contracts', 'domain', 'data', 'ui', 'graphics', 'fixtures', 'provider'];
const allowedScopes = ['shared', 'server'];
if (!name || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name) || !allowedTypes.includes(type) || !allowedScopes.includes(scope)) {
  throw new Error('Usage: pnpm generate:library <kebab-name> <contracts|domain|data|ui|graphics|fixtures|provider> [shared|server]');
}
if (['fixtures', 'provider'].includes(type) && scope !== 'server') throw new Error('Fixtures and providers must have server scope.');
if (['contracts', 'domain', 'ui', 'graphics'].includes(type) && scope !== 'shared') throw new Error(`${type} libraries must have shared scope.`);
const root = `libs/${name}`;
const configPath = resolve('tsconfig.base.json');
const base = JSON.parse(readFileSync(configPath, 'utf8'));
if (existsSync(root) || base.compilerOptions.paths[`@torob-ticket/${name}`]) throw new Error('Library already exists; refusing to overwrite.');
const group = ['ui', 'graphics'].includes(type) ? 'ui' : scope === 'server' ? 'server-libs' : 'pure';
const vitestPath = resolve('vitest.config.mts');
const vitestSource = readFileSync(vitestPath, 'utf8');
const groupMarker = `name: '${group}', environment: '${group === 'ui' ? 'jsdom' : 'node'}', include: [`;
if (!vitestSource.includes(groupMarker)) throw new Error('Unknown Vitest project configuration; refusing partial scaffold.');
const command = (value) => ({ executor: 'nx:run-commands', options: { command: value } });
mkdirSync(`${root}/src`, { recursive: true });
writeFileSync(`${root}/src/index.ts`, '// Public entry point.\nexport {};\n');
writeFileSync(`${root}/project.json`, JSON.stringify({ name, sourceRoot: `${root}/src`, projectType: 'library', tags: [`scope:${scope}`, `type:${type}`], targets: {
  lint: command(`eslint ${root}`), typecheck: command(`tsc --noEmit -p ${root}/tsconfig.json`),
  test: command(`vitest run --project ${group} ${root} --passWithNoTests`),
  build: { ...command(`tsc -p ${root}/tsconfig.json --noEmit false --declaration --emitDeclarationOnly --outDir dist/${root}`), outputs: [`{workspaceRoot}/dist/${root}`] }
}}, null, 2) + '\n');
writeFileSync(`${root}/tsconfig.json`, JSON.stringify({ extends: '../../tsconfig.base.json', compilerOptions: { lib: ['ES2022', ...(scope === 'shared' && !['domain','contracts'].includes(type) ? ['DOM', 'DOM.Iterable'] : [])], types: scope === 'server' ? ['node'] : [] }, include: ['src/**/*.ts','src/**/*.tsx'], exclude: ['src/**/*.spec.ts','src/**/*.spec.tsx'] }, null, 2) + '\n');
base.compilerOptions.paths[`@torob-ticket/${name}`] = [`${root}/src/index.ts`];
writeFileSync(configPath, JSON.stringify(base, null, 2) + '\n');
writeFileSync(vitestPath, vitestSource.replace(groupMarker, `${groupMarker}'${root}/src/**/*.spec.${group === 'ui' ? '{ts,tsx}' : 'ts'}', `));
console.log(`Created ${root} (scope:${scope}, type:${type}). Add behavior tests when implementing the library.`);
