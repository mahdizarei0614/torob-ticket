import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { type ReactNode } from 'react';
import { languageProps, type Language } from './language';
import styles from '../styles/primitives.module.css';
export interface ButtonProps extends Omit<AriaButtonProps, 'children' | 'className' | 'isPending'> {
  children: ReactNode;
  language?: Language;
  variant?: 'primary' | 'secondary' | 'quiet';
  isLoading?: boolean;
}
export function Button({
  children,
  language = 'fa',
  variant = 'primary',
  isLoading = false,
  isDisabled,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      {...languageProps(language)}
      className={styles.button}
      data-variant={variant}
      isDisabled={isDisabled}
      isPending={isLoading}
    >
      {isLoading && (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.srOnly}>{language === 'fa' ? 'در حال بارگذاری، ' : 'Loading, '}</span>
        </>
      )}
      {children}
    </AriaButton>
  );
}
