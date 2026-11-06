import type { AuthorizeInput, CommitmentProof, TravelerProfile } from '@torob-ticket/contracts';
import type { LoginTransaction } from '@torob-ticket/provider-sdk';
export interface PhoneIdentity { id: string; phone: string; verifiedAt: string; profile?: TravelerProfile }
export interface Challenge { id: string; phone: string; purpose: string; codeHash: string; deliveryCode: string; browser: string; expires: number; created: number; attempts: number; used: boolean; testCode?: boolean }
export interface ReferralBinding { handle: string; referralId: string; providerId: string; clientId: string; integration?: string; created: number; sequence: number; expires: number; proof?: CommitmentProof }
export interface Flow { id: string; request: AuthorizeInput; browser: string; expires: number; status: 'pending' | 'consented' | 'denied' | 'complete'; proof?: CommitmentProof; identityId?: string; identitySession?: string; acquisitionId?: string; authorizedProfile?: TravelerProfile; codeHash?: string; codeExpires?: number; consumed?: boolean }
export interface Acquisition { integration?: string; id: string; providerId: string; referralId: string; identityId: string; accountId: string | null; status: 'pending' | 'existing' | 'new' | 'repeat' | 'denied' | 'disputed'; reason: string; createdAt: string; confirmedAt: string | null; rateRial: number | null; tariffRevision: number; evidence: 'none' | 'prior-commitment' | 'local-enrollment' | 'provider-report' | 'verified-enrollment' }
export interface IssuerState {
  version: 1; sequence: number; privateKey: string; publicKey: Record<string, string>; kid: string; subjectSecret: string;
  reviewerSetup?: { clientId: string; revision: number; status: 'pending' | 'ready'; retryAfter: number };
  installations?: { hash: string; clientId: string; secret: string; revision: number; origin: string; expires: number; consumed: boolean }[];
  identities: PhoneIdentity[]; challenges: Challenge[];
  sessions: { hash: string; identityId: string; expires: number }[];
  references: ReferralBinding[]; flows: Flow[];
  snapshots: { providerId: string; root: string; at: number; sequence: number; trusted: boolean; origin: 'reference' | 'external' }[];
  acknowledgments: { referralId: string; clientId: string; revision: number; acceptedAt: string; rateRial: number | null }[];
  acquisitions: Acquisition[];
  access: { hash: string; clientId: string; identityId: string; acquisitionId: string; identitySession: string; authorizedProfile?: TravelerProfile; expires: number }[];
}
export interface ProviderAccount { id: string; providerId: string; phone: string; salt: string; createdAt: string; subject?: string; verifiedAt: string }
export interface ReferenceState {
  enrollments: { providerId: string; accountId: string; occurredAt: string }[];
  credentials: { clientId: string; secret: string }[];
  accounts: ProviderAccount[];
  sessions: { hash: string; providerId: string; accountId: string; expires: number }[];
  transactions: { hash: string; clientId: string; transaction: LoginTransaction; consumed: boolean; callbackHash?: string; result?: { token: string; referralId: string } }[];
  outbox: { id: string; clientId: string; referralId: string; identityId: string; accountId: string; created: boolean; occurredAt: string; delivered: boolean }[];
}
