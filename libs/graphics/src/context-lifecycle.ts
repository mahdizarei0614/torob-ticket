export type GraphicsStatus = 'loading' | 'ready' | 'unavailable' | 'shader-error' | 'context-lost';
/** Prevent default is essential: without it the browser will not restore the context. */
export function observeContextLifecycle(canvas: HTMLCanvasElement, onLost: () => void, onRestored: () => void) {
  const lost = (event: Event) => { event.preventDefault(); onLost(); };
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  return () => {
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
  };
}
