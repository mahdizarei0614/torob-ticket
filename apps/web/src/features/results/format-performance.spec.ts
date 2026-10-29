import { expect, it } from 'vitest';
import { localDay, localTime, number, toman } from './format';

it('reuses formats without reusing dates, numbers, zones or changing the exact localized output', () => {
 for (const timeZone of ['Asia/Tehran', 'Europe/Istanbul', 'America/Los_Angeles', 'Pacific/Auckland']) {
  for (const instant of ['2026-10-25T06:00:00.000Z', '2026-11-02T22:35:00.000Z']) {
   expect(localTime(instant, timeZone)).toBe(new Intl.DateTimeFormat('fa-IR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(instant)));
   expect(localDay(instant, timeZone)).toBe(new Intl.DateTimeFormat('fa-IR', { timeZone, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(instant)));
  }
 }
 for (const amount of [0, -12.5, 1000000, 28224000]) {
  expect(number(amount)).toBe(new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(amount));
  expect(toman(amount)).toBe(new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(amount / 10) + ' تومان');
 }
});

it('retains native invalid-zone and invalid-date behavior after warm caches', () => {
 localDay('2026-10-25T06:00:00.000Z', 'Asia/Tehran');
 expect(() => localTime('2026-10-25T06:00:00.000Z', 'invalid/time-zone')).toThrow(RangeError);
 expect(() => localDay('not-a-date', 'Asia/Tehran')).toThrow(RangeError);
 expect(localTime('2026-10-25T06:00:00.000Z', 'Asia/Tehran')).toBe(new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date('2026-10-25T06:00:00.000Z')));
});
