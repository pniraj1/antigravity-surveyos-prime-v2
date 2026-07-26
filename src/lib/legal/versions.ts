/**
 * Versioned legal texts and the consent record they produce.
 *
 * A consent record is only meaningful if you can say WHICH text was agreed to.
 * Bump the version whenever the corresponding page changes materially, so an
 * older record still resolves to the wording that was actually shown.
 */

/** Bump when /terms changes materially. */
export const TERMS_VERSION = '2026-06-19';

/** Bump when /privacy changes materially. */
export const PRIVACY_VERSION = '2026-07-25';

/** Bump when the attestation wording below changes. */
export const ATTESTATION_VERSION = '1.0';

/**
 * The professional attestation. This is what establishes the lawful basis for
 * processing an insured person's data: they never use this app and cannot
 * consent here, so the basis flows insurer → appointed surveyor → us as
 * processor. Kept verbatim so the exact wording agreed to is recoverable.
 */
export const ATTESTATION_TEXT =
  'I am a Surveyor and Loss Assessor licensed by the IRDAI. For each claim I process ' +
  'using Motor SurveyOS, I am appointed by an insurer, and I handle the personal data ' +
  'of insured persons and third parties under that appointment. I instruct Motor SurveyOS ' +
  'to process that data solely on my behalf and solely to help me produce my survey report.';

export interface ConsentRecord {
  /** Which attestation wording was shown. */
  attestationVersion: string;
  termsVersion: string;
  privacyVersion: string;
  /** ISO-8601 UTC. Set on the client — indicative, not a trusted timestamp. */
  acceptedAt: string;
}

export function buildConsentRecord(): ConsentRecord {
  return {
    attestationVersion: ATTESTATION_VERSION,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    acceptedAt: new Date().toISOString(),
  };
}
