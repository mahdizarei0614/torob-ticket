import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';
const browserTypes = ['type:ui', 'type:graphics', 'type:contracts', 'type:domain', 'type:data'];
export default [
  { ignores: ['node_modules/**', 'dist/**', '.nx/**', 'coverage/**', '.superpowers/**', 'playwright-report/**', 'test-results/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@nx': nx },
    rules: {
      '@nx/enforce-module-boundaries': ['error', {
        enforceBuildableLibDependency: true,
        allow: [],
        depConstraints: [
          { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:shared'], bannedExternalImports: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', 'node:*'] },
          { sourceTag: 'scope:admin', onlyDependOnLibsWithTags: ['scope:shared'], bannedExternalImports: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', 'node:*'] },
          { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
          { sourceTag: 'scope:server', onlyDependOnLibsWithTags: ['scope:shared', 'scope:server'] },
          { sourceTag: 'type:contracts', onlyDependOnLibsWithTags: [], allowedExternalImports: ['zod', 'vitest'] },
          { sourceTag: 'type:domain', onlyDependOnLibsWithTags: ['type:contracts'], allowedExternalImports: ['@internationalized/date', 'vitest'] },
          { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:ui', 'type:contracts', 'type:domain'], bannedExternalImports: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', 'node:*'] },
          { sourceTag: 'type:graphics', onlyDependOnLibsWithTags: ['type:ui', 'type:graphics', 'type:contracts', 'type:domain'], bannedExternalImports: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', 'node:*'] },
          { allSourceTags: ['type:data', 'scope:shared'], onlyDependOnLibsWithTags: ['type:contracts', 'type:domain', 'type:data'], bannedExternalImports: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', 'node:*'] },
          { sourceTag: 'type:fixtures', onlyDependOnLibsWithTags: ['type:domain', 'type:contracts'] },
          { sourceTag: 'type:provider', onlyDependOnLibsWithTags: ['type:domain', 'type:contracts', 'type:fixtures'] },
          { allSourceTags: ['type:data', 'scope:server'], onlyDependOnLibsWithTags: ['type:domain', 'type:contracts'] },
          { allSourceTags: ['type:app', 'scope:web'], onlyDependOnLibsWithTags: browserTypes },
          { allSourceTags: ['type:app', 'scope:admin'], onlyDependOnLibsWithTags: browserTypes },
          { allSourceTags: ['type:app', 'scope:server'], onlyDependOnLibsWithTags: ['type:contracts', 'type:domain', 'type:data', 'type:fixtures', 'type:provider'] }
        ]
      }]
    }
  },
  { files: ['libs/contracts/src/**/*.spec.ts', 'libs/domain/src/**/*.spec.ts'], rules: { 'no-restricted-imports': ['error', { patterns: ['@nestjs/*', '@prisma/*', 'prisma', 'pg', '@torob-ticket/fixtures', '@torob-ticket/provider-adapters', '@torob-ticket/data-access'] }] } }
];
