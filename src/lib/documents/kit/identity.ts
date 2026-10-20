import type { ClaimData } from '@/types/claim';
import type { DocType } from '@/types/documents';

export type IdentityResult = { status: 'match' | 'mismatch' | 'cantCheck'; found?: string; expected?: string };

const MIN_TEXT = 40; // normalised characters; less is a scan with a stray text layer
const MIN_REG = 6;
const MIN_NUMBER = 4; // claim / policy number
const MIN_CHASSIS = 6;

const normalise = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// ── Registration ────────────────────────────────────────────────────────────
const REG_SHAPE = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/;
// Same shape as found in page text, with groups so a candidate can be judged without re-parsing.
const REG_IN_TEXT = /([A-Z]{2})\s?-?(\d{1,2})\s?-?([A-Z]{0,3})\s?-?(\d{3,4})/g;

const canonParts = (state: string, district: string, series: string, num: string): string =>
  state + district.padStart(2, '0') + series + num.padStart(4, '0');

/** State + 2-digit district + series + 4-digit number, so MH-18-A-123 equals MH18A0123. Else plain normalised. */
function canonicalReg(raw: string): string {
  const n = normalise(raw);
  const m = n.match(REG_SHAPE);
  return m ? canonParts(m[1], m[2], m[3], m[4]) : n;
}

interface RegCandidate { canonical: string; credible: boolean }

function regCandidates(upper: string): RegCandidate[] {
  return [...upper.matchAll(REG_IN_TEXT)].map((m) => {
    const next = upper[(m.index ?? 0) + m[0].length];
    return {
      canonical: canonParts(m[1], m[2], m[3], m[4]),
      // A real registration has a 2-digit district and does not run on into more digits (a long ID number).
      credible: m[2].length === 2 && !(next !== undefined && /\d/.test(next)),
    };
  });
}

// ── Names ───────────────────────────────────────────────────────────────────
const NAME_STOP = new Set(['MR', 'MRS', 'MS', 'SHRI', 'SMT', 'KUMARI', 'M', 'S', 'PVT', 'LTD', 'PRIVATE', 'LIMITED', 'CO']);

const tokens = (s: string): string[] =>
  s.toUpperCase().split(/[^A-Z0-9]+/).filter((t) => t.length >= 2 && !NAME_STOP.has(t));

// ── Check ───────────────────────────────────────────────────────────────────
type Verdict = 'match' | 'mismatch' | undefined; // undefined = nothing to check

/**
 * Does this page belong to this claim? Compares the claim's own registration, chassis, policy number or
 * person's name against the page text. DL and KYC checks compare whole-word names only and never echo text.
 */
export function identityCheck(type: DocType, pageText: string | null, claim: ClaimData): IdentityResult {
  if (!pageText) return { status: 'cantCheck' };
  const text = normalise(pageText);
  if (text.length < MIN_TEXT) return { status: 'cantCheck' };
  const upper = pageText.toUpperCase();

  const rawReg = normalise(claim.vehicle.registrationNumber ?? '');
  const regCanon = canonicalReg(rawReg);
  // Judge the length as typed: canonical padding would turn a stub like MH18 into a 6+ character value.
  const regPresent = rawReg.length >= MIN_REG;
  const candidates = regPresent ? regCandidates(upper) : [];
  // A registration outside the usual shape (e.g. BH series) can't be parsed out of the page, so look for it as text.
  const regOk = regPresent && (REG_SHAPE.test(rawReg)
    ? candidates.some((c) => c.canonical === regCanon)
    : text.includes(regCanon));

  const regMismatch = (): IdentityResult => {
    const found = candidates.find((c) => c.credible)?.canonical;
    return found ? { status: 'mismatch', found, expected: regCanon } : { status: 'mismatch', expected: regCanon };
  };

  const hasNumber = (raw: string | undefined): [boolean, boolean] => {
    const n = normalise(raw ?? '');
    return [n.length >= MIN_NUMBER, text.includes(n)];
  };

  // Every present field must appear. `undefined` when nothing is checkable.
  const allOf = (tests: Array<[boolean, boolean]>): Verdict => {
    const present = tests.filter(([has]) => has);
    if (!present.length) return undefined;
    return present.every(([, ok]) => ok) ? 'match' : 'mismatch';
  };

  const namesIn = (...names: Array<string | undefined>): IdentityResult => {
    const sets = names.map((n) => tokens(n ?? '')).filter((t) => t.length);
    if (!sets.length) return { status: 'cantCheck' };
    const page = new Set(tokens(pageText));
    return { status: sets.some((t) => t.every((w) => page.has(w))) ? 'match' : 'mismatch' };
  };

  switch (type) {
    case 'rc':
    case 'rcBack':
    case 'policy': {
      const chassis = normalise(claim.vehicle.chassisNumber ?? '');
      const tail = chassis.slice(-MIN_CHASSIS);
      const second: [boolean, boolean] = type === 'policy'
        ? hasNumber(claim.policy.policyNumber)
        : [chassis.length >= MIN_CHASSIS, text.includes(tail)];
      const verdict = allOf([[regPresent, regOk], second]);
      if (!verdict) return { status: 'cantCheck' };
      if (verdict === 'match') return { status: 'match' };
      return regPresent && !regOk ? regMismatch() : { status: 'mismatch' };
    }
    case 'claimForm': {
      const [hasClaimNo, claimNoOk] = hasNumber(claim.policy.claimNumber);
      if (!regPresent && !hasClaimNo) return { status: 'cantCheck' };
      if ((hasClaimNo && claimNoOk) || regOk) return { status: 'match' };
      return regPresent ? regMismatch() : { status: 'mismatch' };
    }
    case 'dl':
    case 'dlBack':
      return namesIn(claim.driver.name);
    case 'aadhaar':
    case 'pan':
    case 'ckyc':
    case 'kycOther':
      return namesIn(claim.policy.insuredName, claim.driver.name);
    default:
      return { status: 'cantCheck' };
  }
}
