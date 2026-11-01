import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { ComboBox } from './combobox';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const cities = [{ id: 'tehran', label: 'تهران' }, { id: 'mashhad', label: 'مشهد' }, { id: 'shiraz', label: 'شیراز' }];
function City() {
  const [selected, setSelected] = useState<string | null>('mashhad'), [text, setText] = useState('مشهد'), current = useRef(selected); current.current = selected;
  return <><div data-testid="ancestor" style={{ overflow: 'auto', width: 360, height: 180 }}>
    <ComboBox label="مقصد" items={cities} selectedKey={selected} inputValue={text} clearable
      onSelectionChange={id => { current.current = id; setSelected(id); }}
      onInputChange={value => { setText(value); if (value !== cities.find(city => city.id === current.current)?.label) setSelected(null); }}/>
  </div><button>کنترل دیگر</button><div data-testid="unrelated"/><output aria-label="شهر تاییدشده">{selected}</output></>;
}
async function opened() {
  const user = userEvent.setup(); render(<City/>);
  const input = screen.getByRole('combobox', { name: 'مقصد' }), group = input.parentElement!, ancestor = screen.getByTestId('ancestor'), outside = screen.getByRole('button', { name: 'کنترل دیگر' });
  const geometry = { x: 100, y: 70 };
  vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() => new DOMRect(geometry.x, geometry.y, 190, 44));
  vi.spyOn(group, 'getBoundingClientRect').mockImplementation(() => new DOMRect(geometry.x, geometry.y, 250, 44));
  vi.spyOn(ancestor, 'getBoundingClientRect').mockImplementation(() => new DOMRect(70, 40, 360, 180));
  await user.click(input); fireEvent.input(input, { target: { value: 'شیراز' } });
  expect(await screen.findByRole('option', { name: 'شیراز' })).toBeVisible();
  expect(input).toHaveValue('شیراز'); expect(screen.getByLabelText('شهر تاییدشده')).toBeEmptyDOMElement();
  return { user, input, group, ancestor, outside, geometry, listbox: screen.getByRole('listbox') };
}

it.each(['document', 'ancestor'] as const)('retains the same focused uncommitted popup during visible %s scroll', async target => {
  const { input, ancestor, geometry, listbox } = await opened(); geometry.y -= 12;
  await act(async () => { fireEvent.scroll(target === 'document' ? document : ancestor); });
  expect(input).toHaveFocus(); expect(input).toHaveAttribute('aria-expanded', 'true'); expect(input).toHaveValue('شیراز');
  expect(screen.getByRole('listbox')).toBe(listbox); expect(screen.getByLabelText('شهر تاییدشده')).toBeEmptyDOMElement();
});

it.each(['Escape', 'outside', 'blur', 'selection'] as const)('keeps %s dismissal authoritative after an earlier scroll dispatch ends', async action => {
  const { user, input, outside } = await opened(); fireEvent.scroll(document);
  expect(input).toHaveAttribute('aria-expanded', 'true');
  if (action === 'Escape') await user.keyboard('{Escape}');
  else if (action === 'outside') await user.click(outside);
  else if (action === 'blur') { await act(async () => { outside.focus(); }); }
  else await user.keyboard('{ArrowDown}{Enter}');
  expect(input).toHaveAttribute('aria-expanded', 'false'); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(input).toHaveValue('شیراز');
  if (action === 'selection') expect(screen.getByLabelText('شهر تاییدشده')).toHaveTextContent('shiraz');
  else expect(screen.getByLabelText('شهر تاییدشده')).toBeEmptyDOMElement();
});

it('still dismisses when the focused anchor scrolls fully outside the viewport', async () => {
  const { input, geometry } = await opened(); geometry.y = -100;
  fireEvent.scroll(document); expect(input).toHaveAttribute('aria-expanded', 'false'); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('still dismisses when a clipping ancestor hides the focused anchor inside the viewport', async () => {
  const { input, ancestor, geometry } = await opened(); geometry.x = 500;
  fireEvent.scroll(ancestor); expect(input).toHaveAttribute('aria-expanded', 'false'); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
it('keeps unrelated and listbox-internal scrolling separate from ancestor dismissal', async () => {
  const { input, listbox } = await opened();
  fireEvent.scroll(screen.getByTestId('unrelated')); fireEvent.scroll(listbox);
  expect(input).toHaveAttribute('aria-expanded', 'true'); expect(screen.getByRole('listbox')).toBe(listbox);
});

it('moves the same popup position by the observed visible anchor delta after ancestor scroll', async () => {
  const { ancestor, geometry, listbox } = await opened(), popup = listbox.closest<HTMLElement>('[data-trigger="ComboBox"]')!;
  const before = { top: parseFloat(popup.style.top), bottom: parseFloat(popup.style.bottom) };
  expect(Number.isFinite(before.top) || Number.isFinite(before.bottom)).toBe(true);
  geometry.y -= 12; fireEvent.scroll(ancestor);
  await waitFor(() => {
    if (Number.isFinite(before.top)) expect(parseFloat(popup.style.top)).toBeCloseTo(before.top - 12, 3);
    else expect(parseFloat(popup.style.bottom)).toBeCloseTo(before.bottom + 12, 3);
  });
  expect(screen.getByRole('listbox')).toBe(listbox);
});
