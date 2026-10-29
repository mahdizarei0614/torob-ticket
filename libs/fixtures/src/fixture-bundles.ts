import { catalog } from './catalog';
import { fixtureIdentity, fixtureSourceRevision } from './identity';
import { hotels, roomRateTemplates } from './catalog/hotels';
import { catalog as legacyCatalog } from './legacy-v1/catalog';
import { fixtureIdentity as legacyIdentity } from './legacy-v1/identity';
import { hotels as legacyHotels, roomRateTemplates as legacyRates } from './legacy-v1/catalog/hotels';

import { catalog as previousCatalog } from './legacy-v2/catalog';
import { fixtureIdentity as previousIdentity } from './legacy-v2/identity';
import { hotels as previousHotels, roomRateTemplates as previousRates } from './legacy-v2/catalog/hotels';

/** Insert-only seed versions. Never rewrite a persisted root or migrate its quote evidence. */
export const fixtureBundles = [
  { identity: legacyIdentity, catalog: legacyCatalog, hotels: legacyHotels, roomRateTemplates: legacyRates, sourceRevision: fixtureSourceRevision(legacyIdentity.fixtureVersion), createdAt: '2026-10-24T00:00:00.000Z' },
  { identity: previousIdentity, catalog: previousCatalog, hotels: previousHotels, roomRateTemplates: previousRates, sourceRevision: fixtureSourceRevision(previousIdentity.fixtureVersion), createdAt: '2026-10-29T00:00:00.000Z' },
  { identity: fixtureIdentity, catalog, hotels, roomRateTemplates, sourceRevision: fixtureSourceRevision(fixtureIdentity.fixtureVersion), createdAt: '2026-10-29T00:00:00.000Z' },
] as const;
