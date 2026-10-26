import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './app';
describe('admin foundation', () => {
  it('exposes an English operations entry and traveler navigation', () => {
    render(<App />);
    expect(screen.getByRole('main')).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('main')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('TorobTicket Admin');
    expect(screen.getByRole('note')).toHaveTextContent('Travel comparison operations');
    expect(screen.getByRole('link', { name: 'Open travel search' })).toHaveAttribute('href', '/');
  });
});
