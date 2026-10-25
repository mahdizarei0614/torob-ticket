import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { createContext, useContext, useRef, useCallback, type ReactNode } from 'react';
const DialogSuspensionContext=createContext(false);
export const DialogSuspensionProvider=DialogSuspensionContext.Provider;
import { Button } from './button';
import { languageProps, type Language } from './language';
import styles from '../styles/primitives.module.css';
export interface DialogProps {
  title: string;
  language?: Language;
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mobileFullscreen?: boolean;
  /** Keep dismissal available while a long dialog body scrolls; opt-in. */
  stickyHeader?: boolean;
  size?: 'standard'|'wide';
  initialScrollTop?: number;
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
}: DialogProps) {
  const suspended=useContext(DialogSuspensionContext);
  const scroll=useRef(initialScrollTop);
  const modalRef=useCallback((node:HTMLDivElement|null)=>{if(node)node.scrollTop=scroll.current;},[]);
  return (
    <ModalOverlay className={styles.overlay} isOpen={isOpen && !suspended} onOpenChange={next=>{if(!suspended)onOpenChange(next);}} isDismissable>
      <Modal ref={modalRef} data-dialog-scroll onScroll={event=>{scroll.current=event.currentTarget.scrollTop;}} className={styles.modal} data-mobile-fullscreen={mobileFullscreen} data-dialog-size={size} {...languageProps(language)}>
        <AriaDialog className={styles.dialog}>
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
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
