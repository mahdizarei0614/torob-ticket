import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import { useMotionPolicy } from '@torob-ticket/ui';
import type { SearchField, SearchFieldErrors } from './search-url';
import styles from './search.module.css';

export const SearchFieldFeedbackContext = createContext<{ errors: SearchFieldErrors; attempt: number; prefix: string; blocked: boolean }>({ errors: {}, attempt: 0, prefix: 'search-feedback', blocked: false });
export function useSearchFieldFeedback(...fields: SearchField[]) {
  const feedback = useContext(SearchFieldFeedbackContext);
  const errors = fields.flatMap(field => feedback.errors[field] ? [{ field, message: feedback.errors[field]!, id: `${feedback.prefix}-${field}-error` }] : []);
  return { ...feedback, errors, describedBy: errors.map(error => error.id).join(' ') || undefined };
}
/** Only an explicit attempt starts a finite shake. Corrections and motion policy settle it. */
export function SearchFieldFeedback({ fields, children, label, showError = true }: { fields: SearchField[]; children?: ReactNode; label?: string; showError?: boolean }) {
  const feedback = useSearchFieldFeedback(...fields), controls = useAnimationControls();
  const policy = useMotionPolicy({ disabled: feedback.blocked });
  const invalid = feedback.errors.length > 0, seen = useRef(feedback.attempt);
  useLayoutEffect(() => {
    const fresh = seen.current !== feedback.attempt; seen.current = feedback.attempt;
    controls.stop();
    if (!policy.enabled || !invalid || !fresh) { controls.set({ x: 0 }); return; }
    void controls.start({ x: [null, -5, 5, -3, 3, 0], transition: { duration: .32, ease: 'easeInOut' } });
    return () => controls.stop();
  }, [controls, feedback.attempt, invalid, policy.enabled]);
  return <motion.div className={styles.fieldFeedback} data-search-field={fields.join(' ')} data-invalid={invalid || undefined} data-feedback-attempt={invalid ? feedback.attempt : undefined} data-feedback-motion={policy.enabled ? 'finite' : 'static'} role={label ? 'group' : undefined} aria-label={label} aria-invalid={invalid || undefined} aria-describedby={showError ? feedback.describedBy : undefined} initial={false} animate={controls}>
    {children}
    {showError && feedback.errors.map(error => <p className={styles.fieldError} id={error.id} key={error.field} role="alert">{error.message}</p>)}
  </motion.div>;
}
