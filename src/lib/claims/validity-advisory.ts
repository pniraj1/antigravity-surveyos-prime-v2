// ═══════════════════════════════════════════════════════════
// VALIDITY ADVISORIES
//
// Was a document valid ON THE DATE OF THE ACCIDENT — not today.
//
// For a commercial vehicle the fitness certificate, permit, licence,
// registration and policy must all be valid simultaneously on the date of
// loss. Comparing against `today` is the wrong reference for a claim: a
// licence that had lapsed at the time of the accident but has since been
// renewed reads as perfectly valid.
//
// The output of this module is ADVICE. It never decides anything. The
// surveyor chooses whether to record it; repudiation is the insurer's call,
// and Indian courts have held insurers cannot repudiate on technicality alone
// without proving material breach. Software presenting a lapse as a verdict
// oversteps twice over.
// ═══════════════════════════════════════════════════════════

export interface ValidityAdvice {
  /** Expiry as stored (ISO yyyy-mm-dd). */
  expiryDate: string;
  /** Accident date as stored (may carry a time component). */
  accidentDate: string;
}

/** Parses a stored date to midnight local, or null when unusable. */
function atMidnight(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns advice when `expiryDate` precedes `accidentDate`, otherwise null.
 *
 * Returns null when either date is missing — with no accident date there is no
 * basis for a comparison, and silently falling back to `today` would
 * reintroduce the exact bug this replaces.
 */
export function checkValidityOnAccidentDate(
  expiryDate: string | undefined | null,
  accidentDate: string | undefined | null,
): ValidityAdvice | null {
  const expiry = atMidnight(expiryDate);
  const accident = atMidnight(accidentDate);
  if (!expiry || !accident) return null;
  if (expiry >= accident) return null;
  return { expiryDate: expiryDate as string, accidentDate: accidentDate as string };
}

/** Suggested note text. Editable by the surveyor — never written automatically. */
export function suggestedNote(label: string, advice: ValidityAdvice, formatDate: (d: string) => string): string {
  return `${label} had expired on the date of the accident (expired ${formatDate(advice.expiryDate)}; accident ${formatDate(advice.accidentDate)}).`;
}

/** Appends a note to existing remarks without duplicating it. */
export function appendNote(existing: string, note: string): string {
  const current = (existing ?? '').trim();
  if (!current) return note;
  if (current.includes(note)) return current;
  return `${current} ${note}`;
}
