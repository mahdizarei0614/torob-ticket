import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecoveryState } from './recovery-state';
describe('accessible recovery action surface', () => {
  it('names the retained state and exposes deliberate keyboard actions once', async () => {
    const press = vi.fn(), user = userEvent.setup();
    render(<RecoveryState language="en" title="Read interrupted" description="Previous evidence retained." actions={[{ id: 'read', label: 'Read status', onPress: press }]} />);
    expect(screen.getByRole('region', { name: 'Read interrupted' })).toBeInTheDocument();
    await user.tab(); await user.keyboard('{Enter}'); expect(press).toHaveBeenCalledTimes(1);
  });
  it('blocks duplicate recovery actions while pending without removing the explanation', async () => {
    const press = vi.fn(), user = userEvent.setup();
    render(<RecoveryState title="در حال بررسی" description="اطلاعات حفظ شده است." busy actions={[{ id: 'read', label: 'خواندن', onPress: press }]} />);
    await user.click(screen.getByRole('button', { name: 'خواندن' })); expect(press).not.toHaveBeenCalled(); expect(screen.getByRole('status')).toHaveTextContent('اطلاعات حفظ شده است.');
  });
});
