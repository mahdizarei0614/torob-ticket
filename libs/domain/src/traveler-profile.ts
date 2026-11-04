import type { TravelContext, TravelerProfile } from '@torob-ticket/contracts';
/** Projection contains only the fields required for the consented trip. */
export function travelerProfileForTrip(profile: TravelerProfile, context: TravelContext, today: string): TravelerProfile {
  if (profile.birthDate > today || profile.birthDate > context.travelDate) throw new Error('تاریخ تولد باید پیش از امروز و تاریخ سفر باشد');
  if (profile.gender === 'unspecified') throw new Error('جنسیت مسافر را برای اطلاعات بلیت مشخص کنید');
  const base: TravelerProfile = { givenName: profile.givenName, familyName: profile.familyName, birthDate: profile.birthDate, gender: profile.gender, nationality: profile.nationality, ...(profile.email ? { email: profile.email } : {}) };
  if (context.international || profile.nationality !== 'IR') {
    if (!profile.passport) throw new Error('اطلاعات گذرنامه را کامل کنید');
    if (profile.passport.expiresOn < context.lastTravelDate) throw new Error('گذرنامه باید تا پایان سفر اعتبار داشته باشد');
    base.passport = { ...profile.passport };
  } else {
    if (!profile.nationalId) throw new Error('کد ملی مسافر را وارد کنید');
    base.nationalId = profile.nationalId;
  }
  if (context.international) {
    if (!profile.latinGivenName || !profile.latinFamilyName) throw new Error('نام و نام خانوادگی لاتین مطابق گذرنامه را وارد کنید');
    base.latinGivenName = profile.latinGivenName; base.latinFamilyName = profile.latinFamilyName;
  }
  return base;
}
