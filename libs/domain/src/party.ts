import { PartySchema, type Party, type ProviderCapabilities } from '@torob-ticket/contracts';

export interface AgeRange { min: number; max: number }
/** Authored by the provider's fare/seat rules, never a universal age cutoff. */
export interface PartyPolicy extends Pick<ProviderCapabilities, 'requiresChildAges' | 'requiresInfantAges'> {
  childAgeRangeYears?: AgeRange;
  infantAgeRangeMonths?: AgeRange;
}
export type PartyValidationResult = { valid: true } | {
  valid: false;
  code: 'INVALID_QUERY' | 'AGE_REQUIRED';
  fieldPaths: (string | number)[][];
};

export function validateParty(party: Party, policy: PartyPolicy): PartyValidationResult {
  const parsed = PartySchema.safeParse(party);
  if (!parsed.success) return {
    valid: false, code: 'INVALID_QUERY',
    fieldPaths: parsed.error.issues.map(issue => issue.path.map(part => typeof part === 'number' ? part : String(part))),
  };
  const missing: (string | number)[][] = [];
  if (party.children && (policy.requiresChildAges || policy.childAgeRangeYears) && !party.childAges) missing.push(['childAges']);
  if (party.infants && (policy.requiresInfantAges || policy.infantAgeRangeMonths) && !party.infantAgesMonths) missing.push(['infantAgesMonths']);
  if (missing.length) return { valid: false, code: 'AGE_REQUIRED', fieldPaths: missing };
  const invalid: (string | number)[][] = [];
  for (const [key, range] of [['childAges', policy.childAgeRangeYears], ['infantAgesMonths', policy.infantAgeRangeMonths]] as const) {
    if (!range) continue;
    if (!Number.isSafeInteger(range.min) || !Number.isSafeInteger(range.max) || range.min < 0 || range.max < range.min) {
      throw new RangeError('Invalid authored age range');
    }
    party[key]?.forEach((age, index) => { if (age < range.min || age > range.max) invalid.push([key, index]); });
  }
  return invalid.length ? { valid: false, code: 'INVALID_QUERY', fieldPaths: invalid } : { valid: true };
}
