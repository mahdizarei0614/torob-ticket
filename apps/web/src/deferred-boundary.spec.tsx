import { lazy } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DeferredBoundary } from './deferred-boundary';

it('bounds a rejected deferred body and leaves owner recovery controls usable', async () => {
  const failed = lazy(() => Promise.reject(new Error('Chunk unavailable')));
  const FailedBody = failed, close = vi.fn();
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    render(<section><DeferredBoundary loading={<p role="status">Loading</p>} unavailable={<p role="alert">Unavailable</p>}><FailedBody /></DeferredBoundary><button onClick={close}>Cancel</button></section>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  } finally { log.mockRestore(); }
});
