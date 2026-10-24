import { type ReactNode } from 'react';
import { languageProps, type Language } from './language';
import styles from '../styles/primitives.module.css';
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
const markers: Record<StatusTone, string> = {
  neutral: '—',
  info: 'i',
  success: '✓',
  warning: '!',
  danger: '×',
};
/** Text is required: color is never the sole carrier of state. Live announcements are opt-in. */
export function Status({
  tone = 'neutral',
  children,
  language = 'fa',
  live = false,
}: {
  tone?: StatusTone;
  children: ReactNode;
  language?: Language;
  live?: boolean;
}) {
  return (
    <span
      className={styles.status}
      data-tone={tone}
      {...languageProps(language)}
      role={live ? 'status' : undefined}
    >
      <span aria-hidden="true">{markers[tone]}</span>
      {children}
    </span>
  );
}
