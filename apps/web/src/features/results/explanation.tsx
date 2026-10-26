import type { ComparisonGroup, SearchSnapshot } from '@torob-ticket/contracts';
import { minutes, toman } from './format';
import styles from './results.module.css';
export function Explanation({ group, snapshot }: { group: ComparisonGroup; snapshot: SearchSnapshot }) {
 const target = group.eligibleQuotes.find(quote => quote.quoteId === group.representativeQuoteId);
 if (!target) return null;
 const reasons = snapshot.explanations?.filter(reason => reason.baselineIds[1] === target.quoteId && reason.facts.targetQuoteVersion === target.version && snapshot.groups.some(g => g.eligibleQuotes.some(q => q.quoteId === reason.baselineIds[0] && q.version === reason.facts.baselineQuoteVersion))) ?? [];
 const price = reasons.find(reason => reason.reasonCode === 'price-difference');
 const time = reasons.find(reason => reason.reasonCode === 'time-saved');
 const provisional = reasons.some(reason => reason.facts.provisional === 1);
 if (!price && !(time && time.facts.minutes! > 0)) return null;
 return <div className={styles.reasons} aria-label="مقایسه با کم‌قیمت‌ترین پیشنهاد این جست‌وجو">{price && <span>{price.baselineIds[0] === target.quoteId ? `کمترین قیمت${provisional ? ' تا این لحظه' : ''}` : price.facts.amountRial === 0 ? 'هم‌قیمت گزینه مبنا' : `${toman(price.facts.amountRial!)} بیشتر از گزینه مبنا`}</span>}{time && time.facts.minutes! > 0 && <span>{minutes(time.facts.minutes!)} سریع‌تر از گزینه مبنا</span>}</div>;
}
