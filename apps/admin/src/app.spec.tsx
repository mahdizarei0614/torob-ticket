import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './app';
describe('admin foundation', () => {
  it('exposes an English semantic entry and demo status', () => {
    render(<App />);
    expect(screen.getByRole('main')).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('main')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('TorobTicket Admin');
    expect(screen.getByRole('note')).toHaveTextContent('Demo environment');
    expect(screen.getByRole('link', { name: 'Open consumer demo' })).toHaveAttribute('href', '/');
  });
});
