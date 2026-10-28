import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components';
import { Button, useMotionPolicy } from '@torob-ticket/ui';
import styles from './account.module.css';

/** The profile is a nonmodal anchored surface; outside interaction dismisses its current lease. */
export function AccountPopover({ trigger, children, isOpen, onOpenChange }: { trigger: ReactNode; children: ReactNode; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
 const policy = useMotionPolicy();
 const [surface, setSurface] = useState<HTMLElement | null>(null);
 const focused = useRef<HTMLElement | null>(null);
 const owner = useRef({ open: isOpen, epoch: 0 });
 if (owner.current.open !== isOpen) owner.current = { open: isOpen, epoch: owner.current.epoch + 1 };
 useLayoutEffect(() => {
  const epoch = owner.current.epoch;
  if (!isOpen || !surface) { focused.current = null; return; }
  const remember = (event: FocusEvent) => { if (event.target instanceof HTMLElement) focused.current = event.target; };
  const leave = (event: FocusEvent) => { if (event.relatedTarget instanceof Node && event.relatedTarget !== document.body && event.relatedTarget !== document.documentElement && !surface.contains(event.relatedTarget)) focused.current = null; };
  const active = document.activeElement;
  focused.current = active instanceof HTMLElement && surface.contains(active) ? active : null;
  surface.addEventListener('focusin', remember);
  surface.addEventListener('focusout', leave);
  // Native focus falls to body when an account mutation removes its focused control.
  const repair = () => {
   if (!owner.current.open || owner.current.epoch !== epoch || !surface.isConnected || !focused.current) return;
   if (focused.current.isConnected && !focused.current.matches(':disabled,[aria-disabled="true"],[data-disabled]')) return;
   const active = document.activeElement;
   if (active && active !== document.body && active !== document.documentElement) return;
   const close = surface.querySelector<HTMLButtonElement>('[data-profile-close]');
   close?.focus({ preventScroll: true });
  };
  const observer = new MutationObserver(repair);
  observer.observe(surface, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'data-disabled'] });
  return () => { observer.disconnect(); surface.removeEventListener('focusin', remember); surface.removeEventListener('focusout', leave); };
 }, [isOpen, surface]);
 return <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
  {trigger}
  <Popover isNonModal placement="bottom end" offset={8} containerPadding={12} className={styles.popover} data-profile-popover data-motion-policy={policy.enabled ? 'finite' : 'static'} lang="fa" dir="rtl">
   <Dialog ref={setSurface} className={styles.profileDialog}>
    <div className={styles.profileHeader}>
     <Heading slot="title">حساب کاربری</Heading>
     <Button variant="quiet" data-profile-close aria-label="بستن حساب کاربری" onPress={() => onOpenChange(false)}>×</Button>
    </div>
    {children}
   </Dialog>
  </Popover>
 </DialogTrigger>;
}
