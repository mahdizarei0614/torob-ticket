import { expect, it } from 'vitest';
import { scheduleProviders } from './provider-scheduler';
it('waits for every entered worker to settle when one fails', async () => {
  let release!: () => void; let entered!: () => void;
  const sibling = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  let settled = false;
  const running = scheduleProviders([1, 2], new AbortController().signal, async value => {
    if (value === 1) { await started; throw new Error('storage'); }
    entered(); await sibling;
  }).catch(() => { settled = true; });
  await started; await new Promise(resolve => setImmediate(resolve));
  expect(settled).toBe(false);
  release(); await running; expect(settled).toBe(true);
});
