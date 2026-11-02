import { useLayoutEffect, useRef } from 'react';
import { Button, LoadingSkeleton } from '@torob-ticket/ui';

/** This route frame inherits the current semantic palette until the receipt loads. */
export function ProviderRouteFrame({ retained, unavailable = false, onReturn }: { retained: boolean; unavailable?: boolean; onReturn: () => void }) {
  const main = useRef<HTMLElement>(null);
  useLayoutEffect(() => { main.current?.focus({ preventScroll: true }); }, [unavailable]);
  return <main ref={main} tabIndex={-1} lang="fa" dir="rtl" data-provider-route-frame data-provider-route-state={unavailable ? 'unavailable' : 'loading'} style={{ padding: 'var(--space-6)' }}>
    <h1>جزئیات ارجاع</h1>
    <p role={unavailable ? 'alert' : 'status'}>{unavailable ? 'نمایش جزئیات ارجاع ممکن نشد.' : 'در حال آماده‌سازی جزئیات ارجاع…'}</p>
    {!unavailable && <LoadingSkeleton rows={2} />}
    {retained ? <Button onPress={onReturn}>بازگشت به مقایسه سفر</Button> : <a href="/">شروع مقایسه تازه</a>}
  </main>;
}
