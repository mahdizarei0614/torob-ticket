/** Lightweight host entry: Three and renderer stay behind the provider's lazy boundary. */
export * from './graphics-provider';
export * from './graphics-view';
// Pure camera intent math stays available without eagerly loading Three/R3F scenes.
export { contextForPoints } from './geo/projection';
export type { CameraIntent } from './scenes/scene-surface';
