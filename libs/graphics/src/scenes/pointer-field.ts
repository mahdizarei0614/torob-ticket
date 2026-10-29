/** Broad fluid interaction support; illumination uses its own smaller radius. */
export const POINTER_REPULSION_PX = 12;
export const POINTER_REPULSION_RADIUS_PX = 110;
export const pointerRepulsionRadiusPx = (width: number, height: number) => Math.max(0,Math.min(POINTER_REPULSION_RADIUS_PX,width*.2,height*.22));
