import {
  Button,
  ComboBox as AriaComboBox,
  Group,
  I18nProvider,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
} from 'react-aria-components';
import { useId, useRef } from 'react';
import { Code, languageProps, type Language } from './language';
import styles from '../styles/primitives.module.css';
export interface ComboBoxItem {
  id: string;
  label: string;
  code?: string;
  disabled?: boolean;
}
export interface ComboBoxProps {
  label: string;
  language?: Language;
  items: readonly ComboBoxItem[];
  selectedKey: string | null;
  onSelectionChange: (key: string | null) => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  description?: string;
  error?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  clearable?: boolean;
}
export function ComboBox({
  label,
  language = 'fa',
  items,
  selectedKey,
  onSelectionChange,
  inputValue,
  onInputChange,
  description,
  error,
  isDisabled,
  isLoading,
  placeholder,
  clearable = false,
}: ComboBoxProps) {
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const filtered = items.filter(
    (item) =>
      item.label.toLocaleLowerCase(language).includes(inputValue.toLocaleLowerCase(language)) ||
      item.code?.toLowerCase().includes(inputValue.toLowerCase()),
  );
  return (
    <I18nProvider locale={language}>
      <AriaComboBox
        className={styles.field}
        {...languageProps(language)}
        items={filtered}
        value={selectedKey}
        onChange={(key) => {
          const id = key === null ? null : String(key);
          onSelectionChange(id);
          onInputChange(items.find((item) => item.id === id)?.label ?? '');
        }}
        inputValue={inputValue}
        onInputChange={onInputChange}
        isDisabled={isDisabled}
        isInvalid={!!error}
        disabledKeys={items.filter((item) => item.disabled).map((item) => item.id)}
        allowsEmptyCollection
      >
        <Label className={styles.label}>{label}</Label>
        <Group className={styles.inputRow}>
          <Input
            ref={input}
            className={styles.input}
            placeholder={placeholder ?? (language === 'fa' ? 'جست‌وجو…' : 'Search…')}
            aria-describedby={error ? errorId : undefined}
            aria-busy={isLoading || undefined}
          />
          {clearable && (inputValue || selectedKey) && <button type="button" className={styles.clearButton} disabled={isDisabled} aria-label={language === 'fa' ? `پاک کردن ${label}` : `Clear ${label}`} onClick={() => { onSelectionChange(null); onInputChange(''); input.current?.focus(); }}><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m7 7 10 10M17 7 7 17"/></svg></button>}
          <Button
            className={styles.openButton}
            aria-label={language === 'fa' ? 'نمایش گزینه‌ها' : 'Show options'}
          >
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
          </Button>
        </Group>
        {description && (
          <Text slot="description" className={styles.description}>
            {description}
          </Text>
        )}
        {error && (
          <Text slot="errorMessage" id={errorId} className={styles.error}>
            {error}
          </Text>
        )}
        <Popover className={styles.popover} {...languageProps(language)}>
          <ListBox<ComboBoxItem>
            className={styles.list}
            renderEmptyState={() => (
              <p className={styles.description}>
                {isLoading
                  ? language === 'fa'
                    ? 'در حال بارگذاری…'
                    : 'Loading…'
                  : language === 'fa'
                    ? 'گزینه‌ای پیدا نشد'
                    : 'No matching options'}
              </p>
            )}
          >
            {(item) => (
              <ListBoxItem className={styles.item} id={item.id} textValue={item.label}>
                <Text slot="label">{item.label}</Text>
                {item.code && (
                  <span className={styles.code}>
                    <Code>{item.code}</Code>
                  </span>
                )}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </AriaComboBox>
    </I18nProvider>
  );
}
