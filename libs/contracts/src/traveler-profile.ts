import { z } from 'zod';
import { LocalDateSchema } from './common';
const digits = (value: string) => value.replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
const name = z.string().trim().min(1).max(100);
const country = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
export const TravelerProfileSchema = z.strictObject({
  givenName: name, familyName: name, birthDate: LocalDateSchema,
  gender: z.enum(['female', 'male', 'unspecified']), nationality: country,
  email: z.email().max(254).optional(),
  latinGivenName: z.string().trim().regex(/^[A-Za-z][A-Za-z .'-]{0,99}$/).optional(),
  latinFamilyName: z.string().trim().regex(/^[A-Za-z][A-Za-z .'-]{0,99}$/).optional(),
  nationalId: z.string().transform(digits).pipe(z.string().regex(/^[0-9]{10}$/)).optional(),
  passport: z.strictObject({ number: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/), issuingCountry: country, expiresOn: LocalDateSchema }).optional(),
});
export type TravelerProfile = z.infer<typeof TravelerProfileSchema>;
export const TravelContextSchema = z.strictObject({ international: z.boolean(), travelDate: LocalDateSchema, lastTravelDate: LocalDateSchema });
export type TravelContext = z.infer<typeof TravelContextSchema>;
