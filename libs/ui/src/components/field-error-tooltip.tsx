import { Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useMotionPolicy } from '../motion/motion-surface';
import { languageProps, type Language } from './language';
import styles from '../styles/primitives.module.css';

export interface FieldErrorMessage { id: string; message: string }

/** Stable descriptions survive visual dismissal. The hoverable nonmodal tip
 * never focuses or changes the field's size; its anchor controls remain usable. */
export function FieldErrorTooltip({ anchorRef, messages, disabled = false, revealKey, language = 'fa' }: {
 anchorRef: RefObject<Element | null>;
 messages: readonly FieldErrorMessage[];
 disabled?: boolean;
 revealKey?: number;
 language?: Language;
}) {
 const [focused, setFocused] = useState(false), [hovered, setHovered] = useState(false), [tipHovered, setTipHovered] = useState(false), [dismissed, setDismissed] = useState(false);
 const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
 const clearLeave = () => { if (leaveTimer.current !== undefined) clearTimeout(leaveTimer.current); leaveTimer.current = undefined; };
 const dismiss = () => { clearLeave(); setDismissed(true); setTipHovered(false); };
 const policy = useMotionPolicy({ disabled });
 const identity = messages.map(message => message.id + ':' + message.message).join('|');
 // A wrapping field's DOM ref attaches after child layout effects. Subscribe
 // after all refs commit, then include any focus already established on mount.
 useEffect(() => {
  const anchor = anchorRef.current;
  if (!anchor) return;
  const contains = (target: EventTarget | null) => target instanceof Node && anchor.contains(target);
  setFocused(anchor.contains(document.activeElement));
  const focus = (event: Event) => { setFocused(true); if (!contains((event as FocusEvent).relatedTarget)) setDismissed(false); };
  const blur = (event: Event) => { if (!contains((event as FocusEvent).relatedTarget)) setFocused(false); };
  const enter = () => { clearLeave(); setHovered(true); setTipHovered(false); setDismissed(false); };
  const leave = () => { clearLeave(); leaveTimer.current = setTimeout(() => { leaveTimer.current = undefined; setHovered(false); }, 120); };
  anchor.addEventListener('focusin', focus); anchor.addEventListener('focusout', blur);
  anchor.addEventListener('mouseenter', enter); anchor.addEventListener('mouseleave', leave);
  return () => { clearLeave(); anchor.removeEventListener('focusin', focus); anchor.removeEventListener('focusout', blur); anchor.removeEventListener('mouseenter', enter); anchor.removeEventListener('mouseleave', leave); };
 }, [anchorRef]);
 useEffect(() => setDismissed(false), [identity, revealKey]);
 useEffect(() => {
  if (!messages.length || disabled || policy.covered || !policy.documentVisible) { clearLeave(); setHovered(false); setTipHovered(false); }
 }, [messages.length, disabled, policy.covered, policy.documentVisible]);
 const open = messages.length > 0 && !disabled && !policy.covered && !policy.disabled && policy.documentVisible && (focused || hovered || tipHovered) && !dismissed;
 useEffect(() => {
  if (!open) return;
  // Capture handles hover-only tips while focus is elsewhere. Do not consume
  // Escape: the same event still belongs to an open combobox/calendar.
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
  document.addEventListener('keydown', escape, true);
  return () => document.removeEventListener('keydown', escape, true);
 }, [open]);
 return <>
  {messages.map(message => <span key={message.id} id={message.id} className={styles.srOnly} data-field-error-description>{message.message}</span>)}
  <TooltipTrigger delay={0} closeDelay={120} isOpen={open} onOpenChange={next => {
   // This controlled field owns its focus/hover union. RAC's tooltip hover-end
   // notification cannot dismiss a still-focused field or the gap crossing.
   if (!next && !focused && !hovered && !tipHovered) dismiss();
  }}>
   <AriaTooltip triggerRef={anchorRef} placement="top" shouldFlip={false} offset={8} containerPadding={12} className={styles.fieldTooltip} data-react-aria-top-layer data-field-error-tooltip data-tooltip-motion={policy.enabled ? 'finite' : 'static'} onMouseEnter={() => { clearLeave(); setHovered(false); setTipHovered(true); }} onMouseLeave={() => { clearLeave(); leaveTimer.current = setTimeout(() => { leaveTimer.current = undefined; setTipHovered(false); }, 120); }} onMouseDown={event => event.preventDefault()} {...languageProps(language)}>
    {messages.map(message => <span key={message.id}>{message.message}</span>)}
   </AriaTooltip>
  </TooltipTrigger>
 </>;
}
