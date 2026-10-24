import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './app';
describe('consumer foundation', () => {
  it('exposes a Persian semantic entry and an explicitly labeled demo', () => {
    render(<App />);
    expect(screen.getByRole('main')).toHaveAttribute('lang', 'fa');
    expect(screen.getByRole('main')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ترب تیکت');
    expect(screen.getByRole('note')).toHaveTextContent('نسخه نمایشی');
    expect(screen.getByRole('link', { name: 'مدیریت نسخه نمایشی' })).toHaveAttribute('href', '/admin/');
  });
});
