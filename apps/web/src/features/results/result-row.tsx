import { forwardRef, memo } from 'react';
import { JourneyCard, sameJourneyCardProps, type JourneyCardProps } from './journey-card';
import { ResultPresence } from './result-motion';
import styles from './results.module.css';

interface ResultRowProps extends JourneyCardProps {
 deferred: boolean;
 roundTrip: boolean;
 ordering: string;
}

/** Memoize the Motion owner as well as its card. The forwarded DOM ref retains
 * AnimatePresence pop-layout ownership and exact scroll/focus anchors. */
export const ResultRow = memo(forwardRef<HTMLDivElement, ResultRowProps>(function ResultRow({ deferred, roundTrip, ordering, ...card }, ref) {
 return <ResultPresence ref={ref} role="listitem" className={deferred ? `${styles.deferredRow} ${roundTrip ? styles.roundTripRow : ''}` : undefined} staticMotion={deferred} layout={!deferred} layoutDependency={ordering}>
  <JourneyCard {...card}/>
 </ResultPresence>;
}), (previous, next) => previous.deferred === next.deferred && previous.roundTrip === next.roundTrip
 && (next.deferred || previous.ordering === next.ordering)
 && sameJourneyCardProps(previous, next));
