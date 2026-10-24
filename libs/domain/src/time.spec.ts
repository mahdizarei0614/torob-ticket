import { describe, expect, it } from 'vitest';
import { elapsedMinutes, localDateAt, matchesDepartureWindow, toGregorianDate } from './time';

describe('local date-only conversion', () => {
  it.each([
    ['1405-08-01', 'persian', '2026-10-23'], ['1399-12-30', 'persian', '2021-03-20'],
    ['۱۴۰۵-۰۸-۰۱', 'persian', '2026-10-23'], ['1400-01-01', 'persian', '2021-03-21'],
    ['2024-02-29', 'gregory', '2024-02-29'],
  ] as const)('converts %s in %s without an instant', (value, calendar, expected) => {
    expect(toGregorianDate(value, calendar)).toBe(expected);
  });
  it.each(['1400-12-30', '1405-07-31', '1405-13-01', '1405-00-01', '1405-01-00', '1405-1-1', '0000-01-01'])('rejects invalid Persian date %s rather than constraining it', value => {
    expect(() => toGregorianDate(value, 'persian')).toThrow();
  });
  it('rejects invalid Gregorian dates and instant strings', () => {
    expect(() => toGregorianDate('2023-02-29', 'gregory')).toThrow();
    expect(() => toGregorianDate('2026-10-24T00:00:00Z', 'gregory')).toThrow();
    expect(() => toGregorianDate('1405-08-01', 'unsupported' as never)).toThrow();
  });
  it('derives hotel arrival date in the destination zone across UTC midnight', () => {
    expect(localDateAt('2026-10-24T22:00:00Z', 'Asia/Tehran')).toBe('2026-10-25');
    expect(localDateAt('2026-10-24T01:00:00Z', 'America/Los_Angeles')).toBe('2026-10-23');
  });
});

describe('instant durations and departure windows', () => {
  it('calculates overnight elapsed minutes and retains partial minutes', () => {
    expect(elapsedMinutes('2026-10-24T23:30:00Z', '2026-10-25T01:00:00Z')).toBe(90);
    expect(elapsedMinutes('2026-10-24T23:30:00Z', '2026-10-24T23:30:30Z')).toBe(0.5);
    expect(elapsedMinutes('2026-10-24T23:30:00Z', '2026-10-24T23:30:00Z')).toBe(0);
  });
  it('measures elapsed time through a daylight-saving clock repeat', () => {
    expect(elapsedMinutes('2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z')).toBe(60);
  });
  it('rejects reversed intervals and non-UTC/invalid instants', () => {
    expect(() => elapsedMinutes('2026-10-25T01:00:00Z', '2026-10-24T23:30:00Z')).toThrow();
    expect(() => elapsedMinutes('2026-10-24', '2026-10-25')).toThrow();
    expect(() => localDateAt('2026-10-24T22:00:00+00:00', 'Asia/Tehran')).toThrow();
    expect(() => localDateAt('2026-10-24T22:00:00Z', 'Unknown/Zone')).toThrow();
  });
  it.each([
    ['2026-10-24T20:30:00Z', true], // 00:00 Tehran next day
    ['2026-10-24T19:30:00Z', true], // 23:00
    ['2026-10-24T22:30:00Z', true], // 02:00 inclusive end
    ['2026-10-24T22:31:00Z', false], ['2026-10-24T18:29:00Z', false],
  ] as const)('matches midnight-spanning windows in departure zone at %s', (instant, expected) => {
    expect(matchesDepartureWindow(instant, 'Asia/Tehran', { startMinute: 1320, endMinute: 120 })).toBe(expected);
  });
  it('treats equal endpoints as that single minute and midnight as minute zero', () => {
    expect(matchesDepartureWindow('2026-10-24T00:00:30Z', 'UTC', { startMinute: 0, endMinute: 0 })).toBe(true);
    expect(matchesDepartureWindow('2026-10-24T00:01:00Z', 'UTC', { startMinute: 0, endMinute: 0 })).toBe(false);
    expect(matchesDepartureWindow('2026-10-24T09:00:00Z', 'UTC', { startMinute: 540, endMinute: 600 })).toBe(true);
    expect(matchesDepartureWindow('2026-10-24T10:01:00Z', 'UTC', { startMinute: 540, endMinute: 600 })).toBe(false);
    expect(() => matchesDepartureWindow('2026-10-24T09:00:00Z', 'UTC', { startMinute: -1, endMinute: 600 })).toThrow();
  });
});
