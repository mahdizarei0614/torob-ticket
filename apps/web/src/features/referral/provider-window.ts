/** Only an immutable confirmed receipt can be resolved by the tracked server route. */
export function providerOutboundUrl(referralId: string): string | undefined {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(referralId)) return undefined;
  return new URL(`/api/v1/referrals/${encodeURIComponent(referralId)}/outbound`, window.location.origin).href;
}

/** A blank window exists only inside this synchronous confirmed-handoff operation.
 * Sever its opener before allowing any external document to load. */
export function openProviderWindow(referralId: string, open: typeof window.open = window.open.bind(window)): boolean {
  const destination = providerOutboundUrl(referralId);
  if (!destination) return false;
  let tab: Window | null = null;
  try {
    tab = open('about:blank', '_blank');
    if (!tab || tab.closed) return false;
    tab.opener = null;
    tab.location.replace(destination);
    return true;
  } catch {
    try { tab?.close(); } catch { /* No external page is treated as opened. */ }
    return false;
  }
}
