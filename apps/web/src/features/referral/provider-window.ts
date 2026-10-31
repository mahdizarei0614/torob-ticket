/** Owner-selected destination for the current comparison-only provider handoff. */
export const PROVIDER_DESTINATION = 'https://zarei.xyz';

/** A blank window exists only inside this synchronous confirmed-handoff operation.
 * Sever its opener before allowing any external document to load. */
export function openProviderWindow(open: typeof window.open = window.open.bind(window)): boolean {
  let tab: Window | null = null;
  try {
    tab = open('about:blank', '_blank');
    if (!tab || tab.closed) return false;
    tab.opener = null;
    tab.location.replace(PROVIDER_DESTINATION);
    return true;
  } catch {
    try { tab?.close(); } catch { /* No external page is treated as opened. */ }
    return false;
  }
}
