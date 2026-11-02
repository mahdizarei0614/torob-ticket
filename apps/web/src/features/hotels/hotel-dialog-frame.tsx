import type { ReactNode } from 'react';
import type { CatalogSnapshot, SessionInfo } from '@torob-ticket/contracts';
import { Dialog, LoadingSkeleton } from '@torob-ticket/ui';
import type { HotelDiscovery } from './use-hotel-discovery';
import styles from './hotels.module.css';

export interface HotelDialogProps { model: HotelDiscovery; catalog: CatalogSnapshot; session: SessionInfo; canApplyTrip: boolean; referralAction?: { quoteId: string; node: ReactNode }; initialScrollTop?: number }

export function HotelDialogFrame({ model, catalog, initialScrollTop = 0, children }: HotelDialogProps & { children: ReactNode }) {
  const city = catalog.cities.find(item => item.id === model.state.trip.query.destinationCityId);
  return <Dialog title={`هتل‌های ${city?.name ?? 'مقصد'}`} isOpen={model.open} onOpenChange={next => { if (!next) model.closeDialog(); }} mobileFullscreen stickyHeader size="wide" initialScrollTop={initialScrollTop}>{children}</Dialog>;
}

/** Reserve the real map/cards split without importing a map or offer presentation. */
export function HotelDialogLoading() {
  return <div className={styles.arrivalDialog} data-hotel-loading role="status" aria-label="در حال آماده‌سازی اقامتگاه‌ها">
    <span className={styles.srOnly}>در حال آماده‌سازی نقشه و اقامتگاه‌ها…</span>
    <div className={styles.hotelSplitFrame}><div className={styles.hotelSplit}>
      <div className={styles.hotelMapPane}><div className={styles.arrivalWaiting}><LoadingSkeleton rows={3} /></div></div>
      <div className={styles.hotelCollectionPane}><LoadingSkeleton rows={3} /></div>
    </div></div>
  </div>;
}
