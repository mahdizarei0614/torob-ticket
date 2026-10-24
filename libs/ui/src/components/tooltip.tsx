import { Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components';
import { type ReactElement, type ReactNode } from 'react';
import { languageProps, type Language } from './language';
import styles from '../styles/primitives.module.css';
export function Tooltip({
  children,
  content,
  language = 'fa',
  isOpen,
  onOpenChange,
}: {
  children: ReactElement;
  content: ReactNode;
  language?: Language;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <TooltipTrigger delay={400} closeDelay={0} isOpen={isOpen} onOpenChange={onOpenChange}>
      {children}
      <AriaTooltip className={styles.tooltip} {...languageProps(language)}>
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
