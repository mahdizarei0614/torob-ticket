module.exports = { extends: true, test: {
  name: 'api-integration', environment: 'node',
  include: ['apps/api/src/**/*.integration.spec.ts', 'apps/api/test/**/*.integration.spec.ts'],
  testTimeout: 15000, hookTimeout: 30000, fileParallelism: false,
} };
