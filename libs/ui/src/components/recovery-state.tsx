import { useId, type ReactNode } from 'react';
import { Button } from './button';
import styles from './recovery-state.module.css';
export interface RecoveryAction { id: string; label: string; onPress: () => void; disabled?: boolean }
export interface RecoveryStateProps { title: string; description: string; actions?: RecoveryAction[]; illustration?: ReactNode; children?: ReactNode; tone?: 'info' | 'warning' | 'error'; busy?: boolean; label?: string; language?: 'fa' | 'en' }
export function RecoveryState({ title, description, actions = [], illustration, children, tone = 'info', busy = false, label, language = 'fa' }: RecoveryStateProps) {
  const heading = useId();
  return <section className={styles.root} data-recovery-state={tone} aria-label={label} aria-labelledby={label ? undefined : heading} aria-busy={busy || undefined}>
    {illustration && <div className={styles.art}>{illustration}</div>}<div className={styles.content}><h3 id={heading}>{title}</h3><p role="status">{description}</p>{children}{actions.length > 0 && <div className={styles.actions}>{actions.map((action, index) => <Button language={language} key={action.id} variant={index ? 'quiet' : 'secondary'} isDisabled={busy || action.disabled} onPress={action.onPress}>{action.label}</Button>)}</div>}</div>
  </section>;
}
