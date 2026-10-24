import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { type ReactNode } from 'react';
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
}
export function Dialog({
  title,
  language = 'fa',
  children,
  isOpen,
  onOpenChange,
  mobileFullscreen = false,
}: DialogProps) {
  return (
    <ModalOverlay className={styles.overlay} isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal className={styles.modal} data-mobile-fullscreen={mobileFullscreen} {...languageProps(language)}>
        <AriaDialog className={styles.dialog}>
          <div className={styles.dialogHeader}>
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
