import type { ClaimData } from '@/types/claim';
import type { DocType } from '@/types/documents';

export type IdentityResult = { status: 'match' | 'mismatch' | 'cantCheck'; found?: string; expected?: string };

const normalise = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const REG_RE = /[A-Z]{2}\s?-?\d{1,2}\s?-?[A-Z]{0,3}\s?-?\d{3,4}/;

const nameWords = (name: string): string[] => name.toUpperCase().split(/\s+/).filter((w) => w.length >= 2);
const hasAllWords = (words: string[], upper: string): boolean => words.every((w) => upper.includes(w));

/**
 * Does this page belong to this claim? Compares the claim's own registration, chassis, policy number or
 * person's name against the page text. KYC and DL checks compare names only and never echo page text.
 */
export function identityCheck(type: DocType, pageText: string | null, claim: ClaimData): IdentityResult {
  if (!pageText || !pageText.trim()) return { status: 'cantCheck' };
  const text = normalise(pageText);
  const upper = pageText.toUpperCase();
  const reg = normalise(claim.vehicle.registrationNumber ?? '');

  const regMismatch = (): IdentityResult => {
    const hit = upper.match(REG_RE)?.[0];
    return { status: 'mismatch', found: hit ? normalise(hit) : undefined, expected: reg };
  };

  // "All of" checks: every present field must appear. Returns undefined when nothing can be checked.
  const allOf = (tests: Array<[boolean, boolean]>): IdentityResult | undefined => {
    const present = tests.filter(([has]) => has);
    if (!present.length) return undefined;
    return present.every(([, ok]) => ok) ? { status: 'match' } : { status: 'mismatch' };
  };

  switch (type) {
    case 'rc':
    case 'rcBack':
    case 'policy': {
      const chassis = normalise(claim.vehicle.chassisNumber ?? '').slice(-6);
      const policyNo = normalise(claim.policy.policyNumber ?? '');
      const regOk = text.includes(reg);
      const second: [boolean, boolean] = type === 'policy'
        ? [!!policyNo, text.includes(policyNo)]
        : [!!chassis, text.includes(chassis)];
      const result = allOf([[!!reg, regOk], second]);
      if (!result) return { status: 'cantCheck' };
      return result.status === 'mismatch' && reg && !regOk ? regMismatch() : result;
    }
    case 'claimForm': {
      const claimNo = normalise(claim.policy.claimNumber ?? '');
      if (!reg && !claimNo) return { status: 'cantCheck' };
      if ((claimNo && text.includes(claimNo)) || (reg && text.includes(reg))) return { status: 'match' };
      return reg ? regMismatch() : { status: 'mismatch' };
    }
    case 'dl':
    case 'dlBack': {
      const words = nameWords(claim.driver.name ?? '');
      if (!words.length) return { status: 'cantCheck' };
      return { status: hasAllWords(words, upper) ? 'match' : 'mismatch' };
    }
    case 'aadhaar':
    case 'pan':
    case 'ckyc':
    case 'kycOther': {
      const sets = [nameWords(claim.policy.insuredName ?? ''), nameWords(claim.driver.name ?? '')].filter((w) => w.length);
      if (!sets.length) return { status: 'cantCheck' };
      return { status: sets.some((w) => hasAllWords(w, upper)) ? 'match' : 'mismatch' };
    }
    default:
      return { status: 'cantCheck' };
  }
}
