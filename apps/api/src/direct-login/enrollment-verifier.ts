/** Implement this interface using a separately operated verifier. A provider's
 * own signed assertions or CRM timestamps alone cannot satisfy these methods. */
export interface EnrollmentVerifier {
  verifyCommitment(input: { clientId: string; providerId: string; root: string; attestation: string }): Promise<boolean>;
  verifyEnrollment(input: { clientId: string; providerId: string; referralId: string; subject: string; accountId: string; phone: string; attestation: string }): Promise<{ accountId: string; occurredAt: string; firstAccount: true } | null>;
}
export const ENROLLMENT_VERIFIER = Symbol('ENROLLMENT_VERIFIER');
export const unavailableVerifier: EnrollmentVerifier = { verifyCommitment: async () => false, verifyEnrollment: async () => null };
