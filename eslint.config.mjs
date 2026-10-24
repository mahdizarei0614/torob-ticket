import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';
const browserTypes = ['type:ui', 'type:graphics', 'type:contracts', 'type:domain', 'type:data'];
const dependencyConstraints = [
  { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:shared'], bannedExternalImports: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', 'node:*'] },
  { sourceTag: 'scope:admin', onlyDependOnLibsWithTags: ['scope:shared'], bannedExternalImports: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', 'node:*'] },
  { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
  { sourceTag: 'scope:server', onlyDependOnLibsWithTags: ['scope:shared', 'scope:server'] },
  { sourceTag: 'type:contracts', onlyDependOnLibsWithTags: [], allowedExternalImports: ['zod'] },
  { sourceTag: 'type:domain', onlyDependOnLibsWithTags: ['type:contracts'], allowedExternalImports: ['@internationalized/date'] },
  { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:ui', 'type:contracts', 'type:domain'], bannedExternalImports: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', 'node:*'] },
  { sourceTag: 'type:graphics', onlyDependOnLibsWithTags: ['type:ui', 'type:graphics', 'type:contracts', 'type:domain'], bannedExternalImports: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', 'node:*'] },
  { allSourceTags: ['type:data', 'scope:shared'], onlyDependOnLibsWithTags: ['type:contracts', 'type:domain', 'type:data'], bannedExternalImports: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', 'node:*'] },
  { sourceTag: 'type:fixtures', onlyDependOnLibsWithTags: ['type:domain', 'type:contracts'] },
  { sourceTag: 'type:provider', onlyDependOnLibsWithTags: ['type:domain', 'type:contracts', 'type:fixtures'] },
  { allSourceTags: ['type:data', 'scope:server'], onlyDependOnLibsWithTags: ['type:domain', 'type:contracts'] },
  { allSourceTags: ['type:app', 'scope:web'], onlyDependOnLibsWithTags: browserTypes },
  { allSourceTags: ['type:app', 'scope:admin'], onlyDependOnLibsWithTags: browserTypes },
  { allSourceTags: ['type:app', 'scope:server'], onlyDependOnLibsWithTags: ['type:contracts', 'type:domain', 'type:data', 'type:fixtures', 'type:provider'] }
];
const boundaryRule = (testFile = false) => ['error', {
  enforceBuildableLibDependency: true,
  allow: [],
  depConstraints: dependencyConstraints.map(constraint => testFile && constraint.allowedExternalImports
    ? { ...constraint, allowedExternalImports: [...constraint.allowedExternalImports, 'vitest'] }
    : constraint)
}];
export default [
  { ignores: ['node_modules/**', 'libs/data-access/src/generated/**', 'dist/**', '.nx/**', 'coverage/**', '.superpowers/**', 'playwright-report/**', 'test-results/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@nx': nx },
    rules: {
      '@nx/enforce-module-boundaries': boundaryRule()
    }
  },
  { files: ['**/*.spec.ts', '**/*.spec.tsx'], rules: { '@nx/enforce-module-boundaries': boundaryRule(true) } },
  { files: ['libs/contracts/src/**/*.spec.ts', 'libs/domain/src/**/*.spec.ts'], rules: { 'no-restricted-imports': ['error', { patterns: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', '@torob-ticket/fixtures', '@torob-ticket/provider-adapters', '@torob-ticket/data-access'] }] } }
];
