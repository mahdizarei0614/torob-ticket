import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { build } from 'vite';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const schemaPath = resolve(root, 'libs/contracts/src/admin-search.ts');
const clientPath = resolve(root, 'libs/client/src/index.ts');
const adminClientPath = resolve(root, 'libs/client/src/admin-client.ts');
const names = ['AdminSearchListQuerySchema', 'AdminSearchSectionSchema', 'AdminSearchInspectionQuerySchema', 'AdminSearchSummarySchema', 'AdminSearchListSchema', 'AdminSearchEvidenceSchema', 'AdminSearchInspectionSchema', 'AdminReplayInputSchema', 'AdminProviderObservationSchema', 'AdminProviderHealthSchema'];

/** Real installed production bundler, with optional in-memory proposal for pre-edit proof. */
export async function checkAdminSchemaBundling(sourceOverride, clientOverride) {
  const source = sourceOverride ?? await readFile(schemaPath, 'utf8');
  async function bundle(used, consumer = false, usedClient = false) {
    let renderedLength = 0, adminClientRenderedLength = 0;
    const result = await build({
      configFile: false, root, logLevel: 'silent', resolve: { alias: { '@torob-ticket/contracts': resolve(root, 'libs/contracts/src/index.ts') } },
      plugins: [{
        name: 'admin-schema-behavior-regression',
        resolveId(id) { if (id === 'virtual:admin-entry') return '\0admin-entry.ts'; if (id === 'virtual:admin-schemas') return schemaPath; },
        load(id) { if (id === '\0admin-entry.ts') return usedClient ? `export {adminClient,createAdminClient} from ${JSON.stringify(clientPath)};` : consumer ? `export {apiClient} from ${JSON.stringify(clientPath)};` : used ? 'export * from "virtual:admin-schemas";' : 'import * as unused from "virtual:admin-schemas"; export const marker = "consumer";'; if (id === schemaPath) return source; if (id === adminClientPath && clientOverride !== undefined) return clientOverride; },
        generateBundle(_options, output) {
          for (const chunk of Object.values(output)) if (chunk.type === 'chunk') { renderedLength += chunk.modules[schemaPath]?.renderedLength ?? 0; adminClientRenderedLength += chunk.modules[adminClientPath]?.renderedLength ?? 0; }
        },
      }],
      build: { write: false, minify: true, rolldownOptions: { input: 'virtual:admin-entry', preserveEntrySignatures: 'strict', output: { format: 'es' } } },
    });
    const chunks = result.output.filter(item => item.type === 'chunk');
    assert.equal(chunks.length, 1, 'The real bundler probe must produce one self-contained JS chunk');
    assert.equal(chunks[0].imports.length, 0, 'The validation proof must execute bundled schemas, not external imports');
    return { code: chunks[0].code, renderedLength, adminClientRenderedLength };
  }
  const unused = await bundle(false);
  assert.ok(unused.code.includes('consumer'), 'The unused probe must retain its real consumer entry');
  assert.equal(unused.renderedLength, 0, 'Unused admin-search construction must contribute no consumer module code');
  assert.ok(!unused.code.includes('inspection-lineage-or-page-mismatch'), 'Unused admin evidence validation must not survive in consumer startup');
  assert.ok(!unused.code.includes('provider-health-count-or-lineage-mismatch'), 'Unused provider-health construction must not survive');
  const consumer = await bundle(false, true);
  assert.equal(consumer.adminClientRenderedLength, 0, 'A real consumer client-barrel import must not construct the unused admin singleton');
  assert.equal(consumer.renderedLength, 0, 'A real consumer client-barrel import must not retain admin evidence construction');
  assert.ok(!consumer.code.includes('inspection-lineage-or-page-mismatch'), 'Admin evidence must be absent through the real client barrel');
  const used = await bundle(true);
  const admin = await import(`data:text/javascript;base64,${Buffer.from(used.code).toString('base64')}`);
  assert.deepEqual(Object.keys(admin).sort(), [...names].sort(), 'Every original named schema export must remain available');
  assert.deepEqual(admin.AdminSearchListQuerySchema.parse({}), { offset: 0, limit: 25 });
  assert.deepEqual(admin.AdminSearchInspectionQuerySchema.parse({}), { offset: 0, limit: 25, section: 'events' });
  for (const value of [{ limit: '0' }, { limit: '101' }, { offset: '-1' }, { offset: '100001' }, { offset: '1e2' }, { limit: ['1', '2'] }, { unknown: 'x' }]) assert.equal(admin.AdminSearchListQuerySchema.safeParse(value).success, false);
  assert.equal(admin.AdminSearchInspectionQuerySchema.safeParse({ section: 'secrets' }).success, false);
  assert.equal(admin.AdminReplayInputSchema.safeParse({ clientGeneration: 'generation', extra: true }).success, false);
  const query = { mode: 'flight', scope: 'domestic', tripType: 'one-way', originCityId: 'tehran', destinationCityId: 'mashhad', departureDate: '2026-10-25', party: { adults: 1, children: 0, infants: 0 }, classCode: 'economy', filters: {}, sort: 'cheapest' };
  const instant = '2026-10-26T00:00:00.000Z';
  const snapshot = { searchId: 'run', clientGeneration: 'generation', query, status: 'complete', groups: [], providerStatuses: [], coverage: { expectedProviderIds: [], successfulProviderIds: [], failedProviderIds: [], pendingProviderIds: [], complete: true }, observedAt: instant };
  const summary = { searchId: 'run', clientGeneration: 'generation', query, status: 'complete', createdAt: instant, updatedAt: instant, fixtureVersion: 'fixture', mappingRevision: 'mapping', groupCount: 0, providerStatuses: [] };
  const good = { summary, snapshot, context: null, evidence: { section: 'events', offset: 0, limit: 25, total: 0, items: [] } };
  assert.equal(admin.AdminSearchInspectionSchema.safeParse(good).success, true);
  assert.equal(admin.AdminSearchInspectionSchema.safeParse({ ...good, summary: { ...summary, searchId: 'foreign' } }).success, false);
  assert.equal(admin.AdminSearchInspectionSchema.safeParse({ ...good, context: { auditId: 'context', kind: 'search-context', createdAt: instant, payload: { searchId: 'foreign' } } }).success, false);
  assert.equal(admin.AdminSearchInspectionSchema.safeParse({ ...good, evidence: { ...good.evidence, total: 1, items: [{ recordedAt: instant, event: { searchId: 'foreign', clientGeneration: 'generation', sequence: 1, type: 'provider-status', payload: { providerId: 'p', status: 'timeout', offerCount: 0 } } }] } }).success, false);
  assert.equal(admin.AdminSearchListSchema.safeParse({ offset: 0, limit: 1, total: 2, items: [summary, summary] }).success, false);
  assert.equal(admin.AdminSearchListSchema.safeParse({ offset: 0, limit: 25, total: 0, items: [summary] }).success, false);
  assert.deepEqual(admin.AdminProviderHealthSchema.parse({ providers: [{ providerId: 'p', totalRuns: 0, statusCounts: [], recent: [] }], recentLimit: 50 }).providers[0].recent, []);
  assert.equal(admin.AdminProviderHealthSchema.safeParse({ providers: [{ providerId: 'p', totalRuns: 0, statusCounts: [{ status: 'timeout', count: 1 }], recent: [] }], recentLimit: 50 }).success, false);
  assert.equal(admin.AdminSearchInspectionSchema.shape.summary, admin.AdminSearchSummarySchema, 'Factory exports must share the same concrete schema instances');
  const clientBundle = await bundle(false, false, true);
  assert.ok(clientBundle.renderedLength > 0 && clientBundle.adminClientRenderedLength > 0, 'Used admin client must retain its real validators');
  const exported = await import(`data:text/javascript;base64,${Buffer.from(clientBundle.code).toString('base64')}`);
  assert.equal(typeof exported.adminClient.searches, 'function');
  const calls = []; let response;
  const client = exported.createAdminClient(async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => response }; });
  assert.equal(calls.length, 0, 'Client construction alone must not call its transport');
  response = { offset: 0, limit: 25, total: 0, items: [] };
  assert.deepEqual(await client.searches({ mode: 'flight' }), response);
  assert.equal(calls[0].url, '/api/v1/admin/searches?mode=flight');
  assert.equal(calls[0].init.credentials, 'same-origin');
  response = { offset: 0, limit: 25, total: 0, items: [summary] };
  await assert.rejects(client.searches(), error => error.kind === 'schema');
  response = { ...good, summary: { ...summary, searchId: 'foreign' } };
  await assert.rejects(client.search('run'), error => error.kind === 'schema');
  response = { ...good, summary: { ...summary, searchId: 'foreign' }, snapshot: { ...snapshot, searchId: 'foreign' } };
  await assert.rejects(client.search('run'), error => error.kind === 'schema' && error.message === 'Search response ID mismatch');
  response = good;
  assert.equal((await client.search('run')).summary.searchId, 'run');
  return { sourceSha256: createHash('sha256').update(source).digest('hex'), unusedAdminModuleRenderedLength: unused.renderedLength, consumerAdminModuleRenderedLength: consumer.renderedLength, consumerAdminClientRenderedLength: consumer.adminClientRenderedLength, usedAdminModuleRenderedLength: used.renderedLength, usedAdminClientRenderedLength: clientBundle.adminClientRenderedLength, usedBundleBytes: Buffer.byteLength(used.code), exportedSchemas: names.length, controlledTransportCalls: calls.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  test('unused admin schemas disappear, while real bundled named schemas preserve validation', async () => {
    console.log(JSON.stringify(await checkAdminSchemaBundling()));
  });
}
