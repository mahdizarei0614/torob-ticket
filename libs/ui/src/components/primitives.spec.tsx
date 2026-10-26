import { useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Button } from './button';
import { SegmentedControl } from './segmented-control';
import { ComboBox } from './combobox';
import { Dialog } from './dialog';
import { Tooltip } from './tooltip';
import { Price } from './price';

const cities = [
  { id: 'thr', label: 'تهران', code: 'THR' },
  { id: 'mhd', label: 'مشهد', code: 'MHD' },
];
function CityField() {
  const [value, setValue] = useState<string | null>(null);
  const [input, setInput] = useState('');
  return (
    <>
      <ComboBox
        clearable
        label="مبدأ"
        language="fa"
        items={cities}
        selectedKey={value}
        onSelectionChange={setValue}
        inputValue={input}
        onInputChange={setInput}
      />
      <output aria-label="selected city">{value}</output>
    </>
  );
}
function Choice() {
  const [value, setValue] = useState('flight');
  return (
    <>
      <SegmentedControl
        hideLabel
        label="Transport"
        language="en"
        value={value}
        onChange={setValue}
        options={[
          { id: 'flight', label: 'Flight' },
          { id: 'train', label: 'Train' },
          { id: 'bus', label: 'Bus', disabled: true },
        ]}
      />
      <output aria-label="selected mode">{value}</output>
    </>
  );
}
function ModalExample({ mounted = true }: { mounted?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setOpen(true)}>Details</Button>
      {mounted && (
        <Dialog language="en" title="Whole-party total" isOpen={open} onOpenChange={setOpen}>
          <p>All mandatory charges included.</p>
          <Button>Review conditions</Button>
        </Dialog>
      )}
    </>
  );
}
describe('shared interaction contracts', () => {
  it('clears the selected city and query together, returns input focus, and permits another selection',async()=>{
    const user=userEvent.setup();render(<CityField/>);
    const input=screen.getByRole('combobox',{name:'مبدأ'});expect(input).toHaveAttribute('placeholder','جست‌وجو…');
    await user.click(input);await user.keyboard('{ArrowDown}{Enter}');expect(input).toHaveValue('تهران');
    await user.click(screen.getByRole('button',{name:'پاک کردن مبدأ'}));expect(input).toHaveValue('');expect(screen.getByLabelText('selected city')).toBeEmptyDOMElement();expect(input).toHaveFocus();
    await user.type(input,'مشهد');await user.keyboard('{ArrowDown}{Enter}');expect(input).toHaveValue('مشهد');expect(screen.getByLabelText('selected city')).toHaveTextContent('mhd');
  });
  it('commits the controlled city ID using keyboard and keeps its LTR code readable', async () => {
    const user = userEvent.setup();
    render(<CityField />);
    await user.tab();
    await user.keyboard('{ArrowDown}');
    const option = await screen.findByRole('option', { name: /تهران/ });
    expect(within(option).getByText('THR')).toHaveAttribute('dir', 'ltr');
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('selected city')).toHaveTextContent('thr');
    expect(screen.getByRole('combobox')).toHaveValue('تهران');
  });
  it('moves the controlled radio choice with arrows and skips disabled segments', async () => {
    const user = userEvent.setup();
    render(<Choice />);
    expect(screen.getByRole('radiogroup',{name:'Transport'})).toBeInTheDocument();
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Train' })).toBeChecked();
    expect(screen.getByLabelText('selected mode')).toHaveTextContent('train');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Flight' })).toBeChecked();
  });
  it('describes a keyboard-focused trigger with a tooltip', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Prices cover every traveler">
        <Button>About totals</Button>
      </Tooltip>,
    );
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Prices cover every traveler');
    expect(screen.getByRole('button')).toHaveAccessibleDescription('Prices cover every traveler');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });
  it('contains modal focus, dismisses with Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    render(<ModalExample />);
    await user.click(screen.getByRole('button', { name: 'Details' }));
    const dialog = await screen.findByRole('dialog', { name: 'Whole-party total' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    for (let count = 0; count < 5; count++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Details' })).toHaveFocus());
  });
  it('does not steal newly chosen focus after an open dialog unmounts', async () => {
    const user = userEvent.setup();
    const result = render(
      <>
        <ModalExample />
        <Button>Next action</Button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Details' }));
    const dialog = await screen.findByRole('dialog', { name: 'Whole-party total' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    result.rerender(
      <>
        <ModalExample mounted={false} />
        <Button>Next action</Button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Next action' }));
    // React Aria restores focus on a frame. Let pending restoration run after
    // the user has deliberately selected a new focus target.
    await act(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next action' })).toHaveFocus();
  });
  it('blocks pending actions and exposes a localized loading label', async () => {
    const user = userEvent.setup();
    let presses = 0;
    render(
      <Button language="fa" isLoading onPress={() => presses++}>
        مقایسه
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(presses).toBe(0);
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button')).toHaveAccessibleName(/در حال بارگذاری/);
  });
  it('exposes errors and descriptions as the combobox accessible description', () => {
    render(
      <ComboBox
        language="en"
        label="Destination"
        items={[]}
        selectedKey={null}
        onSelectionChange={() => undefined}
        inputValue=""
        onInputChange={() => undefined}
        error="Choose a supported city"
        description="City or station"
      />,
    );
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox')).toHaveAccessibleDescription(/Choose a supported city/);
  });
  it('announces exact whole-party and whole-stay totals without rounding a rial', () => {
    render(
      <>
        <Price
          language="en"
          total={{ amountRial: 9007199254740991, currency: 'IRR' }}
          scope={{ kind: 'party', travelers: 3 }}
        />
        <Price
          language="fa"
          total={{ amountRial: 12345001, currency: 'IRR' }}
          scope={{ kind: 'stay', rooms: 2, nights: 3 }}
        />
      </>,
    );
    expect(screen.getByLabelText('Total for all 3 travelers: 900,719,925,474,099.1 toman')).toBeVisible();
    expect(screen.getByLabelText('مجموع ۲ اتاق برای ۳ شب: ۱٬۲۳۴٬۵۰۰٫۱ تومان')).toBeVisible();
  });
});
