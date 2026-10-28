import { z } from 'zod';

const Coordinate = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
const Line = z.array(Coordinate).min(2).max(2048);
const Geometry = z.discriminatedUnion('type', [
  z.object({ type: z.literal('LineString'), coordinates: Line }),
  z.object({ type: z.literal('MultiLineString'), coordinates: z.array(Line).min(1).max(256) }),
]);

/** Bundled decorative boundaries are bounded independently of selectable cities. */
export const ProvinceBoundaryAsset = z.object({
  revision: z.string().min(1), navigation: z.literal(false),
  boundaries: z.array(z.object({ geometry: Geometry })).max(128),
}).superRefine((asset, context) => {
  const vertices = asset.boundaries.reduce((sum, { geometry }) => sum + (geometry.type === 'LineString'
    ? geometry.coordinates.length : geometry.coordinates.reduce((count, line) => count + line.length, 0)), 0);
  if (vertices > 12000) context.addIssue({ code: 'custom', path: ['boundaries'], message: 'Boundary vertex budget exceeded' });
});
