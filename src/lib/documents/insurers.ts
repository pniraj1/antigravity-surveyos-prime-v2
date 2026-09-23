/**
 * Insurer name → the short form surveyors actually write on a folder.
 * Policy documents spell the same company a dozen ways ("THE NEW INDIA
 * ASSURANCE COMPANY LIMITED", "New India Assurance Co. Ltd."), and the AI
 * extraction copies whatever the paper says, so match on the distinctive
 * words rather than the whole string.
 */

/** Ordered: the first pattern that matches wins, so put the specific ones first. */
const SHORT_FORMS: Array<[RegExp, string]> = [
  [/\bnew\s*india\b/, 'NIA'],
  [/\bunited\s*india\b/, 'UIIC'],
  [/\bnational\s+insurance\b/, 'NIC'],
  [/\boriental\b/, 'OIC'],
  [/\bicici\b/, 'ICICI'],
  [/\bbajaj\b/, 'BAJAJ'],
  [/\bhdfc\b/, 'HDFC'],
  [/\btata\b/, 'TATA'],
  [/\breliance\b/, 'RELIANCE'],
  [/\bsbi\b/, 'SBI'],
  [/\biffco\b/, 'IFFCO'],
  [/\bchola/, 'CHOLA'],
  [/\bshriram\b/, 'SHRIRAM'],
  [/\broyal\s*sundaram\b/, 'ROYAL'],
  [/\bfuture\s*generali\b/, 'FUTURE'],
  [/\buniversal\s*sompo\b|\bsompo\b/, 'SOMPO'],
  [/\bmagma\b/, 'MAGMA'],
  [/\bliberty\b/, 'LIBERTY'],
  [/\bkotak\b/, 'KOTAK'],
  [/\bdigit\b/, 'DIGIT'],
  [/\backo\b/, 'ACKO'],
  [/\bnavi\b/, 'NAVI'],
  [/\bzuno\b|\bedelweiss\b/, 'ZUNO'],
  [/\braheja\b/, 'RAHEJA'],
];

/** Words that appear in every insurer's registered name and identify none of them. */
const NOISE = /^(the|insurance|assurance|general|company|co|ltd|limited|india|indian|pvt|private)$/;

export function insurerShortForm(name: string | undefined): string {
  const clean = (name ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  for (const [re, short] of SHORT_FORMS) if (re.test(clean)) return short;
  const word = clean.split(' ').find((w) => !NOISE.test(w));
  return word ? word.toUpperCase() : ''; // one word already — slicing it would cut a folder name mid-word, forever
}
