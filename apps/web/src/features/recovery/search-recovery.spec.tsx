import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchRecovery } from './search-recovery';
import { catalog, query } from '../search/search-test-data';
describe('deliberate recovery choices', () => {
  it('offers only the chosen present filter and never changes intent by rendering', () => {
    const clear = vi.fn(), fresh = vi.fn();
    render(<SearchRecovery query={{ ...query, filters: { refundableOnly: true, budgetMaxRial: 5000000 } }} catalog={catalog} status="empty" onEdit={() => undefined} onFresh={fresh} onClearFilter={clear} />);
    expect(clear).not.toHaveBeenCalled(); expect(fresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'حذف فقط فیلتر استرداد و مقایسه' }));
    expect(clear).toHaveBeenCalledExactlyOnceWith('refundableOnly'); expect(fresh).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /حذف فقط فیلتر بار/ })).toBeNull();
  });
  it('keeps expiry recovery explicit and does not expose a search mutation until session resumes', () => {
    const resume = vi.fn(), fresh = vi.fn();
    render(<SearchRecovery query={query} catalog={catalog} expired onEdit={() => undefined} onResume={resume} onFresh={fresh} />);
    expect(resume).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'مقایسه تازه با شرایط فرم' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'بازیابی نشست و حفظ فرم' })); expect(resume).toHaveBeenCalledTimes(1); expect(fresh).not.toHaveBeenCalled();
  });
});
