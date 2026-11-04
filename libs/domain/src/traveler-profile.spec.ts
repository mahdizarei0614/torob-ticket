import { describe, expect, it } from 'vitest';
import { TravelerProfileSchema, type TravelerProfile } from '@torob-ticket/contracts';
import { travelerProfileForTrip } from './traveler-profile';
const profile: TravelerProfile = { givenName: 'مسافر', familyName: 'ایرانی', birthDate: '1992-03-04', gender: 'female', nationality: 'IR', nationalId: '0012345678', latinGivenName: 'Mosafer', latinFamilyName: 'Irani', passport: { number: 'A12345678', issuingCountry: 'IR', expiresOn: '2028-01-01' } };
const trip = { international: false, travelDate: '2026-11-10', lastTravelDate: '2026-11-15' };
describe('consented traveler data', () => {
  it('shares only route-relevant documents and returns an independent snapshot', () => {
    const domestic = travelerProfileForTrip(profile, trip, '2026-11-04');
    expect(domestic).toHaveProperty('nationalId'); expect(domestic).not.toHaveProperty('passport'); expect(domestic).not.toHaveProperty('latinGivenName');
    const international = travelerProfileForTrip(profile, { ...trip, international: true }, '2026-11-04');
    expect(international).not.toHaveProperty('nationalId'); expect(international.passport).toEqual(profile.passport); expect(international.latinGivenName).toBe('Mosafer');
    international.passport!.number = 'CHANGED'; expect(profile.passport?.number).toBe('A12345678');
  });
  it('requires the relevant documents, birth date and gender without inventing expiry rules', () => {
    expect(() => travelerProfileForTrip({ ...profile, nationalId: undefined }, trip, '2026-11-04')).toThrow('کد ملی');
    expect(() => travelerProfileForTrip({ ...profile, passport: undefined }, { ...trip, international: true }, '2026-11-04')).toThrow('گذرنامه');
    expect(() => travelerProfileForTrip({ ...profile, latinGivenName: undefined }, { ...trip, international: true }, '2026-11-04')).toThrow('لاتین');
    expect(() => travelerProfileForTrip({ ...profile, birthDate: '2027-01-01' }, trip, '2026-11-04')).toThrow('تاریخ تولد');
    expect(() => travelerProfileForTrip({ ...profile, gender: 'unspecified' }, trip, '2026-11-04')).toThrow('جنسیت');
    expect(() => travelerProfileForTrip({ ...profile, passport: { ...profile.passport!, expiresOn: trip.lastTravelDate } }, { ...trip, international: true }, '2026-11-04')).not.toThrow();
    expect(() => travelerProfileForTrip({ ...profile, passport: { ...profile.passport!, expiresOn: '2026-11-14' } }, { ...trip, international: true }, '2026-11-04')).toThrow('پایان سفر');
    const foreign = travelerProfileForTrip({ ...profile, nationality: 'DE' }, trip, '2026-11-04'); expect(foreign.passport).toBeDefined(); expect(foreign).not.toHaveProperty('nationalId');
  });
  it('normalizes Persian national ID and country codes and rejects malformed document data', () => {
    expect(TravelerProfileSchema.parse({ ...profile, nationalId: '۰۰۱۲۳۴۵۶۷۸', nationality: 'ir' }).nationalId).toBe('0012345678');
    expect(TravelerProfileSchema.safeParse({ ...profile, birthDate: '1992-02-31' }).success).toBe(false);
    expect(TravelerProfileSchema.safeParse({ ...profile, passport: { ...profile.passport, number: '<script>' } }).success).toBe(false);
    expect(TravelerProfileSchema.safeParse({ ...profile, verified: true }).success).toBe(false);
  });
});
