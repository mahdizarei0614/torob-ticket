import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@torob-ticket/client';
import { App } from './app';
import { catalog, session } from './features/search/search-test-data';
afterEach(() => vi.restoreAllMocks());
describe('consumer shell', () => {
  it('boots a useful guest form from API IDs, with Persian semantics and subtle demo entry', async () => {
    vi.spyOn(apiClient, 'session').mockResolvedValue(session);
    vi.spyOn(apiClient, 'catalog').mockResolvedValue(catalog);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'سفر بعدی از کجا شروع می‌شود؟' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('lang', 'fa');
    expect(screen.getByRole('main')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('note')).toHaveTextContent('نسخه نمایشی');
    expect(screen.getByRole('combobox', { name: 'مبدا' })).toHaveValue('آغاز');
    expect(screen.getByRole('combobox', { name: 'مقصد' })).toHaveValue('پایان');
    expect(screen.getByRole('button', { name: 'جست‌وجوی سفر' })).toBeEnabled();
  });
  it('exposes bootstrap failure and an explicit retry instead of inventing a network', async () => {
    vi.spyOn(apiClient, 'session').mockRejectedValue(new Error('offline'));
    render(<App />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeEnabled();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'مدیریت نسخه نمایشی' })).toHaveAttribute('href', '/admin/');
  });
});
