import { I18nProvider, Label, Radio, RadioGroup } from 'react-aria-components';
import { type ReactNode } from 'react';
import { languageProps, type Language } from './language';
import styles from '../styles/primitives.module.css';
export interface SegmentedControlProps {
  label: string;
  language?: Language;
  value: string;
  onChange: (value: string) => void;
  options: readonly { id: string; label: string; icon?: ReactNode; disabled?: boolean }[];
  isDisabled?: boolean;
  hideLabel?: boolean;
}
export function SegmentedControl({
  label,
  language = 'fa',
  value,
  onChange,
  options,
  isDisabled,
  hideLabel = false,
}: SegmentedControlProps) {
  return (
    <I18nProvider locale={language}>
      <RadioGroup
        className={styles.field}
        {...languageProps(language)}
        value={value}
        onChange={onChange}
        orientation="horizontal"
        isDisabled={isDisabled}
      >
        <Label className={hideLabel ? styles.srOnly : styles.label}>{label}</Label>
        <div className={styles.segments}>
          {options.map((option) => (
            <Radio className={styles.radio} key={option.id} value={option.id} isDisabled={option.disabled}>
              {option.icon && <span aria-hidden="true">{option.icon}</span>}
              {option.label}
            </Radio>
          ))}
        </div>
      </RadioGroup>
    </I18nProvider>
  );
}
