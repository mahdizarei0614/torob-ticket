import {
  Button,
  ComboBox as AriaComboBox,
  ComboBoxStateContext,
  Group,
  I18nProvider,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
} from 'react-aria-components';
import { useContext, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useOverlayPosition } from 'react-aria/useOverlayPosition';
import { Code, languageProps, type Language } from './language';
import { FieldErrorTooltip } from './field-error-tooltip';
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

function focusedAnchorVisible(input: HTMLInputElement | null): boolean {
  const view = input?.ownerDocument.defaultView;
  if (!input || !view || !input.isConnected || input.disabled || input.ownerDocument.activeElement !== input) return false;
  const box = input.getBoundingClientRect();
  let left = Math.max(0, box.left), right = Math.min(view.innerWidth, box.right), top = Math.max(0, box.top), bottom = Math.min(view.innerHeight, box.bottom);
  for (let ancestor = input.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = view.getComputedStyle(ancestor);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity !== '' && Number(style.opacity) === 0) return false;
    const clipX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX || style.overflow), clipY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY || style.overflow);
    if (clipX || clipY) {
      const clip = ancestor.getBoundingClientRect(), border = (name: 'borderLeftWidth' | 'borderRightWidth' | 'borderTopWidth' | 'borderBottomWidth') => parseFloat(style[name]) || 0;
      if (clipX) { left = Math.max(left, clip.left + border('borderLeftWidth')); right = Math.min(right, clip.right - border('borderRightWidth')); }
      if (clipY) { top = Math.max(top, clip.top + border('borderTopWidth')); bottom = Math.min(bottom, clip.bottom - border('borderBottomWidth')); }
    }
  }
  return right > left && bottom > top;
}

/** Keep the public ComboBox state authoritative while its visible anchor moves. */
function ComboBoxPopover({ inputRef, groupRef, popoverRef, listBoxRef, language, children }: {
  inputRef: RefObject<HTMLInputElement | null>;
  groupRef: RefObject<HTMLDivElement | null>;
  popoverRef: RefObject<HTMLElement | null>;
  listBoxRef: RefObject<HTMLDivElement | null>;
  language: Language;
  children: ReactNode;
}) {
  const state = useContext(ComboBoxStateContext), present = state !== null;
  const live = useRef(state); live.current = state;
  const scroll = useRef<Event | undefined>(undefined);
  const position = useOverlayPosition({
    targetRef: groupRef, overlayRef: popoverRef, scrollRef: listBoxRef,
    placement: 'bottom start', offset: 8, containerPadding: 12, shouldFlip: true,
    isOpen: state?.isOpen ?? false, onClose: null,
  });
  const updatePosition = useRef(position.updatePosition); updatePosition.current = position.updatePosition;
  const ownsScroll = (event: Event) => {
    const anchor = groupRef.current, target = event.target;
    return !!anchor && (target === anchor.ownerDocument || target === anchor.ownerDocument.defaultView || target instanceof Node && target.contains(anchor));
  };
  useLayoutEffect(() => {
    if (!present) return;
    const view = inputRef.current?.ownerDocument.defaultView;
    if (!view) return;
    const moving = (event: Event) => {
      const anchor = groupRef.current, target = event.target;
      if (!live.current?.isOpen || !anchor || !(target === anchor.ownerDocument || target === view || target instanceof Node && target.contains(anchor))) return;
      scroll.current = event;
      if (focusedAnchorVisible(inputRef.current)) updatePosition.current();
    };
    // Register before the popover's passive scroll-dismiss listener. Event phase
    // is nonzero only during this real dispatch; no timer or reopening is needed.
    view.addEventListener('scroll', moving, true);
    return () => { view.removeEventListener('scroll', moving, true); scroll.current = undefined; };
  }, [present, inputRef, groupRef]);
  return <Popover ref={popoverRef} triggerRef={groupRef} isOpen={state?.isOpen} onOpenChange={open => {
    const current = live.current;
    if (!current) return;
    if (open) { current.open(); return; }
    const event = scroll.current;
    if (current.isOpen && event && event.eventPhase !== 0 && ownsScroll(event) && focusedAnchorVisible(inputRef.current)) return;
    current.close();
  }} placement={position.placement === 'top' ? 'top start' : 'bottom start'} style={position.overlayProps.style} className={styles.popover} {...languageProps(language)}>{children}</Popover>;
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
  const group = useRef<HTMLDivElement>(null), popover = useRef<HTMLElement>(null), listBox = useRef<HTMLDivElement>(null);
  const errorAnchor = useRef<HTMLDivElement>(null);
  const filtered = items.filter(
    (item) =>
      item.label.toLocaleLowerCase(language).includes(inputValue.toLocaleLowerCase(language)) ||
      item.code?.toLowerCase().includes(inputValue.toLowerCase()),
  );
  return (
    <I18nProvider locale={language}>
      <AriaComboBox
        ref={errorAnchor}
        className={styles.field}
        {...languageProps(language)}
        items={filtered}
        value={selectedKey}
        onChange={(key) => {
          const id = key === null ? null : String(key);
          onSelectionChange(id);
          // Invalidating a selection while typing/blur does not erase the query.
          // The explicit clear action below owns clearing both controlled values.
          if (id !== null) onInputChange(items.find((item) => item.id === id)?.label ?? '');
        }}
        inputValue={inputValue}
        onInputChange={onInputChange}
        isDisabled={isDisabled}
        isInvalid={!!error}
        disabledKeys={items.filter((item) => item.disabled).map((item) => item.id)}
        allowsEmptyCollection
        // Keep a raw query as input text when Escape/blur dismisses the menu.
        // The controlled selected key stays null until an actual option wins.
        allowsCustomValue
        menuTrigger="focus"
      >
        <Label className={styles.label}>{label}</Label>
        <Group ref={group} className={styles.inputRow}>
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
        <ComboBoxPopover inputRef={input} groupRef={group} popoverRef={popover} listBoxRef={listBox} language={language}>
          <ListBox<ComboBoxItem>
            ref={listBox}
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
        </ComboBoxPopover>
      </AriaComboBox>
      {/* RAC's collection builder renders its child tree while collecting.
          Keep portalled feedback outside that tree so it has one live owner. */}
      <FieldErrorTooltip anchorRef={errorAnchor} language={language} disabled={isDisabled} messages={error ? [{ id: errorId, message: error }] : []}/>
    </I18nProvider>
  );
}
