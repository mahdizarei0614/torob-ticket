import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ComboBox } from './combobox';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const cities = [{ id: 'tehran', label: 'تهران' }, { id: 'mashhad', label: 'مشهد' }];
function City({ changed }: { changed: (value: string | null) => void }) {
  const [selected, setSelected] = useState<string | null>(null), [text, setText] = useState('');
  const current = useRef(selected); current.current = selected;
  return <><button>کنترل پیشین</button><ComboBox clearable label="مبدا" items={cities} selectedKey={selected} inputValue={text}
    onSelectionChange={key => { current.current = key; setSelected(key); changed(key); }}
    onInputChange={value => { setText(value); if (value !== cities.find(city => city.id === current.current)?.label) setSelected(null); }}/><button>کنترل بعدی</button><output aria-label="شهر تاییدشده">{selected}</output></>;
}
function sameEventPopupFacts(input: HTMLElement) {
  const entries: { expanded: string | null; hiddenOutside: boolean }[] = [];
  const observe = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    // Target bubble runs after the component's native capture and BEFORE
    // delegated React bubbling or the browser's default focus navigation.
    const previous = document.querySelector('button');
    entries.push({ expanded: input.getAttribute('aria-expanded'), hiddenOutside: !!previous?.closest('[aria-hidden="true"], [inert]') });
  };
  input.addEventListener('keydown', observe);
  return { entries, stop: () => input.removeEventListener('keydown', observe) };
}

it.each([false, true])('exposes outside controls before native Tab default (reverse=%s) without inventing a selection or erasing raw query', async reverse => {
  const user = userEvent.setup(), changed = vi.fn(); render(<City changed={changed}/>);
  await user.tab(); await user.tab();
  const input = screen.getByRole('combobox', { name: 'مبدا' });
  fireEvent.input(input, { target: { value: 'ته' } });
  expect(input).toHaveAttribute('aria-expanded', 'true');
  const facts = sameEventPopupFacts(input);
  try {
    await user.tab({ shift: reverse });
    expect(facts.entries).toEqual([{ expanded: 'false', hiddenOutside: false }]);
    expect(input).toHaveValue('ته'); expect(screen.getByLabelText('شهر تاییدشده')).toBeEmptyDOMElement();
    expect(changed.mock.calls.filter(([key]) => key !== null)).toEqual([]);
    const destination = screen.getByRole('button', { name: reverse ? 'کنترل پیشین' : 'پاک کردن مبدا' });
    expect(destination).toHaveFocus(); expect(destination.closest('[aria-hidden="true"], [inert]')).toBeNull();
  } finally { facts.stop(); }
});

it('commits an explicitly arrow-focused option exactly once on Tab while retaining native focus navigation', async () => {
  const user = userEvent.setup(), changed = vi.fn(); render(<City changed={changed}/>);
  await user.tab(); await user.tab();
  const input = screen.getByRole('combobox', { name: 'مبدا' });
  await user.keyboard('{ArrowDown}'); changed.mockClear();
  const facts = sameEventPopupFacts(input);
  try {
    await user.tab();
    expect(facts.entries).toEqual([{ expanded: 'false', hiddenOutside: false }]);
    expect(changed).toHaveBeenCalledExactlyOnceWith('tehran');
    expect(input).toHaveValue('تهران'); expect(screen.getByLabelText('شهر تاییدشده')).toHaveTextContent('tehran');
    expect(screen.getByRole('button', { name: 'پاک کردن مبدا' })).toHaveFocus();
  } finally { facts.stop(); }
});

it('leaves composing and previously prevented Tab events to their current owner', async () => {
  const user = userEvent.setup(); render(<City changed={vi.fn()}/>);
  await user.tab(); await user.tab(); const input = screen.getByRole('combobox', { name: 'مبدا' });
  fireEvent.keyDown(input, { key: 'Tab', isComposing: true });
  expect(input).toHaveAttribute('aria-expanded', 'true');
  const facts = sameEventPopupFacts(input);
  const prevented = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); prevented.preventDefault();
  try {
    fireEvent(input, prevented);
    expect(facts.entries).toEqual([{ expanded: 'true', hiddenOutside: true }]);
  } finally { facts.stop(); }
});
