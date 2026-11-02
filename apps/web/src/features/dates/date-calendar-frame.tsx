import type { ReactNode } from 'react';
import { Button, Dialog } from '@torob-ticket/ui';
import styles from './dates.module.css';

/** The frame is immediate, even while calendar code is loading or unavailable. */
export function DateCalendarFrame({ children, canApply, onApply, onCancel }: { children: ReactNode; canApply: boolean; onApply: () => void; onCancel: () => void }) {
  return <Dialog title="انتخاب تاریخ سفر" size="compact" isOpen onOpenChange={open => { if (!open) onCancel(); }}>
    {children}
    <div className={styles.calendarFooter}><Button type="button" onPress={onApply} isDisabled={!canApply}>اعمال تاریخ‌ها</Button><Button type="button" variant="quiet" onPress={onCancel}>انصراف</Button></div>
  </Dialog>;
}
