import { CatalogSnapshotSchema, type CatalogSnapshot } from '@torob-ticket/contracts';
import { fixtureIdentity } from './identity';
import { cities } from './catalog/cities';
import { places } from './catalog/places';
import { supportedConnections } from './catalog/connections';
import { classChoices,providers } from './catalog/providers';
import { catalog as legacyCatalog } from './legacy-v1/catalog';
export const catalog:CatalogSnapshot=CatalogSnapshotSchema.parse({...fixtureIdentity,cities,places,supportedConnections,classChoices,providerCapabilities:providers});
export function catalogForIdentity(fixtureVersion:string,catalogRevision:string):CatalogSnapshot {
  if(fixtureVersion===fixtureIdentity.fixtureVersion&&catalogRevision===fixtureIdentity.catalogRevision) return structuredClone(catalog);
  if(fixtureVersion==='showcase-v1'&&catalogRevision==='catalog-v1') return structuredClone(legacyCatalog);
  if(fixtureVersion==='foundation-v1'&&catalogRevision==='foundation-catalog-v1') return {fixtureVersion,catalogRevision,cities:[],places:[],supportedConnections:[],classChoices:[],providerCapabilities:[]};
  throw new RangeError('Unsupported catalog version');
}
