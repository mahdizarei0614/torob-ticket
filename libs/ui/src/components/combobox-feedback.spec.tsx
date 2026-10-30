import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { ComboBox } from './combobox';
import { FieldErrorTooltip } from './field-error-tooltip';
import { MotionPolicyProvider } from '../motion/motion-surface';

afterEach(() => vi.unstubAllGlobals());
const cities = [{ id: 'tehran', label: 'تهران' }, { id: 'mashhad', label: 'مشهد' }, { id: 'closed', label: 'شهر بسته', disabled: true }];
function City({ error, disabled = false }: { error?: string; disabled?: boolean }) {
 const [selected, setSelected] = useState<string | null>(null), [value, setValue] = useState('');
 return <><ComboBox label="مقصد" items={cities} selectedKey={selected} onSelectionChange={setSelected} inputValue={value} onInputChange={setValue} isDisabled={disabled} error={error} clearable/><button>کنترل دیگر</button><output aria-label="انتخاب شهر">{selected}</output></>;
}

it('opens an empty city on keyboard focus without choosing a city, then keeps Escape/filter/keyboard selection semantics', async () => {
 const user = userEvent.setup(); render(<City/>);
 const input = screen.getByRole('combobox', { name: 'مقصد' }), output = screen.getByLabelText('انتخاب شهر');
 await user.tab();
 expect(input).toHaveFocus(); expect(input).toHaveAttribute('aria-expanded', 'true');
 expect(screen.getAllByRole('option')).toHaveLength(3); expect(screen.getByRole('option', { name: 'شهر بسته' })).toHaveAttribute('aria-disabled', 'true');
 expect(output).toBeEmptyDOMElement();
 await user.keyboard('{Escape}'); expect(input).toHaveFocus(); expect(input).toHaveValue(''); expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
 await user.type(input, 'مش'); expect(screen.getAllByRole('option')).toHaveLength(1);
 await user.keyboard('{ArrowDown}{Enter}'); expect(input).toHaveValue('مشهد'); expect(output).toHaveTextContent('mashhad');
});

it('keeps a disabled destination unfocusable and never opens its options or validation tooltip', async () => {
 const user = userEvent.setup(); render(<City disabled error="ابتدا مبدا را انتخاب کنید"/>);
 const input = screen.getByRole('combobox', { name: 'مقصد' }), other = screen.getByRole('button', { name: 'کنترل دیگر' });
 expect(input).toBeDisabled(); await user.tab(); expect(other).toHaveFocus();
 await user.click(input); expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('keeps described errors beside options, supports hover handoff and global Escape without moving focus, and clears corrected facts', async () => {
 const error = 'شهر مقصد را از فهرست انتخاب کنید.', user = userEvent.setup();
 const view = render(<City error={error}/>);
 const input = screen.getByRole('combobox', { name: 'مقصد' }), other = screen.getByRole('button', { name: 'کنترل دیگر' });
 await user.click(input);
 expect(screen.getByRole('listbox')).toBeInTheDocument();
 expect(await screen.findByRole('tooltip')).toHaveTextContent(error); expect(input).toHaveAccessibleDescription(error);
 const descriptions = (input.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
 expect(descriptions.length).toBeGreaterThan(0);
 for (const id of descriptions) expect(Array.from(document.querySelectorAll('[id]')).filter(node => node.id === id)).toHaveLength(1);
 await user.keyboard('{Escape}');
 await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
 expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); expect(input).toHaveFocus(); expect(input).toHaveAccessibleDescription(error);
 await user.click(other); await user.hover(screen.getByText('مقصد'));
 expect(await screen.findByRole('tooltip')).toHaveTextContent(error); expect(other).toHaveFocus();
 await user.keyboard('{Escape}'); await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
 await user.hover(other); await user.hover(input);
 const tip = await screen.findByRole('tooltip');
 await user.hover(tip);
 await act(() => new Promise(resolve => setTimeout(resolve, 250)));
 expect(tip).toBeInTheDocument(); expect(other).toHaveFocus();
 await user.keyboard('{Escape}');
 await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
 expect(other).toHaveFocus(); expect(input).toHaveAccessibleDescription(error);
 view.rerender(<City/>);
 expect(input).not.toHaveAttribute('aria-invalid', 'true');
 expect(screen.queryByText(error)).not.toBeInTheDocument();
});

function ErrorButton({ covered = false }: { covered?: boolean }) {
 const anchor = useRef<HTMLDivElement>(null);
 return <MotionPolicyProvider covered={covered}><div ref={anchor}><button aria-describedby="button-error">انتخاب تاریخ</button><FieldErrorTooltip anchorRef={anchor} messages={[{ id: 'button-error', message: 'تاریخ برگشت را انتخاب کنید.' }]}/></div></MotionPolicyProvider>;
}
it('uses static feedback under reduced motion, hides while covered and leaves the field description intact', async () => {
 vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
 const user = userEvent.setup(), view = render(<ErrorButton/>);
 const button = screen.getByRole('button', { name: 'انتخاب تاریخ' });
 await user.click(button); expect(await screen.findByRole('tooltip')).toHaveAttribute('data-tooltip-motion', 'static');
 view.rerender(<ErrorButton covered/>);
 await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()); expect(button).toHaveAccessibleDescription('تاریخ برگشت را انتخاب کنید.'); expect(button).toHaveFocus();
});
