import { z } from 'zod';
import { GeoPointSchema, IdSchema, ModeSchema, ScopeSchema } from './common';
import { PlaceSchema, TimeZoneSchema } from './offer';

export const CitySchema = z.strictObject({ id: IdSchema, name: IdSchema, countryCode: z.string().regex(/^[A-Z]{2}$/), point: GeoPointSchema, timeZone: TimeZoneSchema });
export type City = z.infer<typeof CitySchema>;
export const SupportedConnectionSchema = z.strictObject({ mode: ModeSchema, scope: ScopeSchema, originCityId: IdSchema, destinationCityId: IdSchema });
export type SupportedConnection = z.infer<typeof SupportedConnectionSchema>;
export const ClassChoiceSchema = z.strictObject({ code: IdSchema, mode: ModeSchema, name: IdSchema });
export type ClassChoice = z.infer<typeof ClassChoiceSchema>;
export const ProviderCapabilitiesSchema = z.strictObject({
  providerId: IdSchema, name: IdSchema, fictional: z.literal(true), modes: z.array(ModeSchema).min(1), scopes: z.array(ScopeSchema).min(1),
  classCodes: z.array(IdSchema), requiresChildAges: z.boolean(), requiresInfantAges: z.boolean(),
});
export type ProviderCapabilities = z.infer<typeof ProviderCapabilitiesSchema>;
export const CatalogSnapshotSchema = z.strictObject({ fixtureVersion: IdSchema, catalogRevision: IdSchema, cities: z.array(CitySchema), places: z.array(PlaceSchema), supportedConnections: z.array(SupportedConnectionSchema), classChoices: z.array(ClassChoiceSchema), providerCapabilities: z.array(ProviderCapabilitiesSchema) });
export type CatalogSnapshot = z.infer<typeof CatalogSnapshotSchema>;
