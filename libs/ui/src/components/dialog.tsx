import {useMotionPolicy} from '../motion/motion-surface';
import {motion} from 'motion/react';
import {useMotionEnvironment,resolveMotionPolicy} from '../motion/motion-policy';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { createContext, useContext, useRef, useCallback, type ReactNode } from 'react';
const DialogSuspensionContext=createContext(false);
export const DialogSuspensionProvider=DialogSuspensionContext.Provider;
import { Button } from './button';
import { languageProps, type Language } from './language';
import styles from '../styles/primitives.module.css';
// A foreground portal owns its entry; background coverage does not suppress it.
const MotionDialog=motion.create(AriaDialog);
export interface DialogProps {
  title: string;
  language?: Language;
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mobileFullscreen?: boolean;
  /** Keep dismissal available while a long dialog body scrolls; opt-in. */
  stickyHeader?: boolean;
  size?: 'standard'|'wide'|'compact';
  initialScrollTop?: number;
  isDismissable?: boolean;
}
export function Dialog({
  title,
  language = 'fa',
  children,
  isOpen,
  onOpenChange,
  mobileFullscreen = false,
  stickyHeader = false,
  size = 'standard',
  initialScrollTop=0,
  isDismissable=true,
}: DialogProps) {
  const suspended=useContext(DialogSuspensionContext);
  const environment=useMotionEnvironment();const policy=useMotionPolicy();const motionEnabled=resolveMotionPolicy({...environment,covered:suspended,disabled:policy.disabled});
  const scroll=useRef(initialScrollTop);
  const modalRef=useCallback((node:HTMLDivElement|null)=>{if(node)node.scrollTop=scroll.current;},[]);
  return (
    <ModalOverlay className={styles.overlay} isOpen={isOpen && !suspended} onOpenChange={next=>{if(!suspended)onOpenChange(next);}} isDismissable={isDismissable}>
      <Modal ref={modalRef} data-dialog-scroll onScroll={event=>{scroll.current=event.currentTarget.scrollTop;}} className={styles.modal} data-mobile-fullscreen={mobileFullscreen} data-dialog-size={size} {...languageProps(language)}>
        <MotionDialog className={styles.dialog} data-modal-motion={motionEnabled?'finite':'static'} initial={motionEnabled?{opacity:0,y:8}:false} animate={{opacity:1,y:0}} transition={{duration:motionEnabled?.22:0,ease:'easeOut'}}>
          <div className={styles.dialogHeader} data-sticky={stickyHeader || undefined}>
            <Heading slot="title" className={styles.dialogTitle}>
              {title}
            </Heading>
            <Button
              language={language}
              variant="quiet"
              aria-label={language === 'fa' ? 'بستن' : 'Close'}
              onPress={() => onOpenChange(false)}
            >
              <span aria-hidden="true">×</span>
            </Button>
          </div>
          {children}
        </MotionDialog>
      </Modal>
    </ModalOverlay>
  );
}
