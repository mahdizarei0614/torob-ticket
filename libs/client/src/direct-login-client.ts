import { z } from 'zod';
import { DirectAdminSchema, DirectFlowSchema, DirectIdentitySchema, PartnerSchema, ReferencePageSchema, type PartnerInput } from '@torob-ticket/contracts';
export async function directRequest<T>(path: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, { credentials: 'same-origin', cache: 'no-store', signal, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }), headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) } });
  const value = await response.json();
  if (!response.ok) throw new Error(typeof value.message === 'string' ? value.message : 'درخواست انجام نشد. دوباره تلاش کنید.');
  return schema.parse(value);
}
const IdentityState = z.strictObject({ identity: DirectIdentitySchema.nullable() });
export const directLoginClient = {
  account: (signal?: AbortSignal) => directRequest('direct-login/account', IdentityState, undefined, signal),
  flow: (id: string, signal?: AbortSignal) => directRequest(`direct-login/flows/${encodeURIComponent(id)}`, DirectFlowSchema, undefined, signal),
  code: (phone: string, providerId?: string) => directRequest(providerId ? `reference-provider/${encodeURIComponent(providerId)}/phone/code` : 'direct-login/phone/code', z.strictObject({ id: z.string(), expiresAt: z.string() }), { phone }),
  verify: (id: string, code: string, providerId?: string) => directRequest(providerId ? `reference-provider/${encodeURIComponent(providerId)}/phone/verify` : 'direct-login/phone/verify', IdentityState, { id, code }),
  logout: (providerId?: string) => directRequest(providerId ? `reference-provider/${encodeURIComponent(providerId)}/logout` : 'direct-login/logout', z.strictObject({ signedOut: z.boolean() }), {}),
  consent: (id: string, approved: boolean) => directRequest(`direct-login/flows/${encodeURIComponent(id)}/consent`, z.strictObject({ redirect: z.string() }), { approved }),
  begin: (input: unknown) => directRequest('direct-login/authorizations', z.strictObject({ redirect: z.string() }), input),
  choices: (id: string, signal?: AbortSignal) => directRequest(`direct-login/choices/${encodeURIComponent(id)}`, z.strictObject({ providerId: z.string(), providerName: z.string(), directLogin: z.boolean(), referralId: z.string(), callbackUrl: z.string().nullable() }), undefined, signal),
  reference: (providerId: string, referralId?: string, signal?: AbortSignal) => directRequest(`reference-provider/${encodeURIComponent(providerId)}${referralId ? `?referral=${encodeURIComponent(referralId)}` : ''}`, ReferencePageSchema, undefined, signal),
  admin: (signal?: AbortSignal) => directRequest('admin/direct-login', DirectAdminSchema, undefined, signal),
  partner: (input: PartnerInput) => directRequest('admin/direct-login/partners', z.strictObject({ partner: PartnerSchema, clientSecret: z.string() }), input)
};
