import { configuredAdminOrigin, configuredOrigin } from './issuer-origin';
import { exampleProviderOrigin } from './example-provider-config';
export const REVIEW_PROVIDER = { providerId: 'demo-provider-01', name: 'راه‌آرا' } as const;
export function localReviewEnabled(origin?: string): boolean {
  if (process.env.TOROBTICKET_LOCAL_REVIEW !== 'true') return false;
  try {
    const web = configuredOrigin();
    if (origin !== undefined && origin !== web) return false;
    return [web, configuredAdminOrigin(), exampleProviderOrigin()].every(value => {
      const url = new URL(value);
      return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    });
  } catch { return false; }
}
