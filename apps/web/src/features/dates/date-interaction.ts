/** Synchronous authorization fence, independent of a React render or selected day. */
export function createDateInteractions() {
  let epoch = 0;
  const listeners = new Set<() => void>();
  return {
    capture: () => epoch,
    isCurrent: (token: number) => token === epoch,
    invalidate() { epoch++; for (const listener of [...listeners]) listener(); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
export type DateInteractions = ReturnType<typeof createDateInteractions>;
